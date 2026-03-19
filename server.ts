import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/cloudflare-workers";
import * as cheerio from "cheerio";

const app = new Hono();

// Middleware
app.use("*", cors());

const USER_AGENT = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36';

// --- API ROUTES ---
const api = new Hono();

// Health check
api.get("/health", (c) => {
  return c.json({
    status: "ok",
    environment: process.env.NODE_ENV || "production",
    timestamp: new Date().toISOString(),
  });
});

// Proxy routes for generator.email
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
    const url = `https://generator.email/${dmn}/${usr}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Cookie": `surl=${dmn}/${usr}`,
      },
    });

    const html = await response.text();
    const $ = cheerio.load(html);
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

    // Fallbacks
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
    const url = `https://generator.email/${dmn}/${usr}/${id}`;
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, "Cookie": `surl=${dmn}/${usr}` },
    });

    const htmlContent = await response.text();
    const $ = cheerio.load(htmlContent);
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

// --- STATIC ASSETS & DEV MODE ---
if (process.env.NODE_ENV === "production") {
  // Serve static files from Cloudflare KV
  app.get("/assets/*", serveStatic({ root: "./" }));
  app.get("/index.html", serveStatic({ path: "./index.html" }));
  app.get("/", serveStatic({ path: "./index.html" }));
  // SPA fallback
  app.get("*", serveStatic({ path: "./index.html" }));
} else {
  // Dev mode helper (Node.js)
  // This part will be handled by the dev server script
}

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
    fetch: (req) => {
      const url = new URL(req.url);
      if (url.pathname.startsWith('/api')) {
        return app.fetch(req);
      }
      // For everything else, let Vite handle it in dev
      return new Response(null, { status: 404 }); // Vite middleware handles this via the raw node server
    },
    port: 3000
  });
  
  console.log('Dev server running on http://localhost:3000');
}
