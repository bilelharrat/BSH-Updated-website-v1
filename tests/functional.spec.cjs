'use strict';
/* Behaviour contract for every page. These tests describe what the site
   does, not how the code does it, so they hold across refactors. */
const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('./fixtures.cjs');
const { PAGES, ROOT, settle, inked, canvasHash } = require('./support.cjs');

const NAV = [
  ['story.html', 'Our Story'], ['ventures.html', 'Ventures'], ['incubator.html', 'Incubator'],
  ['foundation.html', 'Foundation'], ['events.html', 'Events'],
];
const EMAIL = 'founders@berkeleysummithouse.org';

/* Anything that sticks out past the viewport edge without a scrolling or
   clipping ancestor to hold it is visibly cut off by the page. */
const overflowing = page => page.evaluate(() => {
  const W = document.documentElement.clientWidth;
  const bad = [];
  if (document.documentElement.scrollWidth > innerWidth) bad.push(`document ${document.documentElement.scrollWidth}px`);
  for (const el of document.body.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (!r.width || (r.right <= W + 1 && r.left >= -1)) continue;
    let held = false;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      if (getComputedStyle(p).overflowX !== 'visible') { held = true; break; }
    }
    if (!held) bad.push(`${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''} ${Math.round(r.left)}..${Math.round(r.right)}`);
  }
  return bad;
});

/* ---------- Every page ---------------------------------------------------- */
for (const { file, key } of PAGES) {
  test.describe(file, () => {
    test('renders its chrome, landmarks and metadata', async ({ page }) => {
      await page.goto(file);
      await settle(page);
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      expect(await page.title()).toMatch(/Berkeley Summit House/);
      expect(await page.locator('meta[name="description"]').getAttribute('content')).toBeTruthy();
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('main#main')).toHaveCount(1);

      const header = page.locator('header.hdr');
      await expect(header).toBeVisible();
      const nav = page.locator('.hdr-nav a');
      await expect(nav).toHaveCount(5);
      for (const [i, [href, label]] of NAV.entries()) {
        await expect(nav.nth(i)).toHaveAttribute('href', href);
        await expect(nav.nth(i)).toHaveText(label);
      }
      const current = page.locator('.hdr [aria-current="page"]:visible');
      if (key === 'home') await expect(current).toHaveAttribute('href', 'index.html');
      else if (key === 'join') await expect(current).toHaveAttribute('href', 'join.html');
      else await expect(current).toHaveAttribute('href', `${key}.html`);
      await expect(current).toHaveCount(1);

      const footer = page.locator('footer.ftr');
      await expect(footer).toBeVisible();
      await expect(footer.locator('.ftr-cta')).toHaveCount(key === 'join' ? 0 : 1);
      await expect(footer.locator('nav[aria-label="Explore"] a')).toHaveCount(5);
      await expect(footer.locator('nav[aria-label="Get involved"] a')).toHaveCount(5);
      const external = footer.locator('a[target="_blank"]');
      for (const a of await external.all()) await expect(a).toHaveAttribute('rel', /noopener/);
      await expect(footer.locator(`a[href="mailto:${EMAIL}"]`)).toHaveCount(1);
      await expect(footer.locator('canvas')).toHaveCount(1);
    });

    test('has no horizontal overflow from 320px to 1920px', async ({ page }) => {
      for (const width of [320, 375, 390, 600, 768, 900, 1024, 1061, 1280, 1440, 1920]) {
        await page.setViewportSize({ width, height: 800 });
        await page.goto(file);
        await settle(page);
        expect(await overflowing(page), `overflow at ${width}px`).toEqual([]);
      }
    });

    test('draws every visible terrain canvas', async ({ page }) => {
      await page.goto(file);
      await settle(page);
      const counts = await page.locator('canvas').evaluateAll((cs, fn) => {
        const ink = new Function(`return (${fn})`)();
        return cs.filter(c => c.getBoundingClientRect().width > 2).map(c => ink(c));
      }, inked.toString());
      expect(counts.length).toBeGreaterThan(0);
      for (const n of counts) expect(n).toBeGreaterThan(200);
    });

    test('every internal link and anchor resolves', async ({ page, request, site }) => {
      await page.goto(file);
      await settle(page);
      const hrefs = await page.locator('a[href]').evaluateAll(as => as.map(a => a.getAttribute('href')));
      const cache = new Map();
      const html = async f => {
        if (!cache.has(f)) {
          const r = await request.get(site + f);
          expect(r.status(), f).toBe(200);
          cache.set(f, await r.text());
        }
        return cache.get(f);
      };
      for (const href of new Set(hrefs)) {
        if (/^(https?:|mailto:)/.test(href)) continue;
        const [f, hash] = href.split('#');
        const target = f || file;
        const src = await html(target);
        if (!hash) continue;
        if (target === 'join.html' && hash !== 'main') {
          expect(src, `${href} role`).toContain(`value="${hash}"`);
        } else {
          expect(src, `${href} anchor`).toMatch(new RegExp(`id="${hash}"`));
        }
      }
    });

    test('skip link jumps to the content', async ({ page }) => {
      await page.goto(file);
      await settle(page);
      await page.keyboard.press('Tab');
      const skip = page.locator('a.skip');
      await expect(skip).toBeFocused();
      await expect(skip).toBeInViewport();
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/#main$/);
    });
  });
}

