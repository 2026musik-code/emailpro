import { Hono } from "hono";
import { cors } from "hono/cors";

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

    $("#email-table .list-group-item-info, #email-table .list-group-item").each((i, el) => {
      if ($(el).hasClass("active")) return;
      const from = $(el).find('div[class*="from_div"]').text().trim();
      const subject = $(el).find('div[class*="subj_div"]').text().trim();
      const time = $(el).find('div[class*="time_div"]').text().trim();
      const link = $(el).find("a").attr("href") || $(el).attr("onclick")?.match(/'([^']+)'/)?.[1];
      if (from) {
        emails.push({
          id: link ? link.split("/").pop() : `msg-${i}`,
          from,
          subject: subject || "(No Subject)",
          date: time || "Recent",
          body_preview: subject || "Click to read",
        });
      }
    });

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
    const url = `https://generator.email/${dmn}/${usr}/${id}`;
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, "Cookie": `surl=${dmn}/${usr}` },
    });

    const htmlContent = await response.text();
    const $ = load(htmlContent);
    const from = $(".e7m.from_name").text().trim() || "Unknown";
    const subject = $(".e7m.subject_name").text().trim() || "No Subject";
    const html = $(".e7m.message_content").html() || $(".e7m.content_msg").html() || "No content";

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
// Cloudflare will serve static files automatically if no worker route matches.
// We only handle API routes in the worker.

export default app;

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
