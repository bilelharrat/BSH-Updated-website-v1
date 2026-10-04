'use strict';
/* Pixel snapshots of every page at four widths, plus the interactive states.
   Motion is reduced so the land holds still; photos are a neutral stand-in
   and web fonts fall back, so the pictures depend only on this code. */
const { test, expect } = require('./fixtures.cjs');
const path = require('node:path');
const { PAGES, settle } = require('./support.cjs');

const ELEMENT = { stylePath: path.join(__dirname, 'screenshot.css') };

test.use({ contextOptions: { reducedMotion: 'reduce' } });

const VIEWPORTS = {
  phone: { width: 390, height: 844 },
  tablet: { width: 820, height: 1180 },
  laptop: { width: 1280, height: 800 },
  desktop: { width: 1920, height: 1080 },
};

for (const [vp, size] of Object.entries(VIEWPORTS)) {
  for (const { file } of PAGES) {
    test(`${file} @${vp}`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto(file);
      await settle(page, { eager: true });
      await expect(page).toHaveScreenshot(`${file.replace('.html', '')}-${vp}.png`, { fullPage: true });
    });
  }
}

test.describe('states', () => {
  test('way-in picker, young leaders', async ({ page }) => {
    await page.goto('index.html');
    await settle(page, { eager: true });
    await page.locator('[data-route="young"]').click();
    await expect(page.locator('[data-router]')).toHaveScreenshot('state-router-young.png', ELEMENT);
  });

  test('mobile menu open', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.phone);
    await page.goto('foundation.html');
    await settle(page, { eager: true });
    await page.locator('.hdr-menu').click();
    await page.locator('.hdr-menu').blur();
    await expect(page).toHaveScreenshot('state-menu-phone.png');
  });

  test('photo viewer', async ({ page }) => {
    await page.goto('events.html');
    await settle(page, { eager: true });
    await page.locator('button.album[data-album="ybv"]').click();
    await page.locator('[data-lb-step="1"]').click();
    await page.locator('[data-lb-step="1"]').blur();
    await expect(page).toHaveScreenshot('state-lightbox.png');
  });

  test('logbook filtered to 2025', async ({ page }) => {
    await page.goto('events.html');
    await settle(page, { eager: true });
    await page.locator('[data-filter] button[data-value="2025"]').click();
    await page.locator('[data-filter] button[data-value="2025"]').blur();
    await page.mouse.move(0, 0);
    await expect(page.locator('#past')).toHaveScreenshot('state-logbook-2025.png', ELEMENT);
  });

  for (const vp of ['phone', 'laptop']) {
    test(`join form errors @${vp}`, async ({ page }) => {
      await page.setViewportSize(VIEWPORTS[vp]);
      await page.goto('join.html');
      await settle(page, { eager: true });
      await page.locator('#join-form [type="submit"]').click();
      await page.locator('#email').fill('nope');
      await page.locator('#email').blur();
      await expect(page.locator('.join-form-wrap')).toHaveScreenshot(`state-join-errors-${vp}.png`, ELEMENT);
    });
  }

  test('join success', async ({ page }) => {
    await page.goto('join.html#cxo');
    await settle(page, { eager: true });
    for (const [id, v] of Object.entries({
      'first-name': 'Ada', 'last-name': 'Lovelace', organization: 'Engines', email: 'ada@example.com',
      phone: '5105550100', linkedin: 'linkedin.com/in/ada',
    })) await page.locator(`#${id}`).fill(v);
    await page.locator('#join-form [type="submit"]').click();
    await expect(page.locator('#join-success')).toBeVisible();
    await page.evaluate(() => document.activeElement?.blur());
    await expect(page.locator('#join-success')).toHaveScreenshot('state-join-success.png', ELEMENT);
  });

  test('incubator, third area open', async ({ page }) => {
    await page.goto('incubator.html');
    await settle(page, { eager: true });
    await page.locator('details.area').nth(2).locator('summary').click();
    await settle(page);
    await page.mouse.move(0, 0);
    await expect(page.locator('.areas')).toHaveScreenshot('state-incubator-legal.png', ELEMENT);
  });
});
