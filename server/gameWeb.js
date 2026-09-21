import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const assetExtensions = new Set([
  '.html', '.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif',
  '.ico', '.svg', '.ttf', '.otf', '.woff', '.woff2', '.mp3', '.wav', '.m4a',
  '.aac', '.ogg', '.mp4', '.webm',
]);

export const gameWebContentSecurityPolicy = [
  "default-src 'none'",
  "script-src 'self'",
  // React Native Web inserts runtime styles and inline element styles.
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self' wss://ninebelow.potterwell.com",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "media-src 'self' data: blob:",
  "manifest-src 'self'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

// This router is deliberately rooted under /play, never at the server root:
// an unknown browser route cannot swallow an API, admin, or support endpoint.
export function createGameWebRouter({ directory = new URL('./game-public/', import.meta.url) } = {}) {
  const router = express.Router();
  const root = directory instanceof URL ? directory : path.resolve(directory);
  const indexFile = root instanceof URL ? new URL('index.html', root) : path.join(root, 'index.html');
  const available = fs.existsSync(indexFile);

  router.use((req, res, next) => {
    res.setHeader('Content-Security-Policy', gameWebContentSecurityPolicy);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('Cache-Control', 'no-store');
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.setHeader('Allow', 'GET, HEAD');
      return res.sendStatus(405);
    }
    if (!available) return res.status(503).type('text').send('The browser game is not available on this deployment yet.');
    let pathname;
    try { pathname = decodeURIComponent(req.path); } catch { return res.sendStatus(400); }
    // Block source maps, source/config files, hidden files, and traversal before
    // static serving or SPA fallback. Only browser-export asset types are public.
    if (pathname.split(/[\\/]/).some(segment => segment.startsWith('.'))) return res.sendStatus(404);
    const extension = path.extname(pathname).toLowerCase();
    if (extension && !assetExtensions.has(extension)) return res.sendStatus(404);
    if (req.originalUrl.split('?')[0] === '/play') {
      const query = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
      return res.redirect(308, `/play/${query}`);
    }
    return next();
  });

  router.use(express.static(root instanceof URL ? fileURLToPath(root) : root, {
    index: 'index.html', dotfiles: 'deny', redirect: false,
    setHeaders(res, file) {
      res.setHeader('Cache-Control', path.extname(file) === '.html' ? 'no-store' : 'public, max-age=3600');
    },
  }));
  router.get('*', (req, res) => {
    if (path.extname(req.path) || !req.accepts('html')) return res.sendStatus(404);
    return res.sendFile(indexFile instanceof URL ? fileURLToPath(indexFile) : indexFile, { cacheControl: false });
  });
  return router;
}
