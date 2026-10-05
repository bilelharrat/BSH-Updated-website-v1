'use strict';
/* Regression tests for the round-1 stress findings in the markup and the
   stylesheet: layout at the edges (narrow phones, landscape, short windows,
   notches), contrast, forced colours, reduced motion and launch files. */
const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('./fixtures.cjs');
const { PAGES, ROOT, settle } = require('./support.cjs');

const overflowX = page => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const rect = (page, sel) => page.locator(sel).first().evaluate(el => el.getBoundingClientRect().toJSON());
const overlap = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
  Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
const finished = page => page.evaluate(() => Promise.all(document.getAnimations().map(a => a.finished.catch(() => {}))));

test.describe('photo viewer', () => {
  for (const [width, height] of [[1280, 800], [1920, 1080], [844, 390], [390, 844]]) {
    test(`the photo fits between the bars @${width}x${height}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto('events.html');
      await settle(page);
      await page.locator('button.album').first().click();
      const img = page.locator('.lb-stage img');
      await expect(img).toBeVisible();
      await img.evaluate(i => i.decode().catch(() => {}));
      await finished(page); // measure both boxes at once, after the viewer's opening motion
      const [stage, box] = await page.evaluate(() => ['.lb-stage', '.lb-stage img']
        .map(s => document.querySelector(s).getBoundingClientRect().toJSON()));
      expect(box.height).toBeGreaterThan(50);
      expect(box.top).toBeGreaterThanOrEqual(stage.top - 1);
      expect(box.bottom).toBeLessThanOrEqual(stage.bottom + 1);
      expect(box.bottom).toBeLessThanOrEqual(height);
    });
  }
});

test.describe('mountain hero', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } });

  test('no legend card covers another pin from 280px to 1280px', async ({ page }) => {
    for (const width of [280, 300, 320, 340, 350, 360, 375, 390, 400, 420, 600, 860, 1024, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('index.html');
      await settle(page);
      await finished(page);
      const pins = await page.locator('.pin').evaluateAll(els => els.map(el => ({
        name: el.className,
        card: el.querySelector('.peak-card').getBoundingClientRect().toJSON(),
        stem: el.querySelector('.pin-stem').getBoundingClientRect().toJSON(),
        dot: el.querySelector('.pin-dot').getBoundingClientRect().toJSON(),
      })));
      for (const a of pins) {
        expect(a.card.left, `${a.name} on screen @${width}`).toBeGreaterThanOrEqual(0);
        expect(a.card.right, `${a.name} on screen @${width}`).toBeLessThanOrEqual(width);
        for (const b of pins) {
          if (a === b) continue;
          for (const part of ['dot', 'stem', 'card']) {
            expect(overlap(a.card, b[part]), `${a.name} card over ${b.name} ${part} @${width}`).toBe(0);
          }
        }
      }
    }
  });

  test('home pillar photos keep a 16:10 frame on phones', async ({ page }) => {
    for (const width of [390, 600]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('index.html');
      await settle(page, { eager: true });
      const ratios = await page.locator('.pillar-photo').evaluateAll(els => els.map(el => el.offsetWidth / el.offsetHeight));
      expect(ratios).toHaveLength(3);
      for (const r of ratios) expect(Math.abs(r - 1.6), `ratio ${r} @${width}`).toBeLessThan(0.02);
    }
  });
});

test('with reduced motion the hero pins are visible from the first frame', async ({ browser, site }) => {
  const context = await browser.newContext({ baseURL: site, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto('index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(150);
  const opacities = await page.locator('.pin').evaluateAll(els => els.map(el => Number(getComputedStyle(el).opacity)));
  expect(opacities).toEqual([1, 1, 1]);
  await context.close();
});

test.describe('header', () => {
  for (const width of [280, 300, 320, 360, 441, 444, 461, 470, 481]) {
    test(`brand, Join and Menu fit @${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      for (const file of ['index.html', 'join.html']) {
        await page.goto(file);
        await settle(page);
        expect(await overflowX(page), `${file} @${width}`).toBe(0);
        const menu = await rect(page, '.hdr-menu');
        expect(menu.right, `${file} menu @${width}`).toBeLessThanOrEqual(width);
      }
    });
  }
});

test('landscape notch: content clears the safe-area insets', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { left: 59, right: 59, top: 0, bottom: 21 } });
  for (const file of ['index.html', 'join.html', 'events.html']) {
    await page.goto(file);
    await settle(page);
    for (const sel of ['.brand', 'h1', '.hdr-menu']) {
      const r = await rect(page, sel);
      expect(r.left, `${file} ${sel}`).toBeGreaterThanOrEqual(59);
      expect(r.right, `${file} ${sel}`).toBeLessThanOrEqual(844 - 59);
    }
  }
});

test('foundation cards fit a 280px screen', async ({ page }) => {
  for (const width of [280, 300, 320]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('foundation.html');
    await settle(page);
    expect(await overflowX(page), `@${width}`).toBe(0);
    for (const r of await page.locator('.duo-card').evaluateAll(els => els.map(el => el.getBoundingClientRect().right))) {
      expect(r).toBeLessThanOrEqual(width);
    }
  }
});

test('a long single-word first name wraps in the thank-you heading', async ({ page }) => {
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(`join.html?w=${width}#cxo`);
    await settle(page);
    for (const [id, v] of Object.entries({
      'first-name': 'Wolfeschlegelsteinhausenbergerdorff', 'last-name': 'Lovelace', organization: 'Engines',
      email: 'ada@example.com', phone: '5105550100', linkedin: 'linkedin.com/in/ada',
    })) await page.locator(`#${id}`).fill(v);
    await page.locator('#join-form [type="submit"]').click();
    await expect(page.locator('#join-success')).toBeVisible();
    expect(await overflowX(page), `@${width}`).toBe(0);
    const [h, col] = [await rect(page, '#join-success .h2'), await rect(page, '#join-success')];
    expect(h.right, `@${width}`).toBeLessThanOrEqual(col.right + 1);
  }
});

