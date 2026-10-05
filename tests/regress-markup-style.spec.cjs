'use strict';
/* Regression tests for the round-1 stress findings in the markup and the
   stylesheet: layout at the edges (narrow phones, landscape, short windows,
   notches), contrast, forced colours, reduced motion and launch files. */
const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('./fixtures.cjs');
const { PAGES, ROOT, settle, hermetic } = require('./support.cjs');

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

/* ---------- Round 2 stress findings ----------------------------------------- */
test.describe('round 2', () => {
  test('the photo viewer keeps a usable photo on short windows (400% zoom) and the caption scrolls into view', async ({ page }) => {
    for (const [width, height] of [[320, 200], [320, 256], [427, 240]]) {
      await page.setViewportSize({ width, height });
      await page.goto('events.html');
      await settle(page);
      await page.locator('button.album').first().click();
      const img = page.locator('.lb-stage img');
      await expect(img).toBeVisible();
      await finished(page);
      const box = await rect(page, '.lb-stage img');
      expect(box.height, `photo @${width}x${height}`).toBeGreaterThanOrEqual(Math.min(140, height * .6));
      await page.locator('.lb-cap').scrollIntoViewIfNeeded();
      const cap = await rect(page, '.lb-cap');
      expect(cap.bottom, `caption @${width}x${height}`).toBeLessThanOrEqual(height + 1);
      await page.keyboard.press('Escape');
    }
  });

  test('the home "Around the table" heading row stays in the page column on wide screens', async ({ page }) => {
    for (const width of [1440, 1920, 2560]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('index.html');
      await settle(page);
      const [row, ref] = await page.evaluate(() => {
        const h = [...document.querySelectorAll('h2')].find(el => /Around the table/.test(el.textContent));
        return [h.closest('.sec-hd--row'), document.querySelector('.ftr .wrap, footer .wrap') || document.querySelector('main .wrap:not(.sec-hd--row)')]
          .map(el => el.getBoundingClientRect().toJSON());
      });
      expect(Math.abs(row.left - ref.left), `left @${width}`).toBeLessThanOrEqual(1);
      expect(Math.abs(row.right - ref.right), `right @${width}`).toBeLessThanOrEqual(1);
    }
  });

  test('mouse users can still scroll the photo strip at 640px and narrower, where the arrows step aside', async ({ page }) => {
    for (const width of [360, 640]) {
      await page.setViewportSize({ width, height: 700 });
      await page.goto('index.html');
      await settle(page);
      const strip = page.locator('.strip');
      const visible = await page.locator('[data-strip-btn]').first().isVisible();
      const scrollbar = await strip.evaluate(el => getComputedStyle(el).scrollbarWidth);
      expect(visible || scrollbar !== 'none', `arrows or a scrollbar @${width}`).toBe(true);
    }
  });

  test('the home photo strip is in the keyboard tab order on every engine', async ({ page }) => {
    await page.goto('index.html');
    await expect(page.locator('.strip')).toHaveAttribute('tabindex', '0');
  });

  test('without JavaScript every way-in answer is readable and no dead control is shown', async ({ browser, site }) => {
    const context = await browser.newContext({ baseURL: site, javaScriptEnabled: false });
    const page = await context.newPage();
    await hermetic(page, site);
    await page.goto('index.html');
    await expect(page.locator('.router-opt').first()).toBeHidden();
    await expect(page.locator('[data-strip-btn]').first()).toBeHidden();
    for (const route of ['founder', 'investor', 'cxo', 'scholar', 'scout', 'young', 'curious']) {
      await expect(page.locator(`[data-route-panel="${route}"]`), route).toBeVisible();
    }
    await page.goto('events.html');
    await expect(page.locator('[data-filter]')).toBeHidden();
    for (const el of await page.locator('[data-album]').all()) {
      expect(await el.evaluate(e => getComputedStyle(e).pointerEvents)).toBe('none');
    }
    await context.close();
  });

  test('opening the menu reserves the scrollbar gutter so the header does not jump', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 800 });
    await page.goto('ventures.html');
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollbarGutter)).toBe('stable');
  });

  test('forced colours: only the chosen role, year and way-in option look selected', async ({ browser, site }) => {
    const context = await browser.newContext({ baseURL: site, forcedColors: 'active' });
    const page = await context.newPage();
    await hermetic(page, site);
    const look = (loc, sel) => loc.locator(sel).evaluateAll(els => els.map(el => {
      const cs = getComputedStyle(el);
      return [cs.backgroundColor, cs.color, cs.borderTopWidth, cs.borderTopColor].join(' ');
    }));
    await page.goto('join.html');
    await page.locator('label.role', { hasText: 'Founder' }).first().click();
    // The tick's visibility transition reads "hidden" at its very first frame, so poll.
    await expect.poll(() => page.locator('.role-check .i').evaluateAll(els =>
      els.filter(el => getComputedStyle(el).visibility === 'visible').length)).toBe(1);
    const cards = await look(page, '.role-card');
    expect(new Set(cards).size, 'checked card differs').toBe(2);
    await page.goto('events.html');
    await page.locator('[data-filter] button', { hasText: '2026' }).click();
    const seg = await look(page, '[data-filter] button');
    expect(seg.filter(s => s === seg[1]), 'pressed year differs').toHaveLength(1);
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('index.html');
      const opts = await look(page, '.router-opt');
      expect(opts.filter(s => s === opts[0]), `pressed option differs @${width}`).toHaveLength(1);
    }
    await context.close();
  });

  test('the foundation ages read "15 to 35" to screen readers', async ({ page }) => {
    await page.goto('foundation.html');
    await expect(page.locator('.ages-range')).toMatchAriaSnapshot('- paragraph: 15 to 35');
  });
});

