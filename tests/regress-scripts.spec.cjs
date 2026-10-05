'use strict';
/* Regressions in app.js, chrome.js and terrain.js found by stress tests:
   the open mobile menu, a missing chrome.js, fallback content in the chrome,
   resolution changes and the terrain behind an opaque overlay. */
const { test, expect } = require('./fixtures.cjs');
const { settle } = require('./support.cjs');

const PHONE = { width: 390, height: 800 };
const openMenu = async (page, file) => {
  await page.setViewportSize(PHONE);
  await page.goto(file);
  await settle(page);
  await page.locator('.hdr-menu').click();
  await expect(page.locator('#site-menu')).toBeVisible();
};

test('the open mobile menu keeps keyboard focus in the header', async ({ page }) => {
  await openMenu(page, 'events.html');
  for (let n = 0; n < 20; n++) {
    await page.keyboard.press('Tab');
    const where = await page.evaluate(() => {
      const a = document.activeElement;
      return a === document.body || a.closest('bsh-header') ? 'ok' : `${a.tagName} ${a.textContent.trim().slice(0, 30)}`;
    });
    expect(where, `Tab ${n + 1}`).toBe('ok');
  }
  // Closed, the page is reachable again.
  await page.keyboard.press('Escape');
  await expect(page.locator('#site-menu')).toBeHidden();
  await expect.poll(async () => {
    await page.keyboard.press('Tab');
    return page.evaluate(() => Boolean(document.activeElement.closest('main')));
  }, { timeout: 10_000 }).toBe(true);
});

test('closing the photo viewer keeps the scroll lock of the open menu', async ({ page }) => {
  await openMenu(page, 'events.html');
  await page.evaluate(() => document.querySelector('[data-album]').click());
  await expect(page.locator('[data-lightbox]')).toHaveAttribute('open', '');
  await page.evaluate(() => document.querySelector('[data-lb-close]').click());
  await expect(page.locator('[data-lightbox]')).not.toHaveAttribute('open', '');
  await expect(page.locator('#site-menu')).toBeVisible();
  await expect(page.locator('html')).toHaveClass(/\bmenu-open\b/);
});

test.describe('without chrome.js', () => {
  // The missing script logs a 404 on purpose; anything else still fails.
  test.use({ allowErrors: true });
  test.afterEach(({ errors }) => {
    expect(errors.filter(e => !/^(console: Failed to load resource|HTTP 404 .*chrome\.js)/.test(e))).toEqual([]);
  });

  test('the join form still explains what is missing, and a failed send', async ({ page }) => {
    await page.route('**/assets/chrome.js*', r => r.fulfill({ status: 404, body: '' }));
    await page.goto('join.html');
    await settle(page);
    await page.locator('#join-form [type="submit"]').click();
    await expect(page.locator('#form-alert')).toBeVisible();
    await expect(page.locator('#form-alert')).toHaveText('7 things need your attention below.');
    await expect(page.locator('#role-error')).toHaveText('Choose the network that fits you best.');

    const endpoint = 'https://forms.example.test/join';
    await page.route(endpoint, r => r.fulfill({ status: 500, headers: { 'access-control-allow-origin': '*' }, body: '' }));
    await page.evaluate(url => { document.getElementById('join-form').dataset.endpoint = url; }, endpoint);
    const VALID = {
      'first-name': 'Ada', 'last-name': 'Lovelace', organization: 'Analytical Engines',
      email: 'ada@example.com', phone: '510 555 0100', linkedin: 'https://www.linkedin.com/in/ada',
    };
    for (const [id, v] of Object.entries(VALID)) await page.locator(`#${id}`).fill(v);
    await page.locator('label.role').first().click();
    await page.locator('#join-form [type="submit"]').click();
    await expect(page.locator('#form-alert')).toContainText('or email founders@berkeleysummithouse.org.');
  });
});

test('fallback content inside the chrome never stops it rendering', async ({ page }) => {
  await page.goto('ventures.html');
  await settle(page);
  await page.evaluate(() => document.body.insertAdjacentHTML('beforeend',
    '<bsh-footer no-cta id="late"><a href="index.html">Berkeley Summit House</a></bsh-footer>'));
  await expect(page.locator('#late > footer.ftr')).toHaveCount(1);
  await expect(page.locator('#late > a')).toHaveCount(0);
});

test('widening the window with the menu open keeps keyboard focus visible', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto('story.html');
  await settle(page);
  await page.locator('.hdr-menu').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.menu-link[href="story.html"]')).toBeFocused();
  await page.setViewportSize({ width: 1280, height: 800 });
  // The same page's nav link, or the brand link home if the browser blurred it first.
  const focused = page.locator('.hdr-in :is(.hdr-nav a[href="story.html"], .brand):focus');
  await expect(focused).toHaveCount(1);
  await expect(focused).toBeVisible();
});

test('terrain re-rasterises when the device pixel ratio changes', async ({ page }) => {
  await page.goto('ventures.html');
  await settle(page);
  const sharp = dpr => page.evaluate(d => [...document.querySelectorAll('canvas[data-terrain]')]
    .map(c => [c.width, c.getBoundingClientRect().width])
    .filter(([, w]) => w)
    .every(([cw, w]) => Math.abs(cw - w * d) <= 1), dpr);
  expect(await sharp(1)).toBe(true);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 2, mobile: false });
  await expect.poll(() => sharp(2), { timeout: 5000 }).toBe(true);
});