/* ---------- Header and menu ---------------------------------------------- */
test('header tucks away on scroll down and returns on scroll up or focus', async ({ page }) => {
  await page.goto('index.html');
  await settle(page);
  const hdr = page.locator('header.hdr');
  await page.mouse.wheel(0, 1200);
  await expect(hdr).toHaveClass(/is-hidden/);
  await page.mouse.wheel(0, -200);
  await expect(hdr).not.toHaveClass(/is-hidden/);
  await page.mouse.wheel(0, 900);
  await expect(hdr).toHaveClass(/is-hidden/);
  await page.locator('.hdr-nav a').first().focus();
  await expect(hdr).not.toHaveClass(/is-hidden/);
});

test('mobile menu opens, toggles, closes on Escape and on widening', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('ventures.html');
  await settle(page);
  const btn = page.locator('.hdr-menu');
  const menu = page.locator('#site-menu');
  await expect(page.locator('.hdr-nav')).toBeHidden();
  await expect(btn).toBeVisible();
  await expect(btn).toHaveAttribute('aria-expanded', 'false');
  await expect(menu).toBeHidden();

  await btn.click();
  await expect(btn).toHaveAttribute('aria-expanded', 'true');
  await expect(btn).toContainText('Close');
  await expect(menu).toBeVisible();
  await expect(page.locator('html')).toHaveClass(/menu-open/);
  await expect(menu.locator('.menu-link')).toHaveCount(5);
  await expect(menu.locator('a').first()).toBeFocused();
  expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe('hidden');
  await expect(menu.locator('.menu-link[aria-current="page"]')).toHaveAttribute('href', 'ventures.html');
  await expect(menu.locator(`a[href="mailto:${EMAIL}"]`)).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(btn).toHaveAttribute('aria-expanded', 'false');
  await expect(btn).toContainText('Menu');
  await expect(btn).toBeFocused();
  await expect(page.locator('html')).not.toHaveClass(/menu-open/);

  await btn.click();
  await expect(menu).toBeVisible();
  await btn.click();
  await expect(menu).toBeHidden();

  await btn.click();
  await expect(menu).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(btn).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('html')).not.toHaveClass(/menu-open/);
  await expect(page.locator('.hdr-nav')).toBeVisible();
});

test('copy button copies the email and confirms', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('index.html');
  await settle(page);
  const copy = page.locator('.copy-btn');
  await copy.scrollIntoViewIfNeeded();
  await copy.click();
  await expect(copy).toHaveClass(/is-copied/);
  await expect(copy).toHaveAttribute('aria-label', 'Copied');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(EMAIL);
  await expect(copy).not.toHaveClass(/is-copied/, { timeout: 4000 });
  await expect(copy).toHaveAttribute('aria-label', 'Copy email address');
});

test('copy button falls back to selecting the address', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('denied')) } });
  });
  await page.goto('index.html');
  await settle(page);
  const copy = page.locator('.copy-btn');
  await copy.scrollIntoViewIfNeeded();
  await copy.click();
  await expect.poll(() => page.evaluate(() => String(getSelection()))).toContain(EMAIL);
});

