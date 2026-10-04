'use strict';
const { defineConfig } = require('@playwright/test');

/* PW_OUT lets several runs work side by side without sharing an output
   folder. Screenshot baselines are local (tests/.snapshots, gitignored):
   make them from a known-good commit with `npm run baseline`. */
module.exports = defineConfig({
  testDir: '.',
  outputDir: process.env.PW_OUT || '.artifacts/results',
  snapshotPathTemplate: '{testDir}/.snapshots/{testFileName}/{arg}{ext}',
  fullyParallel: true,
  workers: process.env.PW_WORKERS ? Number(process.env.PW_WORKERS) : '50%',
  timeout: 90_000,
  retries: 1,
  reporter: [['list']],
  use: {
    browserName: 'chromium',
    viewport: { width: 1280, height: 800 },
    trace: 'retain-on-failure',
  },
  expect: {
    toHaveScreenshot: { animations: 'disabled', caret: 'hide', scale: 'css', threshold: 0.2, maxDiffPixels: 40 },
  },
  projects: [
    { name: 'functional', testMatch: /functional\.spec\.cjs/ },
    { name: 'content', testMatch: /content\.spec\.cjs/ },
    { name: 'visual', testMatch: /visual\.spec\.cjs/ },
  ],
});
