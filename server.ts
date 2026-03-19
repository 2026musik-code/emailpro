import express from "express";
import path from "node:path";
import cors from "cors";
import * as cheerio from "cheerio";
import serverless from "serverless-http";
import { getAssetFromKV } from "@cloudflare/kv-asset-handler";
// @ts-ignore
import manifestJSON from "__STATIC_CONTENT_MANIFEST";
const assetManifest = JSON.parse(manifestJSON);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  const USER_AGENT = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36';

  // --- API ROUTES START ---
  // We use a dedicated router for /api to ensure it's handled separately
  const apiRouter = express.Router();

  // Health check
  apiRouter.get(['/health', '/health/'], (req, res) => {
    res.json({ 
      status: "ok", 
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    });
  });

  // Proxy routes for generator.email
  apiRouter.get(['/generator/validate', '/generator/validate/'], async (req, res) => {
    console.log(`[API] Validate request: ${req.query.usr}@${req.query.dmn}`);
    try {
      const { usr, dmn } = req.query;
      if (!usr || !dmn) {
        return res.status(400).json({ error: 'Missing parameters' });
      }

      const response = await fetch('https://generator.email/check_adres_validation3.php', {
        method: 'POST',
        headers: {
          'User-Agent': USER_AGENT,
          'X-Requested-With': 'XMLHttpRequest',
          'Origin': 'https://generator.email',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: `usr=${usr}&dmn=${dmn}`
      });
      
      const text = await response.text();
      console.log(`[API] Generator response: ${text.substring(0, 50)}`);
      
      try {
        const data = JSON.parse(text);
        res.json(data);
      } catch (e) {
        res.json({ status: text.trim().toLowerCase().includes('good') ? 'good' : 'error', raw: text });
      }
    } catch (error: any) {
      console.error('Error in /api/generator/validate:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  apiRouter.get(['/generator/search', '/generator/search/'], async (req, res) => {
    try {
      const { key } = req.query;
      const response = await fetch(`https://generator.email/search.php?key=${key}`, {
        headers: {
          'User-Agent': USER_AGENT,
          'X-Requested-With': 'XMLHttpRequest'
        }
      });
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error('Error in /api/generator/search:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  apiRouter.get(['/generator/inbox', '/generator/inbox/'], async (req, res) => {
    try {
      const { usr, dmn } = req.query;
      const url = `https://generator.email/${dmn}/${usr}`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Cookie': `surl=${dmn}/${usr}`
        }
      });

      const html = await response.text();
      const $ = cheerio.load(html);
      const emails: any[] = [];

      // 1. Try parsing using the structure provided by the user (dynamic classes)
      $('#email-table .list-group-item-info, #email-table .list-group-item').each((i, el) => {
        // Skip the header row if it's there
        if ($(el).hasClass('active')) return;

        const from = $(el).find('div[class*="from_div"]').text().trim();
        const subject = $(el).find('div[class*="subj_div"]').text().trim();
        const time = $(el).find('div[class*="time_div"]').text().trim();
        const link = $(el).find('a').attr('href') || $(el).attr('onclick')?.match(/'([^']+)'/)?.[1];
        
        if (from) {
          const id = link ? link.split('/').pop() : `msg-${i}`;
          emails.push({
            id,
            from,
            subject: subject || '(No Subject)',
            date: time || 'Recent',
            body_preview: subject || 'Click to read'
          });
        }
      });

      // 2. Fallback: Parse the inbox table/list (common generator.email structure)
      if (emails.length === 0) {
        $('.e7m.row.msg_list').each((i, el) => {
          const from = $(el).find('.e7m.col-md-3.col-sm-3.col-xs-12').text().trim();
          const subject = $(el).find('.e7m.col-md-9.col-sm-9.col-xs-12').text().trim();
          const link = $(el).find('a').attr('href');
          
          if (from && subject && link) {
            const id = link.split('/').pop();
            emails.push({
              id,
              from,
              subject,
              date: 'Just now',
              body_preview: subject
            });
          }
        });
      }

      // 3. Second Fallback: Dropdown items
      if (emails.length === 0) {
        $('.e7m.dropdown-item.waves-effect').each((i, el) => {
          const text = $(el).text().trim();
          const href = $(el).attr('href');
          if (href && href !== '/' && text !== 'No recent mailbox') {
            const parts = text.split(' - ');
            emails.push({
              id: href.split('/').pop(),
              from: parts[0] || 'Unknown',
              subject: parts[1] || 'No Subject',
              date: 'Recent',
              body_preview: text
            });
          }
        });
      }

      res.json({ status: "success", total: emails.length, emails });
    } catch (error: any) {
      console.error('Error in /api/generator/inbox:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  apiRouter.get(['/generator/message', '/generator/message/'], async (req, res) => {
    try {
      const { usr, dmn, id } = req.query;
      const url = `https://generator.email/${dmn}/${usr}/${id}`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Cookie': `surl=${dmn}/${usr}`
        }
      });

      const htmlContent = await response.text();
      const $ = cheerio.load(htmlContent);
      
      // Extract message details
      const from = $('.e7m.from_name').text().trim() || 'Unknown';
      const subject = $('.e7m.subject_name').text().trim() || 'No Subject';
      const html = $('.e7m.message_content').html() || $('.e7m.content_msg').html() || 'No content';

      res.json({
        status: "success",
        data: {
          id,
          from,
          subject,
          date: 'Recent',
          html,
          text: $(html).text()
        }
      });
    } catch (error: any) {
      console.error('Error in /api/generator/message:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Mount the API router
  app.use('/api', apiRouter);
  // --- API ROUTES END ---

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else if (!process.env.CLOUDFLARE_WORKER) {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // For standard Node environments
  if (process.env.NODE_ENV !== "production" || !process.env.CLOUDFLARE_WORKER) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }

  // Return the app for the handler
  return app;
}

// For Cloudflare Workers compatibility
const serverPromise = startServer();
let handler: any;

export default {
  async fetch(request: Request, env: any, ctx: any) {
    const url = new URL(request.url);
    
    // 1. Handle API routes via Express
    if (url.pathname.startsWith('/api')) {
      if (!handler) {
        const app = await serverPromise;
        handler = serverless(app, { binary: true });
      }
      return handler(request, env, ctx);
    }
    
    // 2. Handle static assets via Cloudflare KV (Production only)
    if (process.env.NODE_ENV === "production") {
      try {
        return await getAssetFromKV(
          { request, waitUntil: ctx.waitUntil.bind(ctx) },
          {
            ASSET_NAMESPACE: env.__STATIC_CONTENT,
            ASSET_MANIFEST: assetManifest,
          }
        );
      } catch (e) {
        // Fallback to index.html for SPA routing
        try {
          return await getAssetFromKV(
            { request, waitUntil: ctx.waitUntil.bind(ctx) },
            {
              ASSET_NAMESPACE: env.__STATIC_CONTENT,
              ASSET_MANIFEST: assetManifest,
              mapRequestToAsset: (req: any) => new Request(`${new URL(req.url).origin}/index.html`, req),
            }
          );
        } catch (e2) {
          return new Response("Not Found", { status: 404 });
        }
      }
    }
    
    // 3. Fallback for development (Standard Express/Vite)
    if (!handler) {
      const app = await serverPromise;
      handler = serverless(app, { binary: true });
    }
    return handler(request, env, ctx);
  }
};