/* ---------- Round 3 stress findings ----------------------------------------- */
test.describe('round 3', () => {
  /* WCAG relative-luminance contrast of two computed rgb()/rgba() colours. */
  const contrast = (a, b) => {
    const lum = c => {
      const [r, g, b2] = c.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => v / 255)
        .map(v => (v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4));
      return .2126 * r + .7152 * g + .0722 * b2;
    };
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + .05) / (lo + .05);
  };
  const forced = async (browser, site, colorScheme) => {
    const context = await browser.newContext({ baseURL: site, forcedColors: 'active', colorScheme, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await hermetic(page, site);
    return { context, page };
  };
  const canvasColor = page => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

  test('the photo viewer fits photo, caption and Previous/Next on landscape phones', async ({ browser, site }) => {
    const { devices } = require('@playwright/test');
    for (const name of ['iPhone SE landscape', 'iPhone 15 Pro landscape', 'Pixel 7 landscape']) {
      const context = await browser.newContext({ ...devices[name], baseURL: site, reducedMotion: 'reduce' });
      const page = await context.newPage();
      await hermetic(page, site);
      await page.goto('events.html');
      await settle(page);
      const albums = await page.locator('[data-album]').count();
      for (let a = 0; a < albums; a++) {
        await page.locator('[data-album]').nth(a).evaluate(b => b.click());
        await expect(page.locator('.lb-stage img')).toBeVisible();
        await finished(page);
        const r = await page.evaluate(() => {
          const q = s => document.querySelector(s).getBoundingClientRect();
          return { vh: innerHeight, next: q('[data-lb-step="1"]').bottom, cap: q('.lb-cap').bottom, img: q('.lb-stage img').height };
        });
        expect(r.next, `Next button, album ${a} on ${name}`).toBeLessThanOrEqual(r.vh + 1);
        expect(r.cap, `caption, album ${a} on ${name}`).toBeLessThanOrEqual(r.vh + 1);
        expect(r.img, `photo, album ${a} on ${name}`).toBeGreaterThanOrEqual(100);
        await page.keyboard.press('Escape');
      }
      await context.close();
    }
  });

  test('with classic scrollbars the home photo strip starts on the page column', async ({ playwright, site }) => {
    const browser = await playwright.chromium.launch({ ignoreDefaultArgs: ['--hide-scrollbars'] });
    const page = await browser.newPage({ baseURL: site, reducedMotion: 'reduce' });
    await hermetic(page, site);
    for (const width of [1600, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('index.html');
      await page.addStyleTag({ content: '::-webkit-scrollbar { width: 15px; height: 15px; } ::-webkit-scrollbar-thumb { background: #999; }' });
      await settle(page);
      const r = await page.evaluate(() => {
        const strip = document.querySelector('[data-strip]');
        return {
          bar: innerWidth - document.documentElement.clientWidth,
          heading: strip.closest('section').querySelector('h2').getBoundingClientRect().left,
          photo: strip.firstElementChild.getBoundingClientRect().left,
        };
      });
      expect(r.bar, 'a classic scrollbar takes space').toBeGreaterThan(0);
      expect(Math.abs(r.photo - r.heading), `first photo vs heading @${width}`).toBeLessThanOrEqual(1);
    }
    await browser.close();
  });

  test('print: the hero shares page 1 with the header and the skip link never prints', async ({ page }) => {
    await page.emulateMedia({ media: 'print' });
    for (const [file, grid] of [['index.html', '.home-grid'], ['story.html', '.story-hero']]) {
      await page.goto(file);
      // Chromium moves a whole grid to the next sheet when its stacked rows overflow page 1.
      expect(await page.locator(grid).evaluate(el => getComputedStyle(el).display), file).not.toMatch(/grid/);
      await expect(page.locator('.skip'), file).toBeHidden();
    }
  });

  for (const scheme of ['dark', 'light']) {
    test(`forced colours (${scheme}): the mountain, pins and legend cards stay drawn`, async ({ browser, site }) => {
      const { context, page } = await forced(browser, site, scheme);
      await page.goto('index.html');
      await settle(page);
      const canvas = await canvasColor(page);
      const s = await page.evaluate(() => ({
        base: getComputedStyle(document.querySelector('.summit-base')).fill,
        stems: [...document.querySelectorAll('.pin-stem, .pin-dot')].map(el => getComputedStyle(el).backgroundColor),
        cards: [...document.querySelectorAll('.peak-card')].map(el => [getComputedStyle(el).outlineStyle, parseFloat(getComputedStyle(el).outlineWidth)]),
      }));
      expect(contrast(s.base, canvas), `mountain ${s.base} on ${canvas}`).toBeGreaterThanOrEqual(3);
      for (const c of s.stems) expect(contrast(c, canvas), `stem/dot ${c} on ${canvas}`).toBeGreaterThanOrEqual(3);
      for (const [style, width] of s.cards) {
        expect(style).not.toBe('none');
        expect(width).toBeGreaterThanOrEqual(1);
      }
      await context.close();
    });

    test(`forced colours (${scheme}): current page, current chapter and button edges stay visible`, async ({ browser, site }) => {
      const { context, page } = await forced(browser, site, scheme);
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto('story.html');
      await settle(page);
      await page.locator('.chapter').nth(1).scrollIntoViewIfNeeded();
      await expect(page.locator('.rail a[aria-current="true"]')).toHaveCount(1);
      const canvas = await canvasColor(page);
      const s = await page.evaluate(() => {
        const pseudo = (sel, p) => getComputedStyle(document.querySelector(sel), p).backgroundColor;
        const look = el => { const cs = getComputedStyle(el), b = getComputedStyle(el.querySelector('b'));
          return [cs.color, b.color, b.textDecorationLine, b.fontWeight].join(' '); };
        return {
          navMark: pseudo('.nav-link[aria-current="page"]', '::after'),
          railTrack: pseudo('.rail ol', '::before'),
          railProgress: pseudo('.rail ol', '::after'),
          current: look(document.querySelector('.rail a[aria-current="true"]')),
          others: [...document.querySelectorAll('.rail a:not([aria-current="true"])')].map(look),
          btns: [...document.querySelectorAll('.btn')].map(el => [getComputedStyle(el).borderTopStyle, parseFloat(getComputedStyle(el).borderTopWidth)]),
        };
      });
      expect(contrast(s.navMark, canvas), `header current-page mark ${s.navMark}`).toBeGreaterThanOrEqual(3);
      expect(contrast(s.railProgress, canvas), `rail progress ${s.railProgress}`).toBeGreaterThanOrEqual(3);
      expect(s.railProgress, 'progress differs from the track').not.toBe(s.railTrack);
      for (const o of s.others) expect(o, 'current chapter differs').not.toBe(s.current);
      expect(s.btns.length).toBeGreaterThan(0);
      for (const [style, width] of s.btns) {
        expect(style).not.toBe('none');
        expect(width).toBeGreaterThanOrEqual(1);
      }
      await context.close();
    });
  }

  test('the mobile menu numbers meet 4.5:1 contrast', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('index.html');
    const bg = await page.locator('.menu').evaluate(el => getComputedStyle(el).backgroundColor);
    const nums = await page.locator('.menu-num').evaluateAll(els => els.map(el => [el.textContent, getComputedStyle(el).color]));
    expect(nums).toHaveLength(5);
    for (const [n, c] of nums) expect(contrast(c, bg), `${n} ${c} on ${bg}`).toBeGreaterThanOrEqual(4.5);
  });

  test('incubator: closed areas hold no animation, and opening one plays the fade', async ({ page }) => {
    await page.goto('incubator.html');
    await settle(page);
    await page.waitForTimeout(800); // past the .45s fade; a fade inside a closed area never finishes, so don't await it
    const lingering = await page.evaluate(() => document.getAnimations()
      .filter(a => a.effect && a.effect.target && a.effect.target.closest('details:not([open])')).length);
    expect(lingering, 'animations kept alive inside closed areas').toBe(0);
    await page.locator('details.area:not([open]) summary').first().click();
    const playing = await page.locator('details.area[open] .area-body').evaluate(el =>
      new Promise(r => requestAnimationFrame(() => r(el.getAnimations().map(a => a.playState)))));
    expect(playing, 'the opened area fades up').toContain('running');
  });
});

