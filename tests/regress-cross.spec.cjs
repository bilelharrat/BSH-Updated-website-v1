'use strict';
/* Regressions that span the markup, styles and scripts, found by stress
   tests: printing, the join form without its script, unknown URLs and the
   page under the open mobile menu. */
const { test, expect } = require('./fixtures.cjs');
const { settle, hermetic } = require('./support.cjs');

for (const file of ['index.html', 'story.html', 'events.html']) {
  test(`printing ${file} from the top shows every held-back block`, async ({ page }) => {
    await page.goto(file);
    await settle(page);
    expect(await page.locator('.rv.armed').count(), 'blocks held back below the fold').toBeGreaterThan(0);
    await page.emulateMedia({ media: 'print' });
    const hidden = await page.$$eval('.rv', els => els.filter(el => getComputedStyle(el).opacity !== '1').length);
    expect(hidden).toBe(0);
  });
}

const fillJoin = async page => {
  await page.locator('input[name="role"][value="founder"]').check();
  await page.locator('#first-name').fill('Ada');
  await page.locator('#email').fill('ada@example.com');
  await page.locator('#phone').fill('5551234567');
};
// The browser's own submission: its method and whether the fields went into the URL.
const nativeSubmit = async page => {
  const req = page.waitForRequest(r => r.isNavigationRequest() && r.url().includes('join.html'));
  await page.locator('#join-form [type="submit"]').click();
  const r = await req;
  return { method: r.method(), url: r.url() };
};

test('without JavaScript the join form posts, never puts details in the URL, and gives the email', async ({ browser, site }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false, baseURL: site });
  const page = await ctx.newPage();
  await hermetic(page, site);
  await page.goto('join.html');
  // Playwright's text engine skips <noscript>, so find it by CSS.
  const note = page.locator('.form-foot noscript p');
  await expect(note).toBeVisible();
  await expect(note).toContainText('founders@berkeleysummithouse.org');
  await expect(page.locator('.nojs-nav a')).toHaveCount(7);
  await fillJoin(page);
  const { method, url } = await nativeSubmit(page);
  expect(method).toBe('POST');
  expect(url).not.toContain('?');
  await ctx.close();
});

test.describe('with app.js missing', () => {
  test.use({ allowErrors: true });
  test('the join form still never puts details in the URL', async ({ page, errors }) => {
    await page.route('**/assets/app.js*', r => r.fulfill({ status: 404, body: '' }));
    await page.goto('join.html');
    await fillJoin(page);
    const { method, url } = await nativeSubmit(page);
    expect(method).toBe('POST');
    expect(url).not.toMatch(/ada|5551234567/);
    expect(errors.filter(e => !/app\.js|Failed to load resource/.test(e))).toEqual([]);
  });
});

test.describe('unknown URLs', () => {
  test.use({ allowErrors: true });
  test('get the branded 404, styled at any depth, with a working way home', async ({ page, errors }) => {
    const res = await page.goto('old/site/about-us');
    expect(res.status()).toBe(404);
    await settle(page);
    await expect(page.locator('.hdr .brand')).toBeVisible();
    await expect(page.locator('.ftr')).toBeVisible();
    // The skip link stays on this page despite <base href="/">.
    await page.locator('.skip').focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/old\/site\/about-us#main$/);
    await page.getByRole('link', { name: 'Back to the house' }).click();
    await expect(page).toHaveURL(/\/index\.html$/);
    await expect(page.locator('.summit')).toBeVisible();
    expect(errors.filter(e => !e.includes('/old/site/about-us') && !/^console: .*status of 404/.test(e))).toEqual([]);
  });
});

test('the open mobile menu takes the rest of the page, skip link included, out of reach', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('index.html');
  await settle(page);
  const inert = () => page.evaluate(() =>
    ['.skip', 'main', 'bsh-footer'].filter(s => document.querySelector(s).inert));
  await page.locator('.hdr-menu').click();
  await expect(page.locator('#site-menu')).toBeVisible();
  expect(await inert()).toEqual(['.skip', 'main', 'bsh-footer']);
  await page.locator('#site-menu .menu-mail').focus();
  for (let n = 0; n < 3; n++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement === document.body || Boolean(document.activeElement.closest('.hdr')))).toBe(true);
  }
  await page.keyboard.press('Escape');
  expect(await inert()).toEqual([]);
});

