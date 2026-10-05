'use strict';
/* The join form with a live endpoint (data-endpoint on the form): what it
   sends, the sending state, failures and retry, the spam trap, and the
   prototype it falls back to. The endpoint is stubbed with page.route. */
const { test, expect } = require('./fixtures.cjs');
const { settle } = require('./support.cjs');

const ENDPOINT = 'https://forms.example.test/join';
const CORS = { 'access-control-allow-origin': '*' };
const ok = route => route.fulfill({ status: 200, headers: CORS, contentType: 'application/json', body: '{"ok":true}' });
const VALID = {
  'first-name': 'Ada', 'last-name': 'Lovelace', organization: 'Analytical Engines',
  email: 'ada@example.com', phone: '510 555 0100', linkedin: 'https://www.linkedin.com/in/ada',
};
const FAILED = 'We couldn’t send your details. Check your connection and try again, or email founders@berkeleysummithouse.org.';

// Failed sends log "Failed to load resource" on purpose; any other error still fails a test.
test.use({ allowErrors: true });
test.afterEach(({ errors }) => {
  expect(errors.filter(e => !e.startsWith('console: Failed to load resource'))).toEqual([]);
});

const open = async (page, endpoint = ENDPOINT) => {
  await page.goto('join.html#founder');
  await settle(page);
  if (endpoint !== null) await page.evaluate(url => { document.getElementById('join-form').dataset.endpoint = url; }, endpoint);
  for (const [id, v] of Object.entries(VALID)) await page.locator(`#${id}`).fill(v);
};
const submit = page => page.locator('#join-form [type="submit"]');
const posts = page => {
  const seen = [];
  page.on('request', r => { if (r.method() !== 'GET') seen.push(r.url()); });
  return seen;
};
const shownNotes = page => page.getByText('Design prototype').filter({ visible: true });

const expectKept = async page => {
  await expect(page.locator('#join-form')).toBeVisible();
  await expect(page.locator('#join-success')).toBeHidden();
  await expect(page.locator('input[name="role"][value="founder"]')).toBeChecked();
  for (const [id, v] of Object.entries(VALID)) await expect(page.locator(`#${id}`)).toHaveValue(v);
  await expect(page.locator('#note')).toHaveValue('Still here.');
  await expect(submit(page)).toBeEnabled();
  await expect(submit(page)).not.toHaveAttribute('aria-busy');
  await expect(submit(page)).toHaveText('Join the community');
  await expect(submit(page).locator('svg')).toHaveCount(1);
};

test('posts the form, then thanks the person', async ({ page }) => {
  let req;
  await page.route(ENDPOINT, route => { req = route.request(); return ok(route); });
  await open(page);
  await page.locator('#phone-country').selectOption('44|United Kingdom');
  await page.locator('#note').fill('A note.');
  await submit(page).click();
  await expect(page.locator('#join-success')).toBeVisible();
  await expect(page.locator('#join-success')).toBeFocused();
  await expect(page.locator('[data-role-name]')).toHaveText('a founder');
  await expect(shownNotes(page)).toHaveCount(0);
  await expect(page.locator('#form-alert')).toBeHidden();

  expect(req.method()).toBe('POST');
  expect(req.headers().accept).toBe('application/json');
  const body = await new Response(req.postDataBuffer(), { headers: { 'content-type': req.headers()['content-type'] } }).formData();
  expect([...body.keys()]).toEqual(['role', 'first-name', 'last-name', 'organization', 'email', 'phone-country', 'phone', 'linkedin', 'note', '_gotcha']);
  expect(Object.fromEntries(body)).toEqual({
    role: 'founder', ...VALID, 'phone-country': '44|United Kingdom', note: 'A note.', _gotcha: '',
  });
});

test('an endpoint set in the markup hides the prototype note from the start', async ({ page }) => {
  await page.route('**/join.html', async route => {
    const res = await route.fetch();
    const body = (await res.text()).replace('id="join-form"', `id="join-form" data-endpoint=" ${ENDPOINT} "`);
    return route.fulfill({ response: res, body });
  });
  await page.route(ENDPOINT, ok);
  await open(page, null);
  await expect(page.locator('.form-foot .small')).toBeHidden();
  await submit(page).click();
  await expect(page.locator('#join-success')).toBeVisible();
  await expect(shownNotes(page)).toHaveCount(0);
});

test('a server error keeps everything and a retry goes through', async ({ page }) => {
  let calls = 0;
  await page.route(ENDPOINT, route => (++calls === 1
    ? route.fulfill({ status: 500, headers: CORS, contentType: 'application/json', body: '{"error":"down"}' })
    : ok(route)));
  await open(page);
  await page.locator('#note').fill('Still here.');
  await submit(page).click();
  await expect(page.locator('#form-alert')).toBeVisible();
  await expect(page.locator('#form-alert')).toHaveText(FAILED);
  await expectKept(page);
  await expect(submit(page)).toBeFocused();
  await expect(page.locator('#form-alert')).toBeInViewport();
  // Enter on the restored button retries.
  await page.keyboard.press('Enter');
  await expect(page.locator('#join-success')).toBeVisible();
  expect(calls).toBe(2);
});