test.describe('round 4', () => {
  const docTop = (page, sel) => page.locator(sel).first().evaluate(el => Math.round(el.getBoundingClientRect().top + scrollY));

  for (const { file } of PAGES) {
    test(`${file}: printing after scrolling keeps the header at the top of the document`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(file);
      await settle(page);
      await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight * 0.45));
      await page.waitForTimeout(300); // let the header tuck away
      await page.emulateMedia({ media: 'print' });
      expect(await docTop(page, '.hdr'), 'header top in print').toBe(0);
      expect(await page.locator('.hdr').evaluate(el => getComputedStyle(el).transform)).toBe('none');
      for (const sel of ['.rail', '.router-a', '.join-side']) {
        for (const el of await page.locator(sel).all()) {
          expect(await el.evaluate(e => getComputedStyle(e).position), `${sel} in print`).not.toBe('sticky');
        }
      }
    });
  }

  test('printing with the mobile menu open prints the page, not the menu', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('story.html');
    await settle(page);
    await page.locator('.hdr-menu').click();
    await expect(page.locator('.menu')).toBeVisible();
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('.menu')).toBeHidden();
  });

  test('printing with the photo viewer open prints the page, not the viewer', async ({ page }) => {
    await page.goto('events.html');
    await settle(page);
    await page.locator('button.album').first().click();
    await expect(page.locator('.lightbox')).toBeVisible();
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('.lightbox')).toBeHidden();
  });

  test('story: chapter text reflows at 320px with user text spacing (WCAG 1.4.12)', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('story.html');
    await settle(page, { eager: true });
    await page.addStyleTag({ content: '* { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; } p { margin-bottom: 2em !important; }' });
    const cut = await page.evaluate(() => {
      const out = [];
      const tw = document.createTreeWalker(document.querySelector('.chapter-list'), NodeFilter.SHOW_TEXT);
      while (tw.nextNode()) {
        const t = tw.currentNode;
        if (t.parentElement.closest('.born-year')) continue; // the decorative numeral may run off; it is labelled
        const rg = document.createRange();
        rg.selectNodeContents(t);
        for (const b of rg.getClientRects()) if (b.width && b.right > innerWidth + .5) out.push(`${t.data.trim().slice(0, 30)} right=${b.right | 0}`);
      }
      return out;
    });
    expect(cut, 'chapter lines cut off at the right edge').toEqual([]);
  });

  test('events: logbook thumbnails use small files, and the peek keeps the larger photo', async ({ page, request }) => {
    await page.goto('events.html');
    const thumbs = await page.locator('.log-row').evaluateAll(rows => rows.filter(r => r.querySelector('.log-photos img'))
      .map(r => { const i = r.querySelector('.log-photos img'); return { src: i.getAttribute('src'), w: +i.getAttribute('width'), h: +i.getAttribute('height'), peek: r.dataset.peek }; }));
    expect(thumbs).toHaveLength(4);
    for (const t of thumbs) {
      expect(t.w, t.src).toBeLessThanOrEqual(200);
      expect(t.h, t.src).toBeLessThanOrEqual(200);
      expect(t.peek, t.src).toMatch(/-480\.webp$/);
      const res = await request.get(t.src);
      expect(res.status(), t.src).toBe(200);
      expect((await res.body()).length, `${t.src} bytes`).toBeLessThan(10000);
    }
  });
});
