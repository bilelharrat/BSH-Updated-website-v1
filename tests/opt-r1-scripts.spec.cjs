'use strict';
/* Behaviour of app.js and chrome.js that the main contract leaves open:
   malformed links, repeated actions, resizes and the chrome's render-once
   rule. Written with the round-1 script optimisation; holds across refactors. */
const { test, expect } = require('./fixtures.cjs');
const { settle } = require('./support.cjs');

test('a malformed hash on the join page leaves the form working', async ({ page }) => {
  await page.goto('join.html#%E0%A4%A');
  await settle(page);
  await expect(page.locator('#phone-country option')).toHaveCount(218);
  await expect(page.locator('input[name="role"]:checked')).toHaveCount(0);
  await page.locator('#join-form [type="submit"]').click();
  await expect(page).toHaveURL(/join\.html#%E0%A4%A$/);
  await expect(page.locator('#form-alert')).toHaveText('7 things need your attention below.');
  await page.evaluate(() => { location.hash = '%'; });
  await page.evaluate(() => { location.hash = 'scholar'; });
  await expect(page.locator('input[name="role"][value="scholar"]')).toBeChecked();
});

test('errors keep their wording as a field goes bad, good and bad again', async ({ page }) => {
  await page.goto('join.html');
  await settle(page);
  await page.locator('#join-form [type="submit"]').click();
  const err = page.locator('#email-error');
  await expect(err).toHaveText('Enter a valid email address.');
  for (const [value, ok] of [['a', false], ['a@b.co', true], ['a@b', false], ['', false], ['x@y.org', true]]) {
    await page.locator('#email').fill(value);
    if (ok) {
      await expect(err).toBeHidden();
      await expect(err).toBeEmpty();
    } else {
      await expect(err).toBeVisible();
      await expect(err).toHaveText('Enter a valid email address.');
      await expect(err.locator('svg')).toHaveCount(1);
    }
    await expect(page.locator('#email')).toHaveAttribute('aria-invalid', String(!ok));
  }
  await page.locator('label.role').first().click();
  await expect(page.locator('#role-error')).toBeHidden();
});

test('copying twice keeps the confirmation up for the full time after the second copy', async ({ page }) => {
  // A clipboard that answers at once, so each click's confirmation starts with the click.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.resolve() } });
  });
  await page.clock.install();
  await page.goto('index.html');
  await settle(page);
  const copy = page.locator('.copy-btn');
  await copy.scrollIntoViewIfNeeded();
  // From here on, page time moves only when the test moves it.
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  await copy.click();
  await expect(copy).toHaveClass(/is-copied/);
  await page.clock.runFor(1200);
  await copy.click();
  await page.clock.runFor(1200);
  // 2.4s after the first copy, 1.2s after the second: still confirmed.
  await expect(copy).toHaveClass(/is-copied/);
  await expect(copy).toHaveAttribute('aria-label', 'Copied');
  await page.clock.runFor(700);
  await expect(copy).not.toHaveClass(/is-copied/);
  await expect(copy).toHaveAttribute('aria-label', 'Copy email address');
});

test('the strip buttons follow the strip through window resizes', async ({ page }) => {
  await page.setViewportSize({ width: 760, height: 900 });
  await page.goto('index.html');
  await settle(page);
  const strip = page.locator('[data-strip]');
  await strip.scrollIntoViewIfNeeded();
  const consistent = () => strip.evaluate(s => {
    const [prev, next] = ['-1', '1'].map(v => document.querySelector(`[data-strip-btn="${v}"]`));
    return prev.disabled === (s.scrollLeft <= 2) && next.disabled === (s.scrollLeft >= s.scrollWidth - s.clientWidth - 2);
  });
  for (const width of [1600, 900, 1920, 700]) {
    await strip.evaluate(s => { s.scrollLeft = s.scrollWidth; });
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(consistent).toBe(true);
    await strip.evaluate(s => { s.scrollLeft = 0; });
    await expect.poll(consistent).toBe(true);
  }
});

