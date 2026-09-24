/* Berkeley Summit House: shared page chrome.
   Loaded synchronously in <head> so the header is in place for first paint.
   Each custom element maps one-to-one onto a component in the production
   build: <SiteHeader />, <SiteFooter />, <Icon />. */
(() => {
  const EMAIL = 'founders@berkeleysummithouse.org';
  const LINKS = {
    luma: 'https://luma.com/berkeleysummithouse',
    linkedin: 'https://www.linkedin.com/company/berkeley-summit-house/',
    youtube: 'https://www.youtube.com/@berkeleysummithouse',
  };

  // The BSH mountain mark, as drawn in the brand file.
  const MARK = '<path d="M54.2302 10.179L73.2761 44.8541C73.974 46.119 75.5732 46.5843 76.8381 45.8573L89.6323 38.5733C91.0426 37.7737 92.8309 38.4425 93.3688 39.9836L100.609 60.876C101.191 62.5625 99.9404 64.3217 98.1521 64.3217H38.9499C37.2488 64.3217 36.013 62.7224 36.4346 61.0795L49.4469 10.7751C50.0285 8.49246 53.1107 8.11445 54.2302 10.179Z"/><path d="M36.202 40.3179L29.0925 62.5333C28.7436 63.6091 27.755 64.3361 26.6209 64.3361H3.48961C0.974389 64.3361 -0.0724086 61.1375 1.94849 59.6546L32.1893 37.4392C34.2102 35.9562 36.9726 37.9335 36.202 40.3179Z"/>';
  const mark = cls => `<svg class="${cls}" viewBox="0 0 101 65" fill="currentColor" aria-hidden="true" focusable="false">${MARK}</svg>`;

  // Line icons on a 24px grid, one stroke weight.
  const ICONS = {
    arrow: '<path d="M4 12h15.5M13.5 6l6 6-6 6"/>',
    arrowLeft: '<path d="M20 12H4.5M10.5 6l-6 6 6 6"/>',
    arrowUpRight: '<path d="M7 17 17 7M8.5 7H17v8.5"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6A1.5 1.5 0 0 0 14 4.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/>',
    photo: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m4 17 4.8-4.4 3.4 3 3.3-2.8 4.5 3.8"/>',
    pin: '<path d="M12 20.8s-6.2-5.3-6.2-10.6a6.2 6.2 0 0 1 12.4 0c0 5.3-6.2 10.6-6.2 10.6Z"/><circle cx="12" cy="10.2" r="2.2"/>',
    alert: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5.5M12 16.2v.3"/>',
  };
  const icon = (name, cls = 'i') =>
    `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name] || ''}</svg>`;

  window.BSH = { EMAIL, LINKS, icon, mark };

  // Every page, with the color that marks it across the site.
  const PAGES = [
    { key: 'story', label: 'Our Story', href: 'story.html', note: 'How a house became a community', tone: 'ink' },
    { key: 'ventures', label: 'Ventures', href: 'ventures.html', note: 'Backing human-centered AI', tone: 'cobalt' },
    { key: 'incubator', label: 'Incubator', href: 'incubator.html', note: 'Co-building consumer-first AI', tone: 'poppy' },
    { key: 'foundation', label: 'Foundation', href: 'foundation.html', note: 'Pathways for ages 15 to 35', tone: 'gold' },
    { key: 'events', label: 'Events', href: 'events.html', note: 'Dinners, retreats and roundtables', tone: 'ink' },
  ];

  /* <bsh-icon name="arrow"> */
  class BshIcon extends HTMLElement {
    connectedCallback() { if (!this.firstChild) this.innerHTML = icon(this.getAttribute('name')); }
  }

  /* <bsh-header current="ventures"> */
  class BshHeader extends HTMLElement {
    connectedCallback() {
      if (this.dataset.ready) return;
      this.dataset.ready = '1';
      const current = this.getAttribute('current') || '';
      const cur = key => (key === current ? ' aria-current="page"' : '');
      const nav = PAGES.map(p =>
        `<li><a class="nav-link" href="${p.href}" data-tone="${p.tone}"${cur(p.key)}><i class="tri" aria-hidden="true"></i>${p.label}</a></li>`).join('');
      const menu = PAGES.map((p, n) =>
        `<li><a class="menu-link" href="${p.href}" data-tone="${p.tone}"${cur(p.key)}>
          <span class="menu-num">0${n + 1}</span>
          <span class="menu-name">${p.label}</span>
          <span class="menu-note">${p.note}</span>
        </a></li>`).join('');
      this.innerHTML = `
        <a class="skip" href="#main">Skip to content</a>
        <header class="hdr" data-hdr>
          <div class="hdr-in">
            <a class="brand" href="index.html"${current === 'home' ? ' aria-current="page"' : ''}>
              ${mark('brand-mark')}<span class="brand-name">Berkeley Summit House</span>
            </a>
            <nav class="hdr-nav" aria-label="Main"><ul>${nav}</ul></nav>
            <div class="hdr-end">
              <a class="btn btn-sm hdr-join" href="join.html"${cur('join')}>Join</a>
              <button class="hdr-menu" type="button" aria-expanded="false" aria-controls="site-menu">
                <span class="hdr-menu-lines" aria-hidden="true"></span><span class="hdr-menu-text">Menu</span>
              </button>
            </div>
          </div>
          <div class="menu" id="site-menu" hidden>
            <nav aria-label="Main, mobile"><ul class="menu-list">${menu}</ul></nav>
            <div class="menu-foot">
              <a class="btn" href="join.html">Join the community ${icon('arrow')}</a>
              <a class="menu-mail" href="mailto:${EMAIL}">${EMAIL}</a>
            </div>
          </div>
        </header>`;
    }
  }

  /* <bsh-footer> or <bsh-footer no-cta> */
  class BshFooter extends HTMLElement {
    connectedCallback() {
      if (this.dataset.ready) return;
      this.dataset.ready = '1';
      const cta = this.hasAttribute('no-cta') ? '' : `
        <div class="ftr-cta wrap">
          <p class="label">Join the community</p>
          <h2 class="d-l balance">Pull up a chair.</h2>
          <p class="lede">Founders, investors, operators, scholars and young leaders. Tell us who you are, and we’ll find the right way in.</p>
          <div class="actions">
            <a class="btn" href="join.html">Join the community ${icon('arrow')}</a>
            <a class="btn btn-ghost" href="${LINKS.luma}" target="_blank" rel="noopener">Upcoming events ${icon('arrowUpRight')}<span class="sr"> (opens in a new tab)</span></a>
          </div>
        </div>`;
      const explore = PAGES.map(p => `<li><a href="${p.href}">${p.label}</a></li>`).join('');
      this.innerHTML = `
        <footer class="ftr f-night${cta ? '' : ' ftr--short'}" data-terrain-wrap>
          <canvas class="ftr-terrain" data-terrain data-seed="29" data-step=".08" data-peaks="a:.84,.3,.9,.16;b:.62,.12,.5,.1" data-peaks-narrow="a:.8,.18,.8,.3" aria-hidden="true"></canvas>
          ${cta}
          <div class="ftr-grid wrap">
            <div class="ftr-brand">
              <a class="brand" href="index.html">${mark('brand-mark')}<span class="brand-name">Berkeley Summit House</span></a>
              <p class="ftr-motto">Dream. Build. Grow.</p>
            </div>
            <nav class="ftr-col" aria-label="Explore"><p class="label">Explore</p><ul>${explore}</ul></nav>
            <nav class="ftr-col" aria-label="Get involved"><p class="label">Get involved</p><ul>
              <li><a href="join.html#founder">Join as a founder</a></li>
              <li><a href="join.html#investor">Invest with us</a></li>
              <li><a href="join.html#young-leader">Join as a young leader</a></li>
              <li><a href="join.html#scholar">Join as a scholar</a></li>
              <li><a href="join.html#scout">Become a scout</a></li>
            </ul></nav>
            <div class="ftr-col"><p class="label">Connect</p><ul>
              <li><a href="${LINKS.luma}" target="_blank" rel="noopener">Luma calendar<span class="sr"> (opens in a new tab)</span></a></li>
              <li><a href="${LINKS.linkedin}" target="_blank" rel="noopener">LinkedIn<span class="sr"> (opens in a new tab)</span></a></li>
              <li><a href="${LINKS.youtube}" target="_blank" rel="noopener">YouTube<span class="sr"> (opens in a new tab)</span></a></li>
            </ul>
            <p class="ftr-mail"><a href="mailto:${EMAIL}">${EMAIL}</a>
              <button class="copy-btn" type="button" data-copy="${EMAIL}" aria-label="Copy email address">${icon('copy')}<span class="copy-done" aria-hidden="true">Copied</span></button></p>
            </div>
          </div>
          <div class="ftr-base wrap">
            <p>© 2026 Berkeley Summit House</p>
            <p class="mono">Berkeley Hills, California · 37.87° N, 122.25° W</p>
          </div>
        </footer>`;
    }
  }

  customElements.define('bsh-icon', BshIcon);
  customElements.define('bsh-header', BshHeader);
  customElements.define('bsh-footer', BshFooter);
})();
