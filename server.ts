import express from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import {
  handleAnalyzePhotos,
  handleBlobClientUpload,
  handleBlobDelete,
  handleBlobUpload,
  handleGenerateCopy,
  handleHealth,
} from './api/_shared.js';

dotenv.config();

const PORT = Number(process.env.PORT || 3000);
const UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_ROOT)) {
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '35mb' }));

  // Serve locally persisted preview uploads with strict directory confinement
  app.use('/uploads', express.static(UPLOAD_ROOT, {
    dotfiles: 'deny',
    maxAge: '7d',
  }));

  app.get('/api/health', (_req, res) => handleHealth(res));

  // Dynamic SEO robots.txt (disallows admin & private routes)
  app.get('/robots.txt', (req, res) => {
    const baseUrl =
      process.env.APP_URL && process.env.APP_URL !== 'MY_APP_URL'
        ? process.env.APP_URL.replace(/\/$/, '')
        : `${req.protocol}://${req.get('host')}`;
    res.type('text/plain').send(
      [
        'User-agent: *',
        'Allow: /',
        'Disallow: /admin',
        'Disallow: /admin/',
        'Disallow: /login',
        'Disallow: /api/',
        `Sitemap: ${baseUrl}/sitemap.xml`,
      ].join('\n')
    );
  });

  // Dynamic SEO sitemap.xml
  app.get('/sitemap.xml', (req, res) => {
    const baseUrl =
      process.env.APP_URL && process.env.APP_URL !== 'MY_APP_URL'
        ? process.env.APP_URL.replace(/\/$/, '')
        : `${req.protocol}://${req.get('host')}`;
    const staticPaths = ['/', '/imoveis', '/empreendimentos', '/sobre', '/privacidade'];
    const urls = staticPaths
      .map(
        (p) =>
          `<url><loc>${baseUrl}${p}</loc><changefreq>daily</changefreq><priority>${p === '/' ? '1.0' : '0.8'}</priority></url>`
      )
      .join('');
    res.type('application/xml').send(
      `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`
    );
  });

  app.post('/api/blob/client-upload', (req, res) => handleBlobClientUpload(req, res));
  app.post('/api/blob/upload', (req, res) => handleBlobUpload(req, res, UPLOAD_ROOT));
  app.delete('/api/blob/delete', (req, res) => handleBlobDelete(req, res, UPLOAD_ROOT));
  app.post('/api/ai/analyze-photos', (req, res) => handleAnalyzePhotos(req, res, UPLOAD_ROOT));
  app.post('/api/ai/generate-copy', (req, res) => handleGenerateCopy(req, res));

  // Vite dev middleware vs static dist
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