test.describe('with reduced motion', () => {
  // Reveals hold still, so chapters sit where the rail measured them.
  test.use({ contextOptions: { reducedMotion: 'reduce' } });

  test('the chapter rail follows a window resize as well as a scroll', async ({ page }) => {
    await page.goto('story.html');
    await settle(page);
    // The one current link is the last chapter whose top is above 40% of the window.
    const inStep = () => page.evaluate(() => {
      const line = innerHeight * .4;
      const links = [...document.querySelectorAll('[data-rail] a')];
      let cur = 0;
      links.forEach((a, i) => { if (document.querySelector(a.hash).getBoundingClientRect().top < line) cur = i; });
      return links.map((a, i) => a.getAttribute('aria-current') === String(i === cur)).every(Boolean);
    });
    await page.evaluate(() => scrollTo(0, document.getElementById('ch-walls').getBoundingClientRect().top + scrollY - innerHeight * 0.3));
    await expect.poll(inStep).toBe(true);
    await expect(page.locator('[data-rail] a[href="#ch-walls"]')).toHaveAttribute('aria-current', 'true');
    for (const height of [400, 1200, 700]) {
      await page.setViewportSize({ width: 1280, height });
      await expect.poll(inStep).toBe(true);
    }
    // Hidden on a phone, it catches up as soon as the window is wide enough to show it.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => scrollTo(0, document.getElementById('ch-idea').getBoundingClientRect().top + scrollY - 100));
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect.poll(inStep).toBe(true);
  });

  test('the chapter rail leaves its links alone while the reading stays in one chapter', async ({ page }) => {
    await page.goto('story.html');
    await settle(page);
    const tops = await page.evaluate(() => ['ch-founder', 'ch-walls'].map(id => document.getElementById(id).getBoundingClientRect().top + scrollY - innerHeight * .4));
    await page.evaluate(() => {
      window.__railWrites = 0;
      new MutationObserver(l => { window.__railWrites += l.length; })
        .observe(document.querySelector('[data-rail]'), { attributeFilter: ['aria-current'], subtree: true });
    });
    const frame = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const p = () => page.locator('[data-rail] ol').evaluate(ol => ol.style.getPropertyValue('--p'));
    await page.evaluate(y => scrollTo(0, y), tops[0] + 4);
    await frame();
    await expect(page.locator('[data-rail] a[href="#ch-founder"]')).toHaveAttribute('aria-current', 'true');
    const before = await page.evaluate(() => window.__railWrites);
    const progress = [];
    for (let n = 1; n <= 8; n++) {
      await page.evaluate(y => scrollTo(0, y), tops[0] + 4 + (tops[1] - tops[0] - 8) * n / 8);
      await frame();
      progress.push(await p());
    }
    // The line kept moving; the links were not touched.
    expect(new Set(progress).size).toBeGreaterThan(4);
    expect(await page.evaluate(() => window.__railWrites)).toBe(before);
    await page.evaluate(y => scrollTo(0, y), tops[1] + 4);
    await expect(page.locator('[data-rail] a[href="#ch-walls"]')).toHaveAttribute('aria-current', 'true');
    await expect(page.locator('[data-rail] a[aria-current="true"]')).toHaveCount(1);
  });
});

test('widening the window while the photo viewer is open keeps the page locked', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 800 });
  await page.goto('events.html');
  await settle(page);
  await page.locator('button.album[data-album="napa"]').click();
  await expect(page.locator('html')).toHaveClass(/menu-open/);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(200);
  await expect(page.locator('html')).toHaveClass(/menu-open/);
  await expect(page.locator('dialog[data-lightbox]')).toHaveAttribute('open', '');
  await page.keyboard.press('Escape');
  await expect(page.locator('html')).not.toHaveClass(/menu-open/);
});

test('the header and footer render once, even when moved', async ({ page }) => {
  await page.goto('ventures.html');
  await settle(page);
  await page.locator('.hdr-menu').evaluate(b => { b.dataset.mark = 'kept'; });
  await page.evaluate(() => {
    const h = document.querySelector('bsh-header'), f = document.querySelector('bsh-footer');
    document.body.prepend(h);
    document.body.append(f);
  });
  await expect(page.locator('header.hdr')).toHaveCount(1);
  await expect(page.locator('footer.ftr')).toHaveCount(1);
  await expect(page.locator('.hdr-menu')).toHaveAttribute('data-mark', 'kept');
  await expect(page.locator('.hdr [aria-current="page"]')).toHaveCount(2);
});

test('icons render their drawing, and an unknown name renders an empty icon', async ({ page }) => {
  await page.goto('index.html');
  await settle(page);
  const shapes = await page.locator('bsh-icon').evaluateAll(els => els.map(e => e.querySelector('svg.i')?.childElementCount || 0));
  expect(shapes.length).toBeGreaterThan(10);
  expect(shapes.every(n => n > 0)).toBe(true);
  const empty = await page.evaluate(() => {
    const el = document.createElement('bsh-icon');
    el.setAttribute('name', 'nope');
    document.body.append(el);
    return [el.querySelectorAll('svg').length, el.querySelector('svg').childElementCount];
  });
  expect(empty).toEqual([1, 0]);
});
