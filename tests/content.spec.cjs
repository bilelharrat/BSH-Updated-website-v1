'use strict';
/* Content inventory: every piece of text (shown or hidden), every link,
   label, alt text and form value on each page, rendered chrome included.
   Formatting and markup can change freely; content cannot, unless the
   snapshot is updated on purpose. Photo file locations are left out so
   photos can move without touching this. */
const { test, expect } = require('./fixtures.cjs');
const { PAGES, settle } = require('./support.cjs');

const inventory = () => {
  const photo = /\S+\.(jpe?g|png|webp|avif)(\?\S*)?/gi;
  const clean = s => s.replace(photo, '<photo>').replace(/\s+/g, ' ').trim();
  const lines = [`title: ${document.title}`];
  for (const m of document.head.querySelectorAll('meta[name], meta[property]')) {
    lines.push(`meta ${m.getAttribute('name') || m.getAttribute('property')}: ${clean(m.content)}`);
  }
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  for (let n = walk.currentNode; n; n = walk.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) {
      const t = clean(n.textContent);
      if (t) lines.push(t);
      continue;
    }
    for (const a of ['href', 'alt', 'aria-label', 'title', 'placeholder', 'target', 'datetime', 'data-phrase']) {
      if (n.hasAttribute(a)) lines.push(`@${a}=${clean(n.getAttribute(a))}`);
    }
    if (n.matches('input[type="radio"], option')) lines.push(`@value=${n.value}`);
  }
  return lines.join('\n') + '\n';
};

for (const { file } of PAGES) {
  test(`content of ${file}`, async ({ page }) => {
    await page.goto(file);
    await settle(page);
    expect(await page.evaluate(inventory)).toMatchSnapshot(`${file}.txt`);
  });
}
