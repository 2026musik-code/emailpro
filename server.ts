import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import cors from "cors";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Proxy routes for generator.email
  app.post('/api/generator/validate', async (req, res) => {
    try {
      const { usr, dmn } = req.body;
      const response = await axios.post('https://generator.email/check_adres_validation3.php', 
        `usr=${usr}&dmn=${dmn}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36',
            'X-Requested-With': 'XMLHttpRequest',
            'Origin': 'https://generator.email',
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      res.json(response.data);
    } catch (error: any) {
      console.error('Error in /api/generator/validate:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/generator/search', async (req, res) => {
    try {
      const { key } = req.query;
      const response = await axios.get(`https://generator.email/search.php?key=${key}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });
      res.json(response.data);
    } catch (error: any) {
      console.error('Error in /api/generator/search:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/generator/inbox', async (req, res) => {
    try {
      const { usr, dmn } = req.query;
      const response = await axios.get(`https://generator.email/${dmn}/${usr}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
        }
      });
      res.send(response.data);
    } catch (error: any) {
      console.error('Error in /api/generator/inbox:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
