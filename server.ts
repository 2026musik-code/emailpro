import express from 'express';
import cors from 'cors';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const PORT = 3000;

// R2 Client Setup
let s3Client: S3Client | null = null;
const BUCKET_NAME = 'dracin';

function getS3Client() {
  if (!s3Client) {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

    if (!accountId || !accessKeyId || !secretAccessKey) {
      console.warn('R2 credentials missing. Storage features will not work.');
      return null;
    }

    s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }
  return s3Client;
}

// Helper to read from R2
async function readFromR2(key: string) {
  const s3 = getS3Client();
  if (!s3) return null;
  try {
    const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key });
    const response = await s3.send(command);
    const str = await response.Body?.transformToString();
    return str ? JSON.parse(str) : null;
  } catch (error: any) {
    if (error.name === 'NoSuchKey') return null;
    console.error('Error reading from R2:', error);
    return null;
  }
}

// Helper to write to R2
async function writeToR2(key: string, data: any) {
  const s3 = getS3Client();
  if (!s3) return false;
  try {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: JSON.stringify(data),
      ContentType: 'application/json'
    });
    await s3.send(command);
    return true;
  } catch (error) {
    console.error('Error writing to R2:', error);
    return false;
  }
}

// API Routes
app.post('/api/generator/validate', async (req, res) => {
  try {
    const { usr, dmn } = req.body;
    const response = await fetch('https://generator.email/check_adres_validation3.php', {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36',
        'X-Requested-With': 'XMLHttpRequest',
        'Origin': 'https://generator.email',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `usr=${usr}&dmn=${dmn}`
    });
    const data = await response.text();
    try {
      res.json(JSON.parse(data));
    } catch {
      res.send(data);
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/generator/inbox', async (req, res) => {
  try {
    const { usr, dmn } = req.query;
    if (!usr || !dmn) {
      return res.status(400).json({ error: 'Missing usr or dmn' });
    }
    console.log(`Fetching inbox for ${usr}@${dmn}`);
    const response = await fetch(`https://generator.email/${dmn}/${usr}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    });
    console.log(`Generator.email fetch status: ${response.status}`);
    if (!response.ok) {
      throw new Error(`Generator.email fetch failed with status ${response.status}`);
    }
    const html = await response.text();
    
    // Logika Simple Scraper untuk mengambil isi tabel email
    const messages = [];
    const regex = /<div class="e7m from_div_45g45gg">(.*?)<\/div>.*?<div class="e7m subj_div_45g45gg">(.*?)<\/div>.*?<div class="e7m time_div_45g45gg">(.*?)<\/div>/gs;
    
    let match;
    while ((match = regex.exec(html)) !== null) {
      messages.push({
        from: match[1].trim(),
        subject: match[2].trim(),
        time: match[3].trim()
      });
    }

    res.json({ 
      email: `${usr}@${dmn}`,
      total: messages.length,
      messages: messages,
      html: html // Keep html for full view if needed
    });
  } catch (error: any) {
    console.error('Error in /api/generator/inbox:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/accounts', async (req, res) => {
  const accounts = await readFromR2('accounts.json') || [];
  res.json(accounts);
});

app.post('/api/accounts', async (req, res) => {
  const { accounts } = req.body;
  const success = await writeToR2('accounts.json', accounts);
  if (success) res.json({ success: true });
  else res.status(500).json({ error: 'Failed to save to R2' });
});

app.get('/api/emails/:accountId', async (req, res) => {
  const { accountId } = req.params;
  const emails = await readFromR2(`emails_${accountId}.json`) || [];
  res.json(emails);
});

app.post('/api/emails/:accountId', async (req, res) => {
  const { accountId } = req.params;
  const { emails } = req.body;
  const success = await writeToR2(`emails_${accountId}.json`, emails);
  if (success) res.json({ success: true });
  else res.status(500).json({ error: 'Failed to save to R2' });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
