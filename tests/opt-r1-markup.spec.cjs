'use strict';
/* Markup contracts from optimization round 1: one cache-busting version for
   every local stylesheet and script, decorations that stay silent without
   aria-hidden, logbook rows that keep their columns without placeholder
   cells, and form fields whose type alone picks the right keyboard. */
const { test, expect } = require('./fixtures.cjs');
const { PAGES, settle } = require('./support.cjs');

test('every page loads the local stylesheet and scripts at one shared version', async ({ request }) => {
  const seen = new Set();
  for (const { file } of PAGES) {
    const html = await (await request.get(file)).text();
    const refs = [...html.matchAll(/<(?:link rel="stylesheet" href|script src)="(assets\/[^"]+)"/g)].map(m => m[1]);
    expect(refs.map(r => r.split('?')[0]), file).toEqual(['assets/style.css', 'assets/chrome.js', 'assets/terrain.js', 'assets/app.js']);
    for (const ref of refs) {
      const v = ref.match(/\?v=(\d+)$/);
      expect(v, `${file}: ${ref} has no ?v=<n>`).not.toBeNull();
      seen.add(v[1]);
    }
  }
  expect([...seen], 'versions in use').toHaveLength(1);
});

for (const { file } of PAGES) {
  test(`${file}: decorative marks hold no text, so they need no aria-hidden`, async ({ page }) => {
    await page.goto(file);
    await settle(page);
    const loud = await page.locator('.tri, .dot, .stop, .role-check, .area-toggle').evaluateAll(els => els
      .filter(el => el.textContent.trim() || [...el.querySelectorAll('svg')].some(s => s.getAttribute('aria-hidden') !== 'true'))
      .map(el => el.outerHTML.slice(0, 80)));
    expect(loud).toEqual([]);
  });
}

test('the way-in options and role cards are named by their words alone', async ({ page }) => {
  await page.goto('index.html');
  await settle(page);
  for (const name of ['A founder', 'An investor', 'An operator or executive', 'A researcher', 'A scout', 'Aged 15 to 35', 'Just curious']) {
    await expect(page.getByRole('button', { name, exact: true })).toHaveCount(1);
  }
  await page.goto('join.html');
  await settle(page);
  await expect(page.getByRole('radio', { name: 'Founder Building a company, from first idea to growth stage.', exact: true })).toHaveCount(1);
});

test('logbook rows line up in columns without placeholder cells', async ({ page }) => {
  const columns = () => page.locator('.log-row').evaluateAll(rows => rows.map(r => {
    const x = sel => Math.round(r.querySelector(sel).getBoundingClientRect().left);
    const t = r.querySelector('.log-title').getBoundingClientRect();
    return { date: x('.log-date'), title: x('.log-title'), width: Math.round(t.width), place: x('.log-place') };
  }));
  await page.goto('events.html');
  await settle(page);
  for (const width of [1280, 820]) {
    await page.setViewportSize({ width, height: 800 });
    const rows = await columns();
    expect(rows).toHaveLength(11);
    for (const key of ['date', 'title', 'place']) expect(new Set(rows.map(r => r[key])).size, `${key} @${width}`).toBe(1);
    // Wide, every title gets the same column whether or not the row has photos.
    if (width > 1060) expect(new Set(rows.map(r => r.width)).size, `title width @${width}`).toBe(1);
  }
});

test('join fields rely on their type for the on-screen keyboard', async ({ page }) => {
  await page.goto('join.html');
  await settle(page);
  for (const [id, type] of [['email', 'email'], ['phone', 'tel'], ['linkedin', 'url']]) {
    await expect(page.locator(`#${id}`)).toHaveAttribute('type', type);
  }
});
