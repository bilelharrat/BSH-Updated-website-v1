'use strict';
/* Photos are self-hosted: every photo a page can show (img src and srcset,
   the album viewer's list, the logbook's pointer peeks) is served by this
   site as an image, and every photo in the markup reserves its space. */
const { test, expect } = require('./fixtures.cjs');
const { PAGES, settle } = require('./support.cjs');

for (const { file } of PAGES) {
  test(`${file}: photos are self-hosted and sized`, async ({ page, request, site }) => {
    const html = await (await request.get(file)).text();
    const { urls, unsized } = await page.evaluate(source => {
      const doc = new DOMParser().parseFromString(source, 'text/html');
      // The viewer's <img src="data:,"> is a placeholder filled from the albums list.
      const imgs = [...doc.querySelectorAll('img')].filter(i => !i.getAttribute('src')?.startsWith('data:'));
      const albums = Object.values(JSON.parse(doc.getElementById('albums')?.textContent || '{}'));
      return {
        urls: [
          ...imgs.map(i => i.getAttribute('src')),
          ...imgs.flatMap(i => (i.getAttribute('srcset') || '').split(',').map(c => c.trim().split(/\s+/)[0]).filter(Boolean)),
          ...albums.flatMap(a => a.photos.map(([src]) => src)),
          ...[...doc.querySelectorAll('[data-peek]')].map(row => row.dataset.peek),
        ],
        unsized: imgs.filter(i => !(i.getAttribute('width') > 0 && i.getAttribute('height') > 0)).map(i => i.outerHTML),
      };
    }, html);
    expect(unsized, 'images without width and height').toEqual([]);
    for (const url of new Set(urls.map(u => new URL(u, site + file).href))) {
      expect(url.startsWith(site), `${url} is off-site`).toBe(true);
      const res = await request.get(url);
      expect(res.status(), url).toBe(200);
      expect(res.headers()['content-type'], url).toMatch(/^image\//);
    }
  });
}

/* Pixel colour at one point of the page: a 1×1 PNG screenshot has a single
   scanline whose filter byte (any type) leaves the RGB bytes as they are. */
const pixel = async (page, x, y) => {
  const png = await page.screenshot({ clip: { x, y, width: 1, height: 1 } });
  const idat = [];
  for (let at = 8; at < png.length;) {
    const len = png.readUInt32BE(at);
    if (png.toString('latin1', at + 4, at + 8) === 'IDAT') idat.push(png.subarray(at + 8, at + 8 + len));
    at += 12 + len;
  }
  const [, r, g, b] = require('node:zlib').inflateSync(Buffer.concat(idat));
  return [r, g, b];
};

test('the photo viewer never shows one photo beside another caption, and fetches each photo once', async ({ page }) => {
  const swatch = fill => `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200"><rect width="1600" height="1200" fill="${fill}"/></svg>`;
  const asked = {};
  let release;
  const held = new Promise(r => { release = r; });
  // Later routes win: the viewer's photos get a solid colour, Inception's first one only when released.
  await page.route(/\/assets\/photos\/[a-z]+(-\d)?-1[26]00\.webp$/, async route => {
    const url = route.request().url();
    asked[url] = (asked[url] || 0) + 1;
    if (url.endsWith('/inception-1-1600.webp')) await held;
    await route.fulfill({ contentType: 'image/svg+xml', body: swatch(url.includes('/napa-') ? '#FF0000' : '#0000FF') });
  });
  await page.goto('events.html');
  await settle(page);
  const pos = page.locator('[data-lb-pos]');
  // Which colour the middle of the stage shows: 'red', 'blue' or 'dark'.
  const centre = async () => {
    const box = await page.locator('.lb-stage').boundingBox();
    const [r, g, b] = await pixel(page, Math.round(box.x + box.width / 2), Math.round(box.y + box.height / 2));
    return r > 200 && g < 80 && b < 80 ? 'red' : b > 200 && r < 80 && g < 80 ? 'blue' : r + g + b < 90 ? 'dark' : `rgb(${r}, ${g}, ${b})`;
  };

  await page.locator('button.album[data-album="napa"]').click();
  await expect.poll(centre).toBe('red');
  await page.keyboard.press('Escape');

  // Inception's first photo hasn't arrived: the stage stays dark, never red.
  await page.locator('button.album[data-album="inception"]').click();
  await expect(pos).toHaveText('01 / 05');
  await page.waitForTimeout(300);
  expect(await centre()).toBe('dark');
  release();
  await expect.poll(centre).toBe('blue');

  // Round the album and back: every photo is fetched exactly once.
  for (let k = 0; k < 5; k++) await page.keyboard.press('ArrowRight');
  for (let k = 0; k < 5; k++) await page.keyboard.press('ArrowLeft');
  await expect(pos).toHaveText('01 / 05');
  await expect(page.locator('.lb-stage img')).toHaveCount(1);
  const inception = Object.entries(asked).filter(([u]) => u.includes('/inception-'));
  expect(inception.length).toBe(5);
  expect(inception.filter(([, n]) => n !== 1)).toEqual([]);
});