test('animated terrain pauses while the mobile menu covers it', async ({ page }) => {
  await openMenu(page, 'ventures.html');
  const draws = () => page.evaluate(() => new Promise(res => {
    const t = document.querySelector('canvas[data-animate]').terrain;
    let n = 0;
    t.draw = function () { n++; return Object.getPrototypeOf(this).draw.call(this); };
    setTimeout(() => { delete t.draw; res(n); }, 600);
  }));
  expect(await draws()).toBe(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('#site-menu')).toBeHidden();
  expect(await draws()).toBeGreaterThan(3);
});

/* Round 2 stress findings */

test('the logbook photo peek stays inside the window and clear of the header', async ({ page }) => {
  for (const width of [1280, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('events.html');
    await settle(page);
    const row = page.locator('[data-peek]').first();
    // Near the top of the window, at the right end of the row.
    await page.evaluate(() => {
      const r = document.querySelector('[data-peek]');
      scrollBy(0, r.getBoundingClientRect().top - 72);
    });
    const box = await row.boundingBox();
    await page.mouse.move(box.x + 10, box.y + box.height / 2);
    await page.mouse.move(box.x + box.width - 20, box.y + 6, { steps: 5 });
    const peek = page.locator('.peek.is-on');
    await expect(peek).toHaveCount(1);
    await expect.poll(() => peek.evaluate(p => {
      const b = p.getBoundingClientRect(), root = document.documentElement;
      return b.left >= 0 && b.right <= root.clientWidth && b.top >= 68 && b.bottom <= root.clientHeight;
    }), { message: `${width} wide` }).toBe(true);
  }
});

test('a footer "Get involved" link on the join page brings the picked role into view and clears its error', async ({ page }) => {
  await page.goto('join.html');
  await settle(page);
  await page.locator('#join-form [type="submit"]').click();
  await expect(page.locator('#role-error')).toBeVisible();
  for (const [role, text] of [['investor', 'Invest with us'], ['founder', 'Join as a founder']]) {
    await page.locator('.ftr a', { hasText: text }).click();
    const input = page.locator(`input[name="role"][value="${role}"]`);
    await expect(input).toBeChecked();
    await expect(input).toBeFocused();
    await expect(input).toBeInViewport();
    await expect(page.locator('#role-error')).toBeHidden();
  }
});

test('reopening the photo viewer before its close event arrives keeps the page locked', async ({ page }) => {
  await page.goto('events.html');
  await settle(page);
  await page.locator('[data-album]').first().click();
  await expect(page.locator('[data-lightbox]')).toHaveAttribute('open', '');
  await page.evaluate(() => {
    document.querySelector('[data-lightbox]').close();
    document.querySelector('[data-album]').click();
  });
  await page.waitForTimeout(100);
  await expect(page.locator('[data-lightbox]')).toHaveAttribute('open', '');
  await expect(page.locator('html')).toHaveClass(/\bmenu-open\b/);
});

test('paging the home photo strip to either end keeps keyboard focus on a strip button', async ({ page }) => {
  await page.goto('index.html');
  await settle(page);
  const next = page.locator('[data-strip-btn="1"]'), prev = page.locator('[data-strip-btn="-1"]');
  for (const [from, to] of [[next, prev], [prev, next]]) {
    await from.focus();
    await expect.poll(async () => {
      if (await from.isEnabled()) await page.keyboard.press('Enter');
      await page.waitForTimeout(250);
      return from.isDisabled();
    }, { timeout: 15_000 }).toBe(true);
    await expect(to).toBeFocused();
  }
});

test.describe('the 404 skip link', () => {
  test.use({ allowErrors: true });
  test.afterEach(({ errors }) => {
    expect(errors.filter(e => !/^(HTTP 404 |console: .*status of 404)/.test(e))).toEqual([]);
  });

  test('stays on this site when the path starts with //', async ({ page, site }) => {
    await page.route('http://evil.example/**', r => r.fulfill({ contentType: 'text/html', body: 'off-site' }));
    const origin = new URL(site).origin;
    expect((await page.goto(`${origin}//evil.example/phish`)).status()).toBe(404);
    await settle(page);
    expect(await page.locator('a.skip').evaluate(a => a.href)).toBe(`${origin}//evil.example/phish#main`);
    await page.locator('a.skip').focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(`${origin}//evil.example/phish#main`);
  });

  test('keeps the query and jumps into the page without reloading it', async ({ page }) => {
    await page.goto('old-page?utm_source=newsletter');
    await settle(page);
    await page.evaluate(() => { window.sameDocument = true; });
    await page.keyboard.press('Tab');
    await expect(page.locator('a.skip')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/old-page\?utm_source=newsletter#main$/);
    expect(await page.evaluate(() => window.sameDocument)).toBe(true);
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => Boolean(document.activeElement.closest('main')))).toBe(true);
  });
});

test('a footer role link whose hash the join page already has still picks that role', async ({ page }) => {
  await page.goto('index.html');
  await settle(page);
  await page.locator('.ftr a', { hasText: 'Invest with us' }).click();
  await expect(page).toHaveURL(/join\.html#investor$/);
  await settle(page);
  const investor = page.locator('input[name="role"][value="investor"]');
  await expect(investor).toBeChecked();
  await page.locator('input[name="role"][value="founder"]').check({ force: true });
  await page.locator('.ftr a', { hasText: 'Invest with us' }).click();
  await expect(investor).toBeChecked();
  await expect(investor).toBeFocused();
  await expect(investor).toBeInViewport();
});
