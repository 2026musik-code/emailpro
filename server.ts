import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/cloudflare-workers";

const app = new Hono();

// Middleware
app.use("*", cors());

// Test route to verify worker is running
app.get("/worker-test", (c) => {
  return c.text(`Worker is running at ${new Date().toISOString()}`);
});

// Global Error Handler
app.onError((err, c) => {
  console.error(`[Hono Error]: ${err.message}`);
  return c.json({
    error: "Internal Server Error",
    message: err.message,
  }, 500);
});

const USER_AGENT = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36';

// --- API ROUTES ---
const api = new Hono();

api.get("/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// --- ADMIN API ROUTES ---
api.post("/admin/track", async (c) => {
  try {
    const { email, provider } = await c.req.json();
    const r2 = c.env?.VPSAI_R2;
    if (!r2) {
      console.warn("VPSAI_R2 binding not found");
      return c.json({ success: false, error: "R2 not configured" });
    }

    const timestamp = new Date().toISOString();
    // Key format: requests/YYYY-MM-DD/YYYY-MM-DDTHH:MM:SSZ-email
    const dateStr = timestamp.split('T')[0];
    const key = `requests/${dateStr}/${timestamp}-${email}`;

    // Check limits
    const configObj = await r2.get("config.json");
    let limit = 0;
    if (configObj) {
      const config = await configObj.json();
      limit = config.dailyLimit || 0;
    }

    if (limit > 0) {
      const list = await r2.list({ prefix: `requests/${dateStr}/` });
      if ((list.objects || []).length >= limit) {
        return c.json({ error: "Daily limit reached" }, 429);
      }
    }

    await r2.put(key, JSON.stringify({ email, provider, timestamp }));
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

api.get("/admin/stats", async (c) => {
  try {
    const r2 = c.env?.VPSAI_R2;
    if (!r2) return c.json({ error: "R2 not configured" }, 500);

    const configObj = await r2.get("config.json");
    let config = { dailyLimit: 0 };
    if (configObj) {
      config = await configObj.json();
    }

    let keys: any[] = [];
    let cursor: string | undefined;
    
    // Fetch all keys (Note: for huge scale, this needs proper pagination in UI, but fine for simple admin)
    do {
      const list = await r2.list({ prefix: "requests/", cursor });
      keys.push(...(list.objects || []));
      cursor = list.truncated ? list.cursor : undefined;
    } while (cursor);

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    const startOfWeekStr = startOfWeek.toISOString().split('T')[0];

    const currentMonthStr = todayStr.substring(0, 7);

    let daily = 0;
    let weekly = 0;
    let monthly = 0;
    const total = keys.length;

    // Sort keys by date descending
    keys.sort((a, b) => b.key.localeCompare(a.key));
    
    const recentRequests = keys.slice(0, 50).map(k => {
      const parts = k.key.split('/');
      const filename = parts[parts.length - 1];
      const time = filename.substring(0, 24);
      const email = filename.substring(25);
      return { email, timestamp: time };
    });

    keys.forEach(k => {
      // name format: requests/YYYY-MM-DD/YYYY-MM-DDTHH:MM:SSZ-email
      const parts = k.key.split('/');
      if (parts.length >= 3) {
        const datePart = parts[1];
        if (datePart === todayStr) daily++;
        if (datePart >= startOfWeekStr) weekly++;
        if (datePart.startsWith(currentMonthStr)) monthly++;
      }
    });

    return c.json({
      success: true,
      stats: { daily, weekly, monthly, total },
      recentRequests,
      config
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

api.post("/admin/config", async (c) => {
  try {
    const { dailyLimit } = await c.req.json();
    const r2 = c.env?.VPSAI_R2;
    if (!r2) return c.json({ error: "R2 not configured" }, 500);

    await r2.put("config.json", JSON.stringify({ dailyLimit: Number(dailyLimit) || 0 }));
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

api.post("/admin/emails", async (c) => {
  try {
    const email = await c.req.json();
    const r2 = c.env?.VPSAI_R2;
    if (!r2) return c.json({ error: "R2 not configured" }, 500);
    
    const key = `emails/${email.accountEmail}/${email.id}.json`;
    
    // Fetch existing to merge if it exists (so we don't overwrite full body with preview)
    const existingObj = await r2.get(key);
    let finalEmail = email;
    if (existingObj) {
      const existing = await existingObj.json();
      finalEmail = { ...existing, ...email };
      // If the new one doesn't have html/text but existing does, keep it
      if (!email.html && existing.html) finalEmail.html = existing.html;
      if (!email.text && existing.text) finalEmail.text = existing.text;
    }

    await r2.put(key, JSON.stringify(finalEmail));
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

api.get("/admin/emails", async (c) => {
  try {
    const r2 = c.env?.VPSAI_R2;
    if (!r2) return c.json({ error: "R2 not configured" }, 500);
    
    let keys: any[] = [];
    let cursor: string | undefined;
    do {
      const list = await r2.list({ prefix: "emails/", cursor });
      keys.push(...(list.objects || []));
      cursor = list.truncated ? list.cursor : undefined;
    } while (cursor);
    
    // Sort by uploaded descending
    keys.sort((a, b) => b.uploaded.getTime() - a.uploaded.getTime());
    
    // Get latest 50
    const topKeys = keys.slice(0, 50);
    const emails = await Promise.all(topKeys.map(async (k) => {
      const obj = await r2.get(k.key);
      if (obj) {
        const data = await obj.json();
        return { ...data, _key: k.key };
      }
      return null;
    }));
    
    return c.json({ success: true, emails: emails.filter(Boolean) });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

api.delete("/admin/emails", async (c) => {
  try {
    const { key } = await c.req.json();
    const r2 = c.env?.VPSAI_R2;
    if (!r2) return c.json({ error: "R2 not configured" }, 500);
    
    await r2.delete(key);
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

api.get("/generator/domains", async (c) => {
  try {
    const { load } = await import("cheerio");
    const response = await fetch("https://generator.email/", {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      },
    });

    const html = await response.text();
    const $ = load(html);
    let domains: string[] = [];

    // Method 1: Look for the dropdown options
    $("select[name='dmn'] option, select#domainName option, .domain-selector option, #domainName option").each((i, el) => {
      const val = $(el).attr("value") || $(el).text();
      if (val && val.includes(".") && !val.includes(" ")) {
        domains.push(val.trim().toLowerCase());
      }
    });

    // Method 2: Look for javascript array if dropdown is empty
    if (domains.length === 0) {
      const match = html.match(/var\s+domains\s*=\s*\[(.*?)\]/i);
      if (match && match[1]) {
        const parsed = match[1].split(',').map(s => s.replace(/['"]/g, '').trim().toLowerCase());
        domains.push(...parsed.filter(d => d.includes('.') && !d.includes(' ')));
      }
    }

    // Method 3: Look for any element with data-domain
    if (domains.length === 0) {
      $("[data-domain]").each((i, el) => {
        const val = $(el).attr("data-domain");
        if (val && val.includes(".")) domains.push(val.trim().toLowerCase());
      });
    }

    // Method 4: Look for any element with class containing 'domain' that looks like a domain
    if (domains.length === 0) {
      $(".domain_btn, .dropdown-item").each((i, el) => {
        const val = $(el).text().trim().toLowerCase();
        if (val && val.includes(".") && !val.includes(" ")) {
          domains.push(val);
        }
      });
    }

    const uniqueDomains = [...new Set(domains)].filter(d => d.length > 3);

    if (uniqueDomains.length > 0) {
      return c.json({ status: "success", domains: uniqueDomains });
    } else {
      // Fallback
      return c.json({
        status: "success",
        domains: ['jymz.xyz', 'tako.skin', 'capcutpro.click', 'clonetrust.com', 'sparkletoc.com', 'theweifamily.icu', 'maildoc.org', 'xuseca.cloud', 'googl.win', 'thip-like.com', 'c-tta.top', 'nowtopzen.com', 'ebarg.net', 'btcmod.com', 'tmxttvmail.com']
      });
    }
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

api.get("/generator/validate", async (c) => {
  const { usr, dmn } = c.req.query();
  if (!usr || !dmn) return c.json({ error: "Missing parameters" }, 400);

  try {
    const response = await fetch("https://generator.email/check_adres_validation3.php", {
      method: "POST",
      headers: {
        "User-Agent": USER_AGENT,
        "X-Requested-With": "XMLHttpRequest",
        "Origin": "https://generator.email",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `usr=${usr}&dmn=${dmn}`,
    });

    const text = await response.text();
    try {
      return c.json(JSON.parse(text));
    } catch (e) {
      return c.json({ status: text.trim().toLowerCase().includes("good") ? "good" : "error", raw: text });
    }
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

api.get("/generator/search", async (c) => {
  const { key } = c.req.query();
  try {
    const response = await fetch(`https://generator.email/search.php?key=${key}`, {
      headers: { "User-Agent": USER_AGENT, "X-Requested-With": "XMLHttpRequest" },
    });
    return c.json(await response.json());
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

api.get("/generator/inbox", async (c) => {
  const { usr, dmn } = c.req.query();
  try {
    const { load } = await import("cheerio");
    const url = `https://generator.email/${dmn}/${usr}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Cookie": `surl=${dmn}/${usr}`,
      },
    });

    const html = await response.text();
    const $ = load(html);
    const emails: any[] = [];

    // Parse the active/latest email (usually displayed as a div, not a link)
    $("#email-table .list-group-item-info").each((i, el) => {
      const from = $(el).find('[class*="from_div"]').text().trim();
      const subject = $(el).find('[class*="subj_div"]').text().trim();
      const time = $(el).find('[class*="time_div"]').text().trim();
      
      if (from) {
        emails.push({
          id: 'active', // Special ID to indicate we should just fetch the main page
          from,
          subject: subject || "(No Subject)",
          date: time || "Recent",
          body_preview: subject || "Click to read",
        });
      }
    });

    // Parse other emails (usually displayed as links)
    $("#email-table a.list-group-item").each((i, el) => {
      const from = $(el).find('[class*="from_div"]').text().trim();
      const subject = $(el).find('[class*="subj_div"]').text().trim();
      const time = $(el).find('[class*="time_div"]').text().trim();
      const href = $(el).attr("href");
      const id = href ? href.split("/").pop() : `msg-${i}`;
      
      if (from) {
        emails.push({
          id,
          from,
          subject: subject || "(No Subject)",
          date: time || "Recent",
          body_preview: subject || "Click to read",
        });
      }
    });

    // Fallback for different layouts
    if (emails.length === 0) {
      $(".e7m.row.msg_list").each((i, el) => {
        const from = $(el).find(".e7m.col-md-3.col-sm-3.col-xs-12").text().trim();
        const subject = $(el).find(".e7m.col-md-9.col-sm-9.col-xs-12").text().trim();
        const link = $(el).find("a").attr("href");
        if (from && subject && link) {
          emails.push({ id: link.split("/").pop(), from, subject, date: "Just now", body_preview: subject });
        }
      });
    }

    return c.json({ status: "success", total: emails.length, emails });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

api.get("/generator/message", async (c) => {
  const { usr, dmn, id } = c.req.query();
  try {
    const { load } = await import("cheerio");
    // If id is 'active', the content is on the main inbox page
    const url = id === 'active' 
        ? `https://generator.email/${dmn}/${usr}`
        : `https://generator.email/${dmn}/${usr}/${id}`;
        
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, "Cookie": `surl=${dmn}/${usr}` },
    });

    const htmlContent = await response.text();
    const $ = load(htmlContent);
    
    // Extract From
    let from = "";
    const fromSpan = $("span:contains('From: ')").next("span").text().trim();
    if (fromSpan) {
        from = fromSpan.split("(sender info)")[0].trim();
    } else {
        from = $(".e7m.from_name").text().trim() || $('[class*="from_div"]').first().text().trim() || "Unknown";
    }

    // Extract Subject
    let subject = "";
    const subjSpan = $("span:contains('Subject: ')").next("div").text().trim();
    if (subjSpan) {
        subject = subjSpan;
    } else {
        subject = $(".e7m.subject_name").text().trim() || $('[class*="subj_div"]').first().text().trim() || "No Subject";
    }

    // Extract Body
    let html = $(".e7m.mess_bodiyy").html() || $(".e7m.message_content").html() || $(".e7m.content_msg").html() || "";
    
    if (!html) {
        html = "<p>No content found. The email might be empty or the layout has changed.</p>";
    }

    return c.json({
      status: "success",
      data: { id, from, subject, date: "Recent", html, text: $(html).text() },
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.route("/api", api);

// In Cloudflare Workers with [assets] configuration, 
// we need to explicitly pass non-API requests to the ASSETS binding
// so that the SPA routing (like /admin) works correctly.

export default {
  async fetch(request: Request, env: any, ctx: any) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api') || url.pathname === '/worker-test') {
      return app.fetch(request, env, ctx);
    }
    // Serve static assets for all other routes
    return env.ASSETS.fetch(request);
  }
};

// For Node.js development environment compatibility
if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
  const { serve } = await import('@hono/node-server');
  const { createServer: createViteServer } = await import('vite');
  
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa'
  });

  serve({
    fetch: async (req) => {
      const url = new URL(req.url);
      if (url.pathname.startsWith('/api') || url.pathname === '/worker-test') {
        return app.fetch(req);
      }
      return new Response(null, { status: 404 }); 
    },
    port: 3000
  });
  
  console.log('Dev server running on http://localhost:3000');
}
