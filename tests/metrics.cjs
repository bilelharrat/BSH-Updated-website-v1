'use strict';
/* Size and runtime metrics for the shipped site.
     node tests/metrics.cjs [label] [--compare other-label]
   Sizes: every shipped file, raw / gzip / brotli. Runtime (hermetic,
   Chromium, 1280x800): DOM size, JS heap, main-thread time during load and
   during 4s of idle (the animated terrain), layout shift, long tasks, and the
   cost of scrolling each page top to bottom. Results land in
   tests/.artifacts/metrics/<label>.json. */
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { chromium } = require('@playwright/test');
const { ROOT, PAGES, serve, hermetic, settle } = require('./support.cjs');

const SKIP = new Set(['.git', 'node_modules', 'tests', '.claude']);
const SHIPPED = /\.(html|css|js|svg|webp|avif|jpe?g|png|json|txt|xml|ico|woff2|webmanifest)$/i;
const kind = f => (/\.html$/.test(f) ? 'html' : /\.css$/.test(f) ? 'css' : /\.js$/.test(f) ? 'js'
  : /\.(webp|avif|jpe?g|png)$/i.test(f) ? 'photos' : 'other');

function files(dir = ROOT, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') && e.name !== '.well-known') { if (SKIP.has(e.name) || e.isDirectory()) continue; }
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) files(p, out);
    else if (SHIPPED.test(e.name) && e.name !== 'package.json' && e.name !== 'package-lock.json') out.push(p);
  }
  return out;
}

function sizes() {
  const rows = files().map(p => {
    const buf = fs.readFileSync(p);
    const text = !/\.(webp|avif|jpe?g|png|ico|woff2)$/i.test(p);
    return {
      file: path.relative(ROOT, p), kind: kind(p), raw: buf.length,
      gzip: text ? zlib.gzipSync(buf, { level: 9 }).length : buf.length,
      brotli: text ? zlib.brotliCompressSync(buf, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } }).length : buf.length,
      lines: text ? buf.toString('utf8').split('\n').length : 0,
    };
  });
  const totals = {};
  for (const r of rows) {
    const t = (totals[r.kind] ||= { raw: 0, gzip: 0, brotli: 0, lines: 0, files: 0 });
    t.raw += r.raw; t.gzip += r.gzip; t.brotli += r.brotli; t.lines += r.lines; t.files++;
  }
  const code = { raw: 0, gzip: 0, brotli: 0, lines: 0 };
  for (const k of ['html', 'css', 'js']) for (const m of Object.keys(code)) code[m] += totals[k]?.[m] || 0;
  totals.code = code;
  return { rows, totals };
}

async function runtime(site) {
  const browser = await chromium.launch();
  const out = {};
  try {
    for (const { file } of PAGES) {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await ctx.newPage();
      await hermetic(page, site);
      await page.addInitScript(() => {
        window.__m = { cls: 0, longtasks: 0, longtaskMs: 0 };
        new PerformanceObserver(l => l.getEntries().forEach(e => { if (!e.hadRecentInput) window.__m.cls += e.value; }))
          .observe({ type: 'layout-shift', buffered: true });
        new PerformanceObserver(l => l.getEntries().forEach(e => { window.__m.longtasks++; window.__m.longtaskMs += e.duration; }))
          .observe({ type: 'longtask', buffered: true });
      });
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Performance.enable');
      const metric = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
      await page.goto(site + file);
      await settle(page);
      const loaded = await metric();
      await page.waitForTimeout(4000);
      const idle = await metric();
      const scrollStart = await metric();
      await page.evaluate(async () => {
        const H = document.documentElement.scrollHeight;
        for (let y = 0; y <= H; y += 120) { scrollTo(0, y); await new Promise(r => requestAnimationFrame(r)); }
      });
      const scrolled = await metric();
      const m = await page.evaluate(() => window.__m);
      out[file] = {
        domNodes: loaded.Nodes,
        jsHeapKB: Math.round(loaded.JSHeapUsedSize / 1024),
        loadTaskMs: Math.round(loaded.TaskDuration * 1000),
        loadScriptMs: Math.round(loaded.ScriptDuration * 1000),
        idleCpuPct: +(((idle.TaskDuration - loaded.TaskDuration) / 4) * 100).toFixed(1),
        scrollTaskMs: Math.round((scrolled.TaskDuration - scrollStart.TaskDuration) * 1000),
        layouts: scrolled.LayoutCount,
        styleRecalcs: scrolled.RecalcStyleCount,
        cls: +m.cls.toFixed(4),
        longtasks: m.longtasks,
      };
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
  return out;
}

(async () => {
  const args = process.argv.slice(2);
  const label = args.find(a => !a.startsWith('--')) || 'current';
  const cmpIdx = args.indexOf('--compare');
  const compare = cmpIdx >= 0 ? args[cmpIdx + 1] : null;
  const s = await serve();
  const result = { label, sizes: sizes(), runtime: await runtime(s.url) };
  await s.close();
  const dir = path.join(__dirname, '.artifacts', 'metrics');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${label}.json`), JSON.stringify(result, null, 2));

  const prev = compare && fs.existsSync(path.join(dir, `${compare}.json`))
    ? JSON.parse(fs.readFileSync(path.join(dir, `${compare}.json`), 'utf8')) : null;
  const delta = (a, b) => (b == null ? '' : ` (${a - b >= 0 ? '+' : ''}${Number.isInteger(a - b) ? a - b : (a - b).toFixed(1)})`);

  console.log(`\n== Sizes: ${label}${prev ? ` vs ${compare}` : ''}`);
  for (const [k, t] of Object.entries(result.sizes.totals)) {
    const p = prev?.sizes.totals[k];
    console.log(`${k.padEnd(7)} raw ${String(t.raw).padStart(9)}${delta(t.raw, p?.raw)}  gzip ${String(t.gzip).padStart(8)}${delta(t.gzip, p?.gzip)}  br ${String(t.brotli).padStart(8)}${delta(t.brotli, p?.brotli)}${t.lines ? `  lines ${t.lines}${delta(t.lines, p?.lines)}` : ''}`);
  }
  console.log('\nfile                         raw     gzip');
  for (const r of result.sizes.rows.filter(r => r.kind !== 'photos')) {
    const p = prev?.sizes.rows.find(x => x.file === r.file);
    console.log(`${r.file.padEnd(24)} ${String(r.raw).padStart(8)}${delta(r.raw, p?.raw)} ${String(r.gzip).padStart(8)}${delta(r.gzip, p?.gzip)}`);
  }
  console.log(`\n== Runtime (hermetic Chromium 1280x800)`);
  for (const [f, r] of Object.entries(result.runtime)) {
    const p = prev?.runtime[f];
    console.log(`${f.padEnd(16)} ${Object.entries(r).map(([k, v]) => `${k} ${v}${p ? delta(v, p[k]) : ''}`).join('  ')}`);
  }
})().catch(e => { console.error(e); process.exit(1); });