/* ---------- Motion -------------------------------------------------------- */
test('below-the-fold blocks ease in once, above-the-fold ones never hide', async ({ page }) => {
  await page.goto('index.html');
  await settle(page);
  const pillars = page.locator('.pillar.rv');
  await expect(pillars.first()).toHaveClass(/armed/);
  await expect(pillars.first()).not.toHaveClass(/\bin\b/);
  await pillars.first().scrollIntoViewIfNeeded();
  await expect(pillars.first()).toHaveClass(/\bin\b/);
  await expect.poll(() => pillars.first().evaluate(el => getComputedStyle(el).opacity)).toBe('1');

  await page.goto('story.html');
  await settle(page);
  // The first chapter starts on screen in the hero's shadow: never held back.
  await expect(page.locator('#ch-house')).not.toHaveClass(/armed/);
});

test('reduced motion: nothing is held back and the land stands still', async ({ browser, site }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce', baseURL: site });
  const page = await context.newPage();
  const { hermetic } = require('./support.cjs');
  await hermetic(page, site);
  await page.goto('ventures.html');
  await settle(page);
  expect(await page.locator('.armed').count()).toBe(0);
  const hero = page.locator('.page-hero canvas');
  const a = await hero.evaluate((c, fn) => new Function(`return (${fn})`)()(c), canvasHash.toString());
  await page.waitForTimeout(600);
  const b = await hero.evaluate((c, fn) => new Function(`return (${fn})`)()(c), canvasHash.toString());
  expect(b).toBe(a);
  await context.close();
});

test('animated terrain drifts while on screen and rests off screen', async ({ page }) => {
  await page.goto('ventures.html');
  await settle(page);
  const hero = page.locator('.page-hero canvas');
  const hash = () => hero.evaluate((c, fn) => new Function(`return (${fn})`)()(c), canvasHash.toString());
  const a = await hash();
  await page.waitForTimeout(500);
  expect(await hash()).not.toBe(a);

  await page.evaluate(() => scrollTo(0, document.body.scrollHeight / 2));
  await page.waitForTimeout(300);
  const c = await hash();
  await page.waitForTimeout(500);
  expect(await hash()).toBe(c);
});

