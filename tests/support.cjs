'use strict';
/* Shared test plumbing: a static server on a free port, hermetic network
   rules, and page helpers. Used by the specs, metrics.cjs and ad-hoc
   stress scripts (require('./tests/support.cjs')). */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

const PAGES = [
  { file: 'index.html', key: 'home' },
  { file: 'story.html', key: 'story' },
  { file: 'ventures.html', key: 'ventures' },
  { file: 'incubator.html', key: 'incubator' },
  { file: 'foundation.html', key: 'foundation' },
  { file: 'events.html', key: 'events' },
  { file: 'join.html', key: 'join' },
];

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.avif': 'image/avif',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml', '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
};

/* Serve the site root on 127.0.0.1:<free port>. Missing files get 404.html
   (when present) with a 404 status, the way static hosts behave. */
function serve(root = ROOT) {
  const server = http.createServer((req, res) => {
    let rel;
    try { rel = decodeURIComponent(new URL(req.url, 'http://x').pathname); }
    catch { res.writeHead(400).end(); return; }
    let file = path.join(root, rel);
    if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
    if (rel.endsWith('/')) file = path.join(file, 'index.html');
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) {
        const nf = path.join(root, '404.html');
        if (fs.existsSync(nf)) {
          res.writeHead(404, { 'content-type': TYPES['.html'] });
          fs.createReadStream(nf).pipe(res);
        } else res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
        return;
      }
      res.writeHead(200, {
        'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'cache-control': 'no-store',
      });
      fs.createReadStream(file).pipe(res);
    });
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({
    url: `http://127.0.0.1:${server.address().port}/`,
    close: () => new Promise(r => { server.closeAllConnections?.(); server.close(r); }),
  })));
}

/* A neutral stand-in for every photo, so screenshots never depend on the
   network or on which file a photo is served from. */
const STUB_IMAGE = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1067" viewBox="0 0 1600 1067">' +
  '<rect width="1600" height="1067" fill="#9AA3A8"/><circle cx="800" cy="533" r="300" fill="#7D878D"/></svg>');

/* Hermetic mode: web fonts resolve to nothing (system fallbacks render),
   every photo is the stub above, and any other off-site request is answered
   empty and recorded in page.__external. */
async function hermetic(page, base) {
  page.__external = [];
  await page.route('**/*', route => {
    const req = route.request();
    const url = req.url();
    if (/^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(url)) {
      return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    }
    if (req.resourceType() === 'image' && !/favicon\.svg(\?|$)/.test(url)) {
      return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: STUB_IMAGE });
    }
    if (base && !url.startsWith(base) && !url.startsWith('data:')) {
      page.__external.push(url);
      return route.fulfill({ status: 204, body: '' });
    }
    return route.continue();
  });
}

/* Wait until fonts, images and the terrain canvases have settled. */
async function settle(page, { eager = false } = {}) {
  await page.waitForLoadState('load');
  await page.evaluate(async eagerImages => {
    if (eagerImages) document.querySelectorAll('img[loading="lazy"]').forEach(i => { i.loading = 'eager'; });
    await document.fonts?.ready;
    // Lazy photos that haven't been asked for yet would never settle.
    const pending = [...document.images].filter(i => !i.complete && (eagerImages || i.loading !== 'lazy'));
    await Promise.race([
      Promise.all(pending.map(i => new Promise(r => { i.addEventListener('load', r, { once: true }); i.addEventListener('error', r, { once: true }); }))),
      new Promise(r => setTimeout(r, 5000)),
    ]);
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  }, eager);
  await page.waitForFunction(() => [...document.querySelectorAll('canvas')].every(c => {
    const r = c.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return true;
    if (!c.width || !c.height) return false;
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    for (let i = 3; i < d.length; i += 4) if (d[i]) return true;
    return false;
  }), null, { timeout: 10_000 });
  await page.waitForTimeout(80);
}

/* In-page helpers, installed with page.evaluate(INK) style calls. */
const inked = canvas => {
  if (!canvas.width || !canvas.height) return 0;
  const d = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i]) n++;
  return n;
};
const canvasHash = canvas => {
  if (!canvas.width || !canvas.height) return 0;
  const d = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  let h = 0;
  for (let i = 3; i < d.length; i += 4) h = (h * 31 + d[i] * (i % 997)) | 0;
  return h;
};

module.exports = { ROOT, PAGES, serve, hermetic, settle, inked, canvasHash, STUB_IMAGE };
