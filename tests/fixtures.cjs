'use strict';
/* Playwright fixtures: every worker serves the site on its own free port,
   every page runs hermetically, and any page error, console error or failed
   local request fails the test unless it opts out with allowErrors. */
const base = require('@playwright/test');
const { serve, hermetic } = require('./support.cjs');

const test = base.test.extend({
  site: [async ({}, use) => {
    const s = await serve();
    await use(s.url);
    await s.close();
  }, { scope: 'worker' }],

  baseURL: async ({ site }, use) => use(site),

  allowErrors: [false, { option: true }],

  errors: [async ({ page, site, allowErrors }, use) => {
    const errors = [];
    page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
    page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    page.on('response', r => {
      if (r.url().startsWith(site) && r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`);
    });
    await hermetic(page, site);
    await use(errors);
    if (!allowErrors) base.expect(errors, 'page errors').toEqual([]);
  }, { auto: true }],
});

module.exports = { test, expect: base.expect };