/* ---------- Home ---------------------------------------------------------- */
test.describe('home', () => {
  const ROUTES = ['founder', 'investor', 'cxo', 'scholar', 'scout', 'young', 'curious'];

  test('the way-in picker shows one trail per answer', async ({ page }) => {
    await page.goto('index.html');
    await settle(page);
    const opts = page.locator('[data-route]');
    await expect(opts).toHaveCount(7);
    await expect(opts.first()).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-route-panel]:visible')).toHaveCount(1);
    await expect(page.locator('[data-route-panel="founder"]')).toBeVisible();
    for (const r of ROUTES) {
      await page.locator(`[data-route="${r}"]`).click();
      await expect(page.locator(`[data-route-panel="${r}"]`)).toBeVisible();
      await expect(page.locator('[data-route-panel]:visible')).toHaveCount(1);
      await expect(page.locator('[data-route][aria-pressed="true"]')).toHaveAttribute('data-route', r);
    }
    await page.locator('[data-route="young"]').click();
    await expect(page.locator('[data-route-panel="young"] .btn')).toHaveAttribute('href', 'join.html#young-leader');
    await page.locator('[data-route="curious"]').click();
    await expect(page.locator('[data-route-panel="curious"] .btn')).toHaveAttribute('target', '_blank');
  });

  test('the way-in picker answers to the arrow keys and wraps', async ({ page }) => {
    await page.goto('index.html');
    await settle(page);
    await page.locator('[data-route="founder"]').focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('[data-route="investor"]')).toBeFocused();
    await expect(page.locator('[data-route="investor"]')).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('[data-route="cxo"]')).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowUp');
    await expect(page.locator('[data-route="founder"]')).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(page.locator('[data-route="curious"]')).toBeFocused();
    await expect(page.locator('[data-route-panel="curious"]')).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('[data-route="founder"]')).toHaveAttribute('aria-pressed', 'true');
  });

  test('the photo strip pages with its buttons and disables them at the ends', async ({ page }) => {
    await page.goto('index.html');
    await settle(page);
    const strip = page.locator('[data-strip]');
    const prev = page.locator('[data-strip-btn="-1"]');
    const next = page.locator('[data-strip-btn="1"]');
    await strip.scrollIntoViewIfNeeded();
    await expect(prev).toBeDisabled();
    await expect(next).toBeEnabled();
    await expect(strip.locator('li')).toHaveCount(8);
    await next.click();
    await expect.poll(() => strip.evaluate(s => s.scrollLeft)).toBeGreaterThan(300);
    await expect(prev).toBeEnabled();
    await strip.evaluate(s => { s.scrollLeft = s.scrollWidth; });
    await expect(next).toBeDisabled();
    await prev.click();
    await expect(next).toBeEnabled();
    await strip.evaluate(s => { s.scrollLeft = 0; });
    await expect(prev).toBeDisabled();
  });

  test('on phones the strip swipes and its buttons step aside', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('index.html');
    await settle(page);
    await expect(page.locator('[data-strip-btn]').first()).toBeHidden();
    await expect(page.locator('.strip-ctrl .link')).toBeVisible();
    const sizes = await page.locator('[data-strip] li').evaluateAll(li => li.map(l => Math.round(l.getBoundingClientRect().width)));
    expect(new Set(sizes).size).toBe(1);
  });

  test('the mountain hero: one pin per pillar, the story and events on the ground line', async ({ page }) => {
    await page.goto('index.html');
    await settle(page);
    const pins = page.locator('.summit .pin');
    expect(await pins.evaluateAll(as => as.map(a => a.getAttribute('href')))).toEqual(['ventures.html', 'incubator.html', 'foundation.html']);
    for (const pin of await pins.all()) await expect(pin).toBeVisible();
    expect(await page.locator('.summit-ground a').evaluateAll(as => as.map(a => a.getAttribute('href')))).toEqual(['story.html', 'events.html']);
    // The regions repeat the pins for pointer users only.
    for (const r of await page.locator('.summit .region').all()) await expect(r).toHaveAttribute('tabindex', '-1');
    const pillars = await page.locator('.pillar').evaluateAll(as => as.map(a => a.getAttribute('href')));
    expect(pillars).toEqual(['ventures.html', 'incubator.html', 'foundation.html']);
  });

  test('pointing at a pin or its peak fills the peak with the pillar color', async ({ page }) => {
    await page.goto('index.html');
    await settle(page);
    const fill = name => page.locator(`.region--${name} path`).evaluate(p => getComputedStyle(p).fill);
    const COLORS = { ventures: 'rgb(39, 67, 214)', incubator: 'rgb(232, 90, 46)', foundation: 'rgb(237, 180, 49)' };
    for (const [name, color] of Object.entries(COLORS)) {
      await page.locator(`.pin--${name}`).hover();
      await expect.poll(() => fill(name)).toBe(color);
      await page.mouse.move(2, 2);
      await expect.poll(() => fill(name)).not.toBe(color);
    }
    await page.locator('.pin--incubator').focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(page.locator('.pin--incubator')).toBeFocused();
    await expect.poll(() => fill('incubator')).toBe(COLORS.incubator);
  });
});