for (const [width, height] of [[1024, 700], [1280, 800], [1920, 1080]]) {
  test(`story rail: jumping back up to a skipped chapter lands it below the header at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('story.html');
    await settle(page);
    await page.locator('[data-rail] a[href="#ch-walls"]').click();
    await page.waitForTimeout(1300);
    await page.locator('[data-rail] a[href="#ch-founder"]').click();
    await page.waitForTimeout(1300); // the reveal's rise has ended
    // The chapter was still held back by the reveal when the jump lined it up.
    expect(await page.evaluate(() =>
      Math.round(document.querySelector('#ch-founder .label').getBoundingClientRect().top))).toBe(84);
    expect(await page.evaluate(() => document.querySelector('.hdr').getBoundingClientRect().bottom)).toBeLessThan(84);
  });
}

test('the photo viewer fetches files sized for the screen', async ({ browser, site }) => {
  const sizes = {};
  for (const [name, viewport, deviceScaleFactor] of [['phone', { width: 390, height: 844 }, 2], ['desktop', { width: 1440, height: 900 }, 1]]) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor, baseURL: site });
    const page = await ctx.newPage();
    await hermetic(page, site);
    const asked = [];
    page.on('request', r => { const m = r.url().match(/openclaw-(\d)-(\d+)\.webp$/); if (m) asked.push(`${m[1]}-${m[2]}`); });
    await page.goto('events.html');
    await settle(page);
    asked.length = 0; // the album cards' own photos
    await page.locator('button.album[data-album="openclaw"]').click();
    await expect(page.locator('.lb-stage img')).toBeVisible();
    await page.waitForTimeout(300);
    sizes[name] = [...new Set(asked)].sort();
    await ctx.close();
  }
  expect(sizes.phone).toEqual(['1-800', '2-800', '3-1600']);
  expect(sizes.desktop).toEqual(['1-1600', '2-1600', '3-1600']);
});

test('incubator areas stay one-at-a-time where <details name> is unsupported (Safari < 17.2)', async ({ page }) => {
  // An old engine: no name property, so app.js adds its fallback.
  await page.addInitScript(() => { delete HTMLDetailsElement.prototype.name; });
  await page.goto('incubator.html');
  await settle(page);
  // ...and no native group: a namespaced name attribute is invisible to the
  // engine's exclusivity but still what getAttribute('name') reads.
  await page.$$eval('details[name]', ds => ds.forEach(d => {
    const n = d.getAttribute('name');
    d.removeAttribute('name');
    d.setAttributeNS('urn:old-engine', 'name', n);
  }));
  const open = () => page.$$eval('details.area', ds => ds.filter(d => d.open).map(d => d.querySelector('.area-name').textContent));
  for (const name of ['Wellbeing', 'Legal', 'Arts']) {
    await page.locator('.area summary', { hasText: name }).click();
    await expect.poll(open).toEqual([name]);
  }
});

// A thank-you panel taller than the room below the sticky header was centred
// with its top, check mark and heading under the header (400% zoom, landscape phone).
for (const [width, height] of [[320, 200], [568, 320], [1280, 800]]) {
  test(`join: the thank-you starts below the header at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('join.html');
    await settle(page);
    await fillJoin(page);
    for (const [id, v] of [['first-name', 'Alexandra'], ['last-name', 'Quist'], ['organization', 'UC Berkeley'], ['linkedin', 'https://linkedin.com/in/aq']]) await page.locator(`#${id}`).fill(v);
    await page.locator('#join-form [type="submit"]').click();
    await expect(page.locator('#join-success')).toBeFocused();
    const tops = () => page.evaluate(() => {
      const top = s => Math.round(document.querySelector(s).getBoundingClientRect().top);
      return { hdr: Math.round(document.querySelector('.hdr').getBoundingClientRect().bottom), mark: top('.success-mark'), h2: top('#join-success h2') };
    });
    await page.waitForTimeout(900); // the smooth scroll has ended
    const t = await tops();
    expect(t.mark, 'check mark below the header').toBeGreaterThanOrEqual(t.hdr);
    expect(t.h2, 'heading below the header').toBeGreaterThanOrEqual(t.hdr);
    expect(t.h2, 'heading on screen').toBeLessThan(height);
  });
}

test('printing join.html keeps the contour map inside its panel', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('join.html');
  await settle(page);
  await page.emulateMedia({ media: 'print' });
  const [side, map] = await Promise.all(['.join-side', '.join-side canvas'].map(s =>
    page.locator(s).evaluate(el => { const r = el.getBoundingClientRect(); return [r.left, r.top + scrollY, r.width, r.height].map(Math.round); })));
  expect(map).toEqual(side);
});
