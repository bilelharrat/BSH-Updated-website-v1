'use strict';
/* The terrain's lifecycle: every canvas follows its size, the animated one
   pauses and resumes with tab visibility and the Reduce Motion setting, and
   canvases folded away in a closed accordion are drawn before they open. */
const { test, expect } = require('./fixtures.cjs');
const { settle, inked, canvasHash } = require('./support.cjs');

const run = (locator, fn) => locator.evaluate((c, src) => new Function(`return (${src})`)()(c), fn.toString());
const hash = locator => run(locator, canvasHash);

test('every canvas on show redraws at its new size when the window changes', async ({ page }) => {
  await page.goto('incubator.html');
  await settle(page);
  // Canvases folded away in a closed area are left alone until they open.
  const shown = 'canvas[data-terrain]:not(details:not([open]) canvas)';
  const fit = () => page.locator(shown).evaluateAll(cs => cs.every(c => {
    const r = c.getBoundingClientRect();
    return Math.abs(c.width - r.width * devicePixelRatio) <= 1 && Math.abs(c.height - r.height * devicePixelRatio) <= 1;
  }));
  for (const width of [600, 1500]) {
    await page.setViewportSize({ width, height: 800 });
    await expect.poll(fit).toBe(true);
    const counts = await page.locator(shown).evaluateAll((cs, src) => cs.map(new Function(`return (${src})`)()), inked.toString());
    for (const n of counts) expect(n, `ink at ${width}px`).toBeGreaterThan(200);
  }
  // An area that was closed while the window changed catches up as it opens.
  await page.locator('details.area').nth(2).locator('summary').click();
  await expect.poll(fit).toBe(true);
  expect(await run(page.locator('details.area').nth(2).locator('canvas'), inked)).toBeGreaterThan(200);
});

test('canvases at device pixel ratio 2 are drawn at twice the resolution', async ({ browser, site }) => {
  const context = await browser.newContext({ baseURL: site, deviceScaleFactor: 2, viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const { hermetic } = require('./support.cjs');
  await hermetic(page, site);
  await page.goto('index.html');
  await settle(page);
  const sizes = await page.locator('canvas[data-terrain]').evaluateAll(cs => cs.map(c => {
    const r = c.getBoundingClientRect();
    return [c.width, Math.round(r.width * 2), c.height, Math.round(r.height * 2)];
  }));
  expect(sizes.length).toBeGreaterThan(0);
  for (const [w, ew, h, eh] of sizes) {
    expect(w).toBe(ew);
    expect(h).toBe(eh);
  }
  await context.close();
});

test('closed incubator areas already hold their drawing before they open', async ({ page }) => {
  await page.goto('incubator.html');
  await settle(page);
  const closed = page.locator('details.area:not([open]) canvas');
  await expect(closed).toHaveCount(3);
  for (const c of await closed.all()) expect(await run(c, inked)).toBeGreaterThan(200);
});

test('the land rests in a hidden tab and drifts again when the tab returns', async ({ page }) => {
  await page.goto('ventures.html');
  await settle(page);
  const hero = page.locator('.page-hero canvas');
  const setHidden = hidden => page.evaluate(h => {
    Object.defineProperty(document, 'hidden', { value: h, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);

  await setHidden(true);
  await page.waitForTimeout(200);
  const a = await hash(hero);
  await page.waitForTimeout(500);
  expect(await hash(hero)).toBe(a);

  await setHidden(false);
  await page.waitForTimeout(500);
  expect(await hash(hero)).not.toBe(a);
});

test('turning Reduce Motion on stills the land, and off lets it drift again', async ({ page }) => {
  await page.goto('join.html');
  await settle(page);
  const side = page.locator('canvas[data-animate]');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(200);
  const a = await hash(side);
  await page.waitForTimeout(500);
  expect(await hash(side)).toBe(a);

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.waitForTimeout(500);
  expect(await hash(side)).not.toBe(a);
});

test('pointing at an animated hero raises the land under the pointer', async ({ page }) => {
  await page.goto('foundation.html');
  await settle(page);
  const hero = page.locator('.page-hero canvas');
  const box = await hero.boundingBox();
  // Count ink near a spot, with and without the pointer resting on it.
  const near = (x, y) => hero.evaluate((c, [x, y]) => {
    const r = c.getBoundingClientRect(), s = c.width / r.width, R = 60 * s;
    const d = c.getContext('2d').getImageData(Math.max(0, (x - r.left) * s - R), Math.max(0, (y - r.top) * s - R), 2 * R, 2 * R).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i]) n++;
    return n;
  }, [x, y]);
  const x = box.x + box.width * 0.45, y = box.y + box.height * 0.5;
  await page.mouse.move(2, 2);
  await page.waitForTimeout(300);
  const before = await near(x, y);
  await page.mouse.move(x, y, { steps: 4 });
  await page.waitForTimeout(1200);
  // The bump stacks rings of contour lines around the pointer: about 15% more
  // ink here, where the drift alone moves the count by a few percent.
  expect(await near(x, y)).toBeGreaterThan(before * 1.08);
});