/* ---------- Story --------------------------------------------------------- */
test.describe('story', () => {
  test('the chapter rail follows the reading position', async ({ page }) => {
    await page.goto('story.html');
    await settle(page);
    const links = page.locator('[data-rail] a');
    await expect(links).toHaveCount(4);
    const p = () => page.locator('[data-rail] ol').evaluate(ol => parseFloat(ol.style.getPropertyValue('--p')) || 0);
    expect(await p()).toBe(0);
    await expect(links.nth(0)).toHaveAttribute('aria-current', 'true');
    for (const [i, id] of ['ch-house', 'ch-founder', 'ch-walls', 'ch-idea'].entries()) {
      await page.evaluate(sel => {
        const el = document.getElementById(sel);
        scrollTo(0, el.getBoundingClientRect().top + scrollY - innerHeight * 0.2);
      }, id);
      await expect(links.nth(i)).toHaveAttribute('aria-current', 'true');
      for (let j = 0; j < 4; j++) if (j !== i) await expect(links.nth(j)).toHaveAttribute('aria-current', 'false');
    }
    await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
    await expect.poll(p).toBe(1);
    await links.nth(1).click();
    await expect(page).toHaveURL(/#ch-founder$/);
  });

  test('the ascent trail is drawn through the years and redrawn on resize', async ({ page }) => {
    await page.goto('story.html');
    await settle(page);
    const path_ = page.locator('.ascent-path');
    const d1 = await path_.getAttribute('d');
    expect(d1).toMatch(/^M[\d.\- ]+ C/);
    expect((d1.match(/C/g) || []).length).toBe(3);
    expect(await page.locator('[data-ascent] svg').getAttribute('viewBox')).toMatch(/^0 0 [\d.]+ [\d.]+$/);
    await page.setViewportSize({ width: 1000, height: 800 });
    await expect.poll(() => path_.getAttribute('d')).not.toBe(d1);
  });
});

/* ---------- Incubator ----------------------------------------------------- */
test('incubator focus areas open one at a time and draw their terrain', async ({ page }) => {
  await page.goto('incubator.html');
  await settle(page);
  const areas = page.locator('details.area');
  await expect(areas).toHaveCount(4);
  await expect(areas.nth(0)).toHaveAttribute('open', '');
  for (const i of [1, 2, 3, 0]) {
    await areas.nth(i).locator('summary').click();
    await expect(areas.nth(i)).toHaveAttribute('open', '');
    await expect(page.locator('details.area[open]')).toHaveCount(1);
    await expect.poll(() => areas.nth(i).locator('canvas').evaluate((c, fn) => new Function(`return (${fn})`)()(c), inked.toString())).toBeGreaterThan(200);
  }
  await areas.nth(0).locator('summary').click();
  await expect(page.locator('details.area[open]')).toHaveCount(0);
});

/* ---------- Events -------------------------------------------------------- */
test.describe('events', () => {
  test('the logbook filters by year and counts what it shows', async ({ page }) => {
    await page.goto('events.html');
    await settle(page);
    const count = page.locator('[data-log-count]');
    const rows = page.locator('.log-row');
    await expect(rows).toHaveCount(11);
    await expect(count).toHaveText('11 gatherings');
    for (const [value, n] of [['2026', 7], ['2025', 4], ['all', 11]]) {
      await page.locator(`[data-filter] button[data-value="${value}"]`).click();
      await expect(page.locator('.log-row:visible')).toHaveCount(n);
      await expect(count).toHaveText(`${n} gatherings`);
      await expect(page.locator('[data-filter] [aria-pressed="true"]')).toHaveAttribute('data-value', value);
      await expect(page.locator('[data-filter] [aria-pressed="true"]')).toHaveCount(1);
    }
  });

  test('a photo peeks beside the pointer on rows that have one', async ({ page }) => {
    await page.goto('events.html');
    await settle(page);
    const row = page.locator('.log-row[data-peek]').first();
    await row.scrollIntoViewIfNeeded();
    await row.hover();
    const peek = page.locator('.peek');
    await expect(peek).toHaveClass(/is-on/);
    const src = await row.getAttribute('data-peek');
    expect(await peek.locator('img').getAttribute('src')).toBe(src);
    await page.mouse.move(2, 2);
    await expect(peek).not.toHaveClass(/is-on/);
    await page.locator('.log-row:not([data-peek])').first().hover();
    await expect(peek).not.toHaveClass(/is-on/);
  });

  test('the photo viewer opens albums, steps, wraps and closes', async ({ page }) => {
    await page.goto('events.html');
    await settle(page);
    const lb = page.locator('dialog[data-lightbox]');
    const pos = page.locator('[data-lb-pos]');
    const opener = page.locator('button.album[data-album="inception"]');
    await opener.scrollIntoViewIfNeeded();
    await opener.click();
    await expect(lb).toHaveAttribute('open', '');
    await expect(page.locator('html')).toHaveClass(/menu-open/);
    await expect(pos).toHaveText('01 / 05');
    await expect(page.locator('[data-lb-title]')).toHaveText('Inception Cohort Demo Day');
    await expect(page.locator('.lb-stage img')).toHaveAttribute('alt', /Founders mingling/);
    await expect(page.locator('[data-lb-meta]')).toHaveText(/Founders mingling/);
    await page.locator('[data-lb-step="1"]').click();
    await expect(pos).toHaveText('02 / 05');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await expect(pos).toHaveText('05 / 05');
    await page.keyboard.press('ArrowRight');
    await expect(pos).toHaveText('01 / 05');
    await page.locator('[data-lb-step="-1"]').click();
    await expect(pos).toHaveText('05 / 05');
    await page.locator('[data-lb-close]').click();
    await expect(lb).not.toHaveAttribute('open', '');
    await expect(opener).toBeFocused();
    await expect(page.locator('html')).not.toHaveClass(/menu-open/);

    // Escape closes; a single photo hides the steppers.
    const single = page.locator('button.album[data-album="gtm"]');
    await single.click();
    await expect(pos).toHaveText('01 / 01');
    await expect(page.locator('[data-lb-step]').first()).toBeHidden();
    await page.keyboard.press('ArrowRight');
    await expect(pos).toHaveText('01 / 01');
    await page.keyboard.press('Escape');
    await expect(lb).not.toHaveAttribute('open', '');
    await expect(single).toBeFocused();

    // Clicking the dark stage around the photo closes it.
    await page.locator('.log-row button[data-album="agents"]').click();
    await expect(pos).toHaveText('01 / 03');
    const stage = await page.locator('.lb-stage').boundingBox();
    await page.mouse.click(stage.x + 4, stage.y + stage.height / 2);
    await expect(lb).not.toHaveAttribute('open', '');
  });

  test('every album opens with the right number of photos', async ({ page }) => {
    await page.goto('events.html');
    await settle(page);
    const albums = await page.locator('button.album').evaluateAll(bs => bs.map(b => [b.dataset.album, b.getAttribute('aria-label').match(/View (\d+) photos/)?.[1] || '1']));
    expect(albums.length).toBe(9);
    for (const [name, n] of albums) {
      await page.locator(`button.album[data-album="${name}"]`).click();
      await expect(page.locator('[data-lb-pos]')).toHaveText(`01 / ${String(n).padStart(2, '0')}`);
      await page.keyboard.press('Escape');
      await expect(page.locator('dialog[data-lightbox]')).not.toHaveAttribute('open', '');
    }
  });
});

/* ---------- Join ---------------------------------------------------------- */
test.describe('join', () => {
  const DIAL = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'dial-options.json'), 'utf8'));
  const fill = async (page, values) => {
    for (const [id, v] of Object.entries(values)) await page.locator(`#${id}`).fill(v);
  };
  const VALID = {
    'first-name': 'Ada', 'last-name': 'Lovelace', organization: 'Analytical Engines',
    email: 'ada@example.com', phone: '510 555 0100', linkedin: 'https://www.linkedin.com/in/ada',
  };

  test('lists every country dialling code, United States first', async ({ page }) => {
    await page.goto('join.html');
    await settle(page);
    const opts = await page.locator('#phone-country option').evaluateAll(os => os.map(o => [o.value, o.textContent]));
    expect(opts).toEqual(DIAL);
    await expect(page.locator('#phone-country')).toHaveValue('1|United States');
  });

  test('a link like join.html#investor preselects the role', async ({ page }) => {
    await page.goto('join.html#investor');
    await settle(page);
    await expect(page.locator('input[name="role"][value="investor"]')).toBeChecked();
    await page.evaluate(() => { location.hash = 'young-leader'; });
    await expect(page.locator('input[name="role"][value="young-leader"]')).toBeChecked();
    await page.evaluate(() => { location.hash = 'nonsense'; });
    await expect(page.locator('input[name="role"][value="young-leader"]')).toBeChecked();
  });

  test('an empty submit explains every problem and focuses the first', async ({ page }) => {
    await page.goto('join.html');
    await settle(page);
    await page.locator('#join-form [type="submit"]').click();
    const alert = page.locator('#form-alert');
    await expect(alert).toBeVisible();
    await expect(alert).toHaveText('7 things need your attention below.');
    await expect(page.locator('input[name="role"]').first()).toBeFocused();
    await expect(page.locator('#role-error')).toHaveText('Choose the network that fits you best.');
    const msgs = {
      'first-name': 'Enter your first name.', 'last-name': 'Enter your last name.',
      organization: 'Enter your organization. Independent is fine.', email: 'Enter a valid email address.',
      phone: 'Enter a phone number so we can schedule a call.', linkedin: 'Enter your LinkedIn profile URL.',
    };
    for (const [id, msg] of Object.entries(msgs)) {
      await expect(page.locator(`#${id}-error`)).toBeVisible();
      await expect(page.locator(`#${id}-error`)).toHaveText(msg);
      await expect(page.locator(`#${id}-error svg`)).toHaveCount(1);
      await expect(page.locator(`#${id}`)).toHaveAttribute('aria-invalid', 'true');
    }
    // After the first attempt, errors clear as you type.
    await page.locator('#first-name').fill('Ada');
    await expect(page.locator('#first-name-error')).toBeHidden();
    await expect(page.locator('#first-name')).toHaveAttribute('aria-invalid', 'false');
    await page.locator('label.role').first().click();
    await expect(page.locator('#role-error')).toBeHidden();
    await page.locator('#join-form [type="submit"]').click();
    await expect(alert).toHaveText('5 things need your attention below.');
    await expect(page.locator('#last-name')).toBeFocused();
    await fill(page, { 'last-name': 'L', organization: 'O', email: 'a@b.co', phone: '123456' });
    await page.locator('#join-form [type="submit"]').click();
    await expect(alert).toHaveText('One thing needs your attention below.');
    await expect(page.locator('#linkedin')).toBeFocused();
  });

  test('fields validate on blur only once they hold something', async ({ page }) => {
    await page.goto('join.html');
    await settle(page);
    await page.locator('#first-name').focus();
    await page.locator('#last-name').focus();
    await expect(page.locator('#first-name-error')).toBeHidden();
    await page.locator('#email').fill('nope');
    await page.locator('#phone').focus();
    await expect(page.locator('#email-error')).toBeVisible();
    await page.locator('#email').fill('ok@example.org');
    await page.locator('#phone').focus();
    await expect(page.locator('#email-error')).toBeHidden();
  });

  test('the rules accept and refuse the right values', async ({ page }) => {
    await page.goto('join.html');
    await settle(page);
    const cases = [
      ['email', 'a@b.c', false], ['email', 'a@b.co', true], ['email', ' x@y.org ', true], ['email', 'a b@c.de', false],
      ['phone', '12345', false], ['phone', '(510) 555-0', true], ['phone', 'abcdef', false],
      ['linkedin', 'example.com/in/x', false], ['linkedin', 'linkedin.com/in/x', true], ['linkedin', 'https://LinkedIn.com/company/y', true], ['linkedin', 'linkedin.com/', false],
      ['first-name', '   ', false], ['organization', 'Independent', true],
    ];
    for (const [id, value, ok] of cases) {
      await page.locator(`#${id}`).fill(value);
      await page.locator('#note').focus();
      if (ok) await expect(page.locator(`#${id}-error`), `${id}=${value}`).toBeHidden();
      else await expect(page.locator(`#${id}-error`), `${id}=${value}`).toBeVisible();
    }
  });

  test('a complete form thanks the person by name and role', async ({ page }) => {
    await page.goto('join.html#scout');
    await settle(page);
    await fill(page, VALID);
    await page.locator('#note').fill('A note.');
    await page.locator('#join-form [type="submit"]').click();
    const done = page.locator('#join-success');
    await expect(done).toBeVisible();
    await expect(page.locator('#join-form')).toBeHidden();
    await expect(done.locator('[data-first-name]')).toHaveText('Ada');
    await expect(done.locator('[data-role-name]')).toHaveText('a scout');
    await expect(done).toBeFocused();
  });

  test('pressing Enter in a field submits the form', async ({ page }) => {
    await page.goto('join.html#founder');
    await settle(page);
    await fill(page, VALID);
    await page.locator('#linkedin').press('Enter');
    await expect(page.locator('#join-success')).toBeVisible();
    await expect(page.locator('[data-role-name]')).toHaveText('a founder');
  });
});