test('a network failure keeps everything and explains', async ({ page }) => {
  await page.route(ENDPOINT, route => route.abort('internetdisconnected'));
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await page.locator('#note').fill('Still here.');
  await submit(page).click();
  await expect(page.locator('#form-alert')).toHaveText(FAILED);
  await expect(page.locator('#form-alert')).toBeInViewport();
  await expectKept(page);
  await expect(shownNotes(page)).toHaveCount(0);
});

test('a reply that never comes gives up after 15 seconds', async ({ page }) => {
  await page.clock.install();
  const hung = [];
  await page.route(ENDPOINT, route => { hung.push(route); });
  await open(page);
  await page.locator('#note').fill('Still here.');
  // From here on, page time moves only when the test moves it.
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  await submit(page).click();
  await expect.poll(() => hung.length).toBe(1);
  await expect(submit(page)).toBeDisabled();
  await expect(submit(page)).toHaveAttribute('aria-busy', 'true');
  await expect(submit(page)).toHaveText('Sending…');
  await page.clock.fastForward(14_800);
  await expect(submit(page)).toHaveText('Sending…');
  await expect(page.locator('#form-alert')).toBeHidden();
  await page.clock.fastForward(400);
  await expect(page.locator('#form-alert')).toHaveText(FAILED);
  await expectKept(page);
});

test('submitting again while sending sends nothing more', async ({ page }) => {
  let release;
  const held = new Promise(r => { release = r; });
  await page.route(ENDPOINT, async route => { await held; await ok(route); });
  const sent = posts(page);
  await open(page);
  await submit(page).click();
  await expect(submit(page)).toBeDisabled();
  await expect(submit(page)).toHaveAttribute('aria-busy', 'true');
  await page.locator('#linkedin').press('Enter');
  await page.evaluate(() => document.getElementById('join-form').requestSubmit());
  await page.waitForTimeout(300);
  expect(sent).toEqual([ENDPOINT]);
  release();
  await expect(page.locator('#join-success')).toBeVisible();
  expect(sent).toEqual([ENDPOINT]);
});

test('while sending, the button keeps its width and the thanks keeps what was sent', async ({ page }) => {
  let release;
  const held = new Promise(r => { release = r; });
  await page.route(ENDPOINT, async route => { await held; await ok(route); });
  await open(page);
  const width = () => submit(page).evaluate(el => el.offsetWidth);
  const before = await width();
  // A slow press: the button is mid-way through its :active shrink when it submits.
  await submit(page).hover();
  await page.mouse.down();
  await page.waitForTimeout(150);
  await page.mouse.up();
  await expect(submit(page)).toHaveText('Sending…');
  expect(await width()).toBe(before);
  await page.locator('#first-name').fill('Grace');
  await page.locator('input[name="role"][value="investor"]').check({ force: true });
  release();
  await expect(page.locator('#join-success')).toBeVisible();
  await expect(page.locator('[data-first-name]')).toHaveText('Ada');
  await expect(page.locator('[data-role-name]')).toHaveText('a founder');
});

test('an invalid form is never sent', async ({ page }) => {
  const sent = posts(page);
  await open(page);
  await page.locator('#email').fill('nope');
  await submit(page).click();
  await expect(page.locator('#form-alert')).toHaveText('One thing needs your attention below.');
  await expect(page.locator('#email')).toBeFocused();
  await page.waitForTimeout(300);
  expect(sent).toEqual([]);
});

test('the spam trap is out of reach, and filling it sends nothing', async ({ page }) => {
  const sent = posts(page);
  await open(page);
  const trap = page.locator('[name="_gotcha"]');
  // Never seen, never tabbed to, never in the accessibility tree.
  expect(await trap.evaluate(el => {
    const r = el.parentElement.getBoundingClientRect();
    return r.width * r.height <= 1 && getComputedStyle(el.parentElement).overflow === 'hidden';
  })).toBe(true);
  expect(await page.getByRole('textbox').evaluateAll(els => els.some(e => e.name === '_gotcha'))).toBe(false);
  await page.locator('#note').focus();
  await page.keyboard.press('Tab');
  await expect(submit(page)).toBeFocused();

  await trap.evaluate(el => { el.value = 'https://spam.example'; });
  await submit(page).click();
  await expect(page.locator('#join-success')).toBeVisible();
  await expect(shownNotes(page)).toHaveCount(0);
  await page.waitForTimeout(300);
  expect(sent).toEqual([]);
});

test('without an endpoint it stays a prototype and sends nothing', async ({ page }) => {
  const sent = posts(page);
  await open(page, '  ');
  await submit(page).click();
  await expect(page.locator('#join-success')).toBeVisible();
  await expect(page.locator('#join-success [data-prototype-note]')).toBeVisible();
  await page.waitForTimeout(300);
  expect(sent).toEqual([]);
  expect(page.__external).toEqual([]);
});
