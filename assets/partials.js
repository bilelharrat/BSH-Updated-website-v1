/* Berkeley Summit House: shared page chrome.
   Loaded synchronously in <head> so the navigation is in place for the first
   paint. Each custom element maps one-to-one onto a component in the
   production build: <GlobalNav />, <LocalNav />, <Footer />, <Icon />. */
(() => {
  const EMAIL = 'founders@berkeleysummithouse.org';
  const LINKS = {
    luma: 'https://luma.com/berkeleysummithouse',
    linkedin: 'https://www.linkedin.com/company/berkeley-summit-house/',
    youtube: 'https://www.youtube.com/@berkeleysummithouse',
  };

  // The BSH mountain mark, exactly as drawn in the brand file.
  const MARK = '<path d="M54.2302 10.179L73.2761 44.8541C73.974 46.119 75.5732 46.5843 76.8381 45.8573L89.6323 38.5733C91.0426 37.7737 92.8309 38.4425 93.3688 39.9836L100.609 60.876C101.191 62.5625 99.9404 64.3217 98.1521 64.3217H38.9499C37.2488 64.3217 36.013 62.7224 36.4346 61.0795L49.4469 10.7751C50.0285 8.49246 53.1107 8.11445 54.2302 10.179Z"/><path d="M36.202 40.3179L29.0925 62.5333C28.7436 63.6091 27.755 64.3361 26.6209 64.3361H3.48961C0.974389 64.3361 -0.0724086 61.1375 1.94849 59.6546L32.1893 37.4392C34.2102 35.9562 36.9726 37.9335 36.202 40.3179Z"/>';
  const mark = cls => `<svg class="${cls}" viewBox="0 0 101 65" fill="currentColor" aria-hidden="true" focusable="false">${MARK}</svg>`;

  // A small line-icon set drawn on a 24px grid: one stroke weight, round ends.
  const ICONS = {
    chevronRight: '<path d="M9.5 5.5 16 12l-6.5 6.5"/>',
    chevronLeft: '<path d="M14.5 5.5 8 12l6.5 6.5"/>',
    chevronDown: '<path d="M5.5 9.5 12 16l6.5-6.5"/>',
    arrowUpRight: '<path d="M7.5 16.5l9-9M9 7.5h7.5V15"/>',
    close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
    check: '<path d="M5.5 12.5l4.2 4.2 8.8-8.9"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.2"/><path d="M12 7.9v.2"/>',
    house: '<path d="M4 11.2 12 4.5l8 6.7"/><path d="M6.2 9.6v9.9h11.6V9.6"/><path d="M10.2 19.5v-5h3.6v5"/>',
    trend: '<path d="M3.5 17 9 11.5l4 4 7.5-7.5"/><path d="M15 8h5.5v5.5"/>',
    sparkles: '<path d="M11 3.5l1.6 4.9 4.9 1.6-4.9 1.6-1.6 4.9-1.6-4.9L4.5 10l4.9-1.6Z"/><path d="M18 14.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8Z"/>',
    graduation: '<path d="M2.5 9.5 12 5l9.5 4.5L12 14Z"/><path d="M6.5 11.6v4.1c0 1.3 2.5 2.8 5.5 2.8s5.5-1.5 5.5-2.8v-4.1"/><path d="M21.5 9.5V15"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 9.8h17"/><path d="M8 3v3.8M16 3v3.8"/>',
    people: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3.3 19.2c.6-3 2.9-4.9 5.7-4.9s5.1 1.9 5.7 4.9"/><circle cx="16.8" cy="9.2" r="2.6"/><path d="M15.9 14.4c2.4.1 4.2 1.8 4.8 4.4"/>',
    globe: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5c-2.5 2.3-3.9 5.3-3.9 8.5s1.4 6.2 3.9 8.5c2.5-2.3 3.9-5.3 3.9-8.5S14.5 5.8 12 3.5Z"/><path d="M3.8 9.4h16.4M3.8 14.6h16.4"/>',
    flame: '<path d="M12 3.2c.4 3.3 4.9 5.2 4.9 10.1a4.9 4.9 0 0 1-9.8 0c0-2.3 1.1-3.9 2.4-5 .2 1.6 1 2.7 2.2 3.2-.7-2.8-.4-5.6.3-8.3Z"/>',
    heart: '<path d="M12 19.6S4.5 15 4.5 9.4A4.1 4.1 0 0 1 12 7.2a4.1 4.1 0 0 1 7.5 2.2c0 5.6-7.5 10.2-7.5 10.2Z"/>',
    ripples: '<circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="5.2"/><circle cx="12" cy="12" r="8.6"/>',
    book: '<path d="M12 6.6C10.2 5.2 7.7 4.5 4.5 4.5v13c3.2 0 5.7.7 7.5 2.1 1.8-1.4 4.3-2.1 7.5-2.1v-13c-3.2 0-5.7.7-7.5 2.1Z"/><path d="M12 6.6v13"/>',
    scales: '<path d="M12 4v15.5M8.5 19.5h7M5 7.5h14"/><path d="M5 7.5l-2.4 5.7h4.8Z"/><path d="M19 7.5l-2.4 5.7h4.8Z"/>',
    brush: '<path d="M19.8 4.2a1.4 1.4 0 0 0-2 0l-7.1 7.1 2 2 7.1-7.1a1.4 1.4 0 0 0 0-2Z"/><path d="M10.6 13.4c-1.5-1.5-4.1-1.3-5.2.5-.7 1.1-.6 2.3-1.3 3.3-.4.6-.9.9-1.4 1 2.9 1 6.3.6 7.9-1.4 1-1.1 1.1-2.4 0-3.4Z"/>',
    bubbles: '<path d="M4.5 5h9a2 2 0 0 1 2 2v4.8a2 2 0 0 1-2 2H9l-3.4 2.8v-2.8H4.5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/><path d="M17.8 9h1.7a2 2 0 0 1 2 2v4.6a2 2 0 0 1-2 2h-1v2.6l-3.3-2.6H12"/>',
    trophy: '<path d="M8 4h8v5.2a4 4 0 0 1-8 0Z"/><path d="M8 6H4.8v1.3A3.3 3.3 0 0 0 8 10.6M16 6h3.2v1.3a3.3 3.3 0 0 1-3.2 3.3"/><path d="M12 13.2V17M9 20h6M10 17h4v3h-4Z"/>',
    flask: '<path d="M9.5 3.5h5M10.6 3.5v5.4l-5.2 8.9A1.9 1.9 0 0 0 7 20.5h10a1.9 1.9 0 0 0 1.6-2.7l-5.2-8.9V3.5"/><path d="M7.6 14.5h8.8"/>',
    tent: '<path d="M2.5 19.5h19"/><path d="M12 4.5 4.3 19.5M12 4.5l7.7 15"/><path d="M9.6 19.5l2.4-5.1 2.4 5.1"/>',
    link: '<path d="M10.4 13.6a3.8 3.8 0 0 0 5.4 0l2.8-2.8a3.8 3.8 0 0 0-5.4-5.4l-1 1"/><path d="M13.6 10.4a3.8 3.8 0 0 0-5.4 0l-2.8 2.8a3.8 3.8 0 0 0 5.4 5.4l1-1"/>',
    box: '<path d="M3.5 7.6 12 3.6l8.5 4v8.8L12 20.4l-8.5-4Z"/><path d="M3.5 7.6 12 11.6l8.5-4M12 11.6v8.8"/>',
    mappin: '<path d="M12 20.8s-6.2-5.3-6.2-10.6a6.2 6.2 0 0 1 12.4 0c0 5.3-6.2 10.6-6.2 10.6Z"/><circle cx="12" cy="10.2" r="2.2"/>',
    mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/><path d="m4.2 7.2 7.8 5.8 7.8-5.8"/>',
    photo: '<rect x="3.5" y="5" width="17" height="14" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="m4 17 4.8-4.4 3.4 3 3.3-2.8 4.5 3.8"/>',
    play: '<path d="M8 5.8v12.4a.9.9 0 0 0 1.4.8l9.6-6.2a.9.9 0 0 0 0-1.6L9.4 5a.9.9 0 0 0-1.4.8Z" fill="currentColor" stroke="none"/>',
    pause: '<rect x="6.5" y="5.5" width="3.8" height="13" rx="1" fill="currentColor" stroke="none"/><rect x="13.7" y="5.5" width="3.8" height="13" rx="1" fill="currentColor" stroke="none"/>',
  };
  const icon = (name, cls = 'icon') =>
    `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name] || ''}</svg>`;

  window.BSH = { EMAIL, LINKS, icon };

  const PAGES = [
    ['story', 'Our Story', 'story.html'],
    ['ventures', 'Ventures', 'ventures.html'],
    ['incubator', 'Incubator', 'incubator.html'],
    ['foundation', 'Foundation', 'foundation.html'],
    ['events', 'Events', 'events.html'],
    ['join', 'Join', 'join.html'],
  ];

  /* <bsh-icon name="globe"> */
  class BshIcon extends HTMLElement {
    connectedCallback() { if (!this.firstChild) this.innerHTML = icon(this.getAttribute('name')); }
  }

  /* <bsh-globalnav current="ventures" dark> */
  class BshGlobalNav extends HTMLElement {
    connectedCallback() {
      if (this.dataset.ready) return;
      this.dataset.ready = '1';
      const current = this.getAttribute('current') || '';
      const dark = this.hasAttribute('dark');
      const items = PAGES.map(([key, label, href]) =>
        `<li><a href="${href}"${key === current ? ' aria-current="page"' : ''}>${label}</a></li>`).join('');
      this.innerHTML = `
        <a class="skip" href="#main">Skip to content</a>
        <nav class="gn${dark ? ' gn--dark' : ''}" aria-label="Global" data-gn>
          <div class="gn-bar">
            <a class="gn-logo" href="index.html"><span class="visually-hidden">Berkeley Summit House</span>${mark('gn-mark')}</a>
            <ul class="gn-list">${items}</ul>
            <button class="gn-menu-btn" type="button" aria-expanded="false" aria-controls="gn-menu" data-gn-toggle>
              <span class="visually-hidden">Menu</span><span class="gn-burger" aria-hidden="true"><i></i><i></i></span>
            </button>
          </div>
          <div class="gn-menu" id="gn-menu" data-gn-menu hidden>
            <ul>
              <li><a href="index.html"${current === 'home' ? ' aria-current="page"' : ''}>Home</a></li>
              ${items}
            </ul>
          </div>
        </nav>`;
    }
  }

  /* <bsh-localnav title="Ventures" links="Overview:#overview|Portfolio:#portfolio" cta="Pitch us" cta-href="join.html#founder" dark> */
  class BshLocalNav extends HTMLElement {
    connectedCallback() {
      if (this.dataset.ready) return;
      this.dataset.ready = '1';
      const title = this.getAttribute('title') || '';
      const dark = this.hasAttribute('dark');
      const links = (this.getAttribute('links') || '').split('|').filter(Boolean).map(pair => {
        const i = pair.indexOf(':');
        return [pair.slice(0, i), pair.slice(i + 1)];
      });
      const cta = this.getAttribute('cta');
      const ctaHref = this.getAttribute('cta-href') || 'join.html';
      const external = /^https?:/.test(ctaHref);
      this.removeAttribute('title'); // keep the tooltip off the whole bar
      this.innerHTML = `
        <nav class="ln${dark ? ' ln--dark' : ''}" aria-label="${title}" data-ln>
          <div class="ln-bar">
            <a class="ln-title" href="#top">${title}</a>
            <div class="ln-right">
              ${links.length ? `<button class="ln-toggle" type="button" aria-expanded="false" aria-controls="ln-items" data-ln-toggle>
                <span class="visually-hidden">Sections</span>${icon('chevronDown')}</button>` : ''}
              <ul class="ln-items" id="ln-items" data-ln-items>
                ${links.map(([label, href]) => `<li><a href="${href}">${label}</a></li>`).join('')}
              </ul>
              ${cta ? `<a class="ln-cta" href="${ctaHref}"${external ? ' target="_blank" rel="noopener"' : ''}>${cta}</a>` : ''}
            </div>
          </div>
        </nav>`;
    }
  }

  /* <bsh-footer crumb="Ventures"> */
  class BshFooter extends HTMLElement {
    connectedCallback() {
      if (this.dataset.ready) return;
      this.dataset.ready = '1';
      const crumb = this.getAttribute('crumb');
      const out = (label, href) =>
        `<a href="${href}" target="_blank" rel="noopener">${label}<span class="visually-hidden"> (opens in a new tab)</span></a>`;
      this.innerHTML = `
        <footer class="ft">
          <div class="ft-inner">
            <div class="ft-notes">
              <p>Event dates and places come from the Berkeley Summit House calendar on Luma. Photos are from Berkeley Summit House community events.</p>
              <p>This site is a design prototype. The join form does not send submissions yet.</p>
            </div>
            <nav class="ft-crumbs" aria-label="Breadcrumbs">
              <a href="index.html" class="ft-crumb-home"><span class="visually-hidden">Berkeley Summit House</span>${mark('ft-mark')}</a>
              ${crumb ? `${icon('chevronRight', 'ft-sep')}<span>${crumb}</span>` : ''}
            </nav>
            <div class="ft-dir">
              <div>
                <h3>Explore</h3>
                <ul>
                  <li><a href="story.html">Our Story</a></li>
                  <li><a href="ventures.html">Ventures</a></li>
                  <li><a href="incubator.html">Incubator</a></li>
                  <li><a href="foundation.html">Foundation</a></li>
                  <li><a href="events.html">Events</a></li>
                </ul>
              </div>
              <div>
                <h3>Community</h3>
                <ul>
                  <li><a href="join.html">Join the Community</a></li>
                  <li>${out('Event Calendar', LINKS.luma)}</li>
                  <li>${out('LinkedIn', LINKS.linkedin)}</li>
                  <li>${out('YouTube', LINKS.youtube)}</li>
                </ul>
              </div>
              <div>
                <h3>Contact</h3>
                <ul>
                  <li class="ft-email"><a href="mailto:${EMAIL}">${EMAIL.replace('@', '@<wbr>')}</a> <button type="button" class="ft-copy" data-copy="${EMAIL}">Copy</button></li>
                  <li>Berkeley Hills, California</li>
                </ul>
              </div>
            </div>
            <div class="ft-legal">
              <p>Copyright © 2026 Berkeley Summit House. All rights reserved.</p>
              <p>Berkeley, California</p>
            </div>
          </div>
        </footer>`;
    }
  }

  customElements.define('bsh-icon', BshIcon);
  customElements.define('bsh-globalnav', BshGlobalNav);
  customElements.define('bsh-localnav', BshLocalNav);
  customElements.define('bsh-footer', BshFooter);
})();
