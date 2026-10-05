'use strict';
/* Regression tests for the stylesheet clean-up (optimization round 1): the
   look that now comes from shared rules or inheritance instead of repeated
   declarations. Like functional.spec, they check what a visitor sees. */
const { test, expect } = require('./fixtures.cjs');
const { PAGES, settle } = require('./support.cjs');

test.use({ contextOptions: { reducedMotion: 'reduce' } });

const TONES = {
  ink: 'rgb(19, 20, 23)', cobalt: 'rgb(39, 67, 214)', poppy: 'rgb(232, 90, 46)', gold: 'rgb(237, 180, 49)',
};
const tris = (page, sel) => page.locator(sel).evaluateAll(els => els.map(el => ({
  tone: el.closest('[data-tone]')?.dataset.tone,
  bg: getComputedStyle(el).backgroundColor,
  shown: getComputedStyle(el).display !== 'none',
})));

test('the triangles beside nav links, values and roles take their pillar color', async ({ page }) => {
  for (const [file, sel] of [['index.html', '.nav-link .tri'], ['story.html', '.value .tri'], ['join.html', '.role .tri']]) {
    await page.goto(file);
    const list = await tris(page, sel);
    expect(list.length, `${file} ${sel}`).toBeGreaterThan(3);
    for (const t of list) if (t.shown) expect(t.bg, `${file} ${sel} ${t.tone}`).toBe(TONES[t.tone]);
  }
});

test('pillar card labels lead with a triangle in the label color', async ({ page }) => {
  await page.goto('index.html');
  const labels = await page.locator('.pillar .label').evaluateAll(els => els.map(el => [
    getComputedStyle(el).color, getComputedStyle(el, '::before').backgroundColor]));
  expect(labels).toHaveLength(3);
  for (const [color, tri] of labels) expect(tri).toBe(color);
});

test('the "collaborate with us" row on Ventures reads in cobalt', async ({ page }) => {
  await page.goto('ventures.html');
  const add = page.locator('.names .add');
  expect(await add.locator('.nm').evaluate(el => getComputedStyle(el).color)).toBe(TONES.cobalt);
  expect(await add.locator('svg').evaluate(el => getComputedStyle(el).color)).toBe(TONES.cobalt);
});

for (const width of [390, 900, 1280]) {
  test(`header: brand left, actions right, nav centred @${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('ventures.html');
    const box = await page.evaluate(() => {
      const r = s => document.querySelector(s).getBoundingClientRect();
      const inner = document.querySelector('.hdr-in');
      const pad = parseFloat(getComputedStyle(inner).paddingRight);
      const nav = r('.hdr-nav');
      return { end: r('.hdr-end').right, edge: r('.hdr-in').right - pad, brand: r('.brand').right, nav, start: r('.hdr-end').left };
    });
    expect(Math.abs(box.end - box.edge)).toBeLessThan(1);
    if (width > 1060) {
      // The nav sits midway between the brand and the actions.
      expect(Math.abs((box.nav.left - box.brand) - (box.start - box.nav.right))).toBeLessThan(1);
    } else {
      expect(box.nav.width).toBe(0);
    }
  });
}

test('a disabled photo-strip button does not light up on hover', async ({ page }) => {
  await page.goto('index.html');
  await settle(page);
  const prev = page.locator('[data-strip-btn="-1"]');
  const next = page.locator('[data-strip-btn="1"]');
  await expect(prev).toBeDisabled();
  const border = l => l.evaluate(el => getComputedStyle(el).borderTopColor);
  const rest = await border(next);
  await prev.scrollIntoViewIfNeeded();
  const hover = async l => {
    const b = await l.boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  };
  await hover(prev);
  expect(await border(prev)).toBe(rest);
  await hover(next);
  await expect.poll(() => border(next)).not.toBe(rest);
  expect(await border(next)).toBe(await next.evaluate(el => getComputedStyle(el).color));
});

for (const width of [390, 1280]) {
  test(`every terrain canvas fills its wrap @${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const { file } of PAGES) {
      await page.goto(file);
      await page.evaluate(() => document.querySelectorAll('details').forEach(d => { d.open = true; }));
      const off = await page.evaluate(() => [...document.querySelectorAll('canvas[data-terrain]')].map(c => {
        const a = c.getBoundingClientRect(), b = c.parentElement.getBoundingClientRect();
        return Math.max(Math.abs(a.left - b.left), Math.abs(a.top - b.top), Math.abs(a.width - b.width), Math.abs(a.height - b.height));
      }));
      expect(off.length, file).toBeGreaterThanOrEqual(file === 'story.html' ? 1 : 2);
      for (const d of off) expect(d, file).toBeLessThan(0.5);
    }
  });
}

test('the story rail line is as long as the reading is far along', async ({ page }) => {
  await page.goto('story.html');
  await settle(page);
  const line = () => page.locator('[data-rail] ol').evaluate(ol => {
    const cs = getComputedStyle(ol, '::after');
    const m = cs.transform === 'none' ? 1 : new DOMMatrix(cs.transform).d;
    const p = parseFloat(ol.style.getPropertyValue('--p')) || 0;
    return { drawn: parseFloat(cs.height) * m, full: ol.getBoundingClientRect().height - 16, p };
  });
  // The line eases to a new length over a frame or two, so wait for it to land.
  const off = async () => { const l = await line(); return Math.abs(l.drawn - l.full * l.p); };
  expect((await line()).drawn).toBeCloseTo(0, 1);
  await page.evaluate(() => {
    const el = document.getElementById('ch-walls');
    scrollTo(0, el.getBoundingClientRect().top + scrollY - innerHeight * 0.2);
  });
  await expect.poll(async () => (await line()).p).toBeGreaterThan(0.2);
  expect((await line()).p).toBeLessThan(1);
  await expect.poll(off).toBeLessThan(0.5);
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
  await expect.poll(async () => (await line()).p).toBe(1);
  await expect.poll(off).toBeLessThan(0.5);
});