test('sticky panels fit the window while stuck, or do not stick', async ({ page }) => {
  const cases = [['join.html', '.join-side', 1280, 600], ['join.html', '.join-side', 1920, 700], ['join.html', '.join-side', 1366, 640],
    ['join.html', '.join-side', 1280, 800], ['index.html', '.router-a', 1280, 500], ['index.html', '.router-a', 1024, 600],
    ['index.html', '.router-a', 1280, 800]];
  for (const [file, sel, width, height] of cases) {
    await page.setViewportSize({ width, height });
    await page.goto(file);
    await settle(page);
    for (const route of file === 'index.html' ? ['founder', 'investor', 'cxo', 'scholar', 'scout', 'young', 'curious'] : [null]) {
      if (route) await page.locator(`[data-route="${route}"]`).click();
      const { sticky, need } = await page.locator(sel).evaluate(el => {
        const cs = getComputedStyle(el);
        return { sticky: cs.position === 'sticky', need: parseFloat(cs.top) + el.offsetHeight };
      });
      if (sticky) expect(need, `${file} ${sel} ${route || ''} @${width}x${height}`).toBeLessThanOrEqual(height);
    }
  }
});

test('muted text meets 4.5:1 on every field', async ({ page }) => {
  await page.goto('index.html');
  const ratios = await page.evaluate(() => {
    const ch = s => s.match(/[\d.]+/g).map(Number);
    const lum = ([r, g, b]) => [r, g, b].map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; })
      .reduce((s, v, i) => s + v * [.2126, .7152, .0722][i], 0);
    const out = {};
    for (const field of ['f-paper', 'f-stone', 'f-night', 'f-cobalt', 'f-poppy', 'f-gold']) {
      const box = document.body.appendChild(document.createElement('div'));
      box.className = field;
      for (const token of ['--fg-2', '--fg-3', '--ink-3']) {
        const t = box.appendChild(document.createElement('span'));
        t.style.color = `var(${token})`;
        const bg = ch(getComputedStyle(box).backgroundColor);
        const [r, g, b, a = 1] = ch(getComputedStyle(t).color);
        const fg = [r, g, b].map((v, i) => v * a + bg[i] * (1 - a));
        const [L1, L2] = [lum(fg), lum(bg)].sort((x, y) => y - x);
        if (token !== '--ink-3' || ['f-paper', 'f-stone'].includes(field)) out[`${field} ${token}`] = (L1 + .05) / (L2 + .05);
      }
      box.remove();
    }
    return out;
  });
  for (const [k, r] of Object.entries(ratios)) expect(r, k).toBeGreaterThanOrEqual(4.5);
});

test('join fields show a focus ring in forced colours', async ({ browser, site }) => {
  const context = await browser.newContext({ baseURL: site, forcedColors: 'active' });
  const page = await context.newPage();
  await page.goto('join.html');
  for (const id of ['first-name', 'email', 'phone', 'linkedin']) {
    const f = page.locator(`#${id}`);
    await f.focus();
    const o = await f.evaluate(el => ({ style: getComputedStyle(el).outlineStyle, width: parseFloat(getComputedStyle(el).outlineWidth) }));
    expect(o.style, id).not.toBe('none');
    expect(o.width, id).toBeGreaterThanOrEqual(2);
  }
  await context.close();
});

test.describe('launch files', () => {
  const ORIGIN = 'https://berkeleysummithouse.org/';
  for (const { file } of PAGES) {
    test(`${file} has canonical, Open Graph and touch-icon tags`, async ({ page }) => {
      await page.goto(file);
      const url = file === 'index.html' ? ORIGIN : ORIGIN + file;
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', url);
      await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', url);
      await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /\S/);
      await expect(page.locator('meta[property="og:description"]')).toHaveAttribute('content', /\S/);
      await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', new RegExp(`^${ORIGIN}assets/.+\\.(png|jpe?g)$`));
      await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
      const touch = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
      expect(fs.existsSync(path.join(ROOT, touch.split('?')[0]))).toBe(true);
      const og = (await page.locator('meta[property="og:image"]').getAttribute('content')).slice(ORIGIN.length);
      expect(fs.existsSync(path.join(ROOT, og))).toBe(true);
    });
  }

  test('robots.txt points at a sitemap of every page', async ({ request }) => {
    const robots = await (await request.get('robots.txt')).text();
    expect(robots).toMatch(/^Sitemap: https:\/\/berkeleysummithouse\.org\/sitemap\.xml$/m);
    const sitemap = await (await request.get('sitemap.xml')).text();
    for (const { file } of PAGES) expect(sitemap).toContain(`<loc>https://berkeleysummithouse.org/${file === 'index.html' ? '' : file}</loc>`);
  });

  test.describe(() => {
    test.use({ allowErrors: true });
    test('a missing page gets the branded 404 with the site chrome', async ({ page, errors }) => {
      const res = await page.goto('no/such/page');
      expect(res.status()).toBe(404);
      await settle(page);
      await expect(page.locator('header.hdr')).toBeVisible();
      await expect(page.locator('footer.ftr')).toBeVisible();
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('main#main a[href="index.html"]')).toHaveCount(1);
      // The page's own 404 is expected; any other failed request is listed as "HTTP 4xx <url>".
      expect(errors.filter(e => !e.includes('/no/such/page') && !/^console: .*status of 404/.test(e))).toEqual([]);
    });
  });
});
