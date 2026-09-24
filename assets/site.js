/* Berkeley Summit House: behaviour.
   Progressive enhancement throughout: every page reads fine without it. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const icon = name => (window.BSH ? window.BSH.icon(name) : '');
  const onFrame = fn => { let queued = false; return () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; fn(); }); }; };

  /* ------------------------------------------------------------ global nav */
  const gnToggle = $('[data-gn-toggle]');
  const gnMenu = $('[data-gn-menu]');
  const setMenu = open => {
    if (!gnMenu) return;
    gnMenu.hidden = !open;
    gnToggle.setAttribute('aria-expanded', String(open));
    document.documentElement.classList.toggle('gn-open', open);
    document.documentElement.style.overflow = open ? 'hidden' : '';
  };
  if (gnToggle && gnMenu) {
    gnToggle.addEventListener('click', () => setMenu(gnMenu.hidden));
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !gnMenu.hidden) { setMenu(false); gnToggle.focus(); } });
    gnMenu.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
    matchMedia('(min-width: 834px)').addEventListener('change', e => { if (e.matches) setMenu(false); });
  }

  /* ------------------------------------------------------------- local nav */
  const lnToggle = $('[data-ln-toggle]');
  const lnItems = $('[data-ln-items]');
  if (lnToggle && lnItems) {
    const setLn = open => { lnItems.classList.toggle('is-open', open); lnToggle.setAttribute('aria-expanded', String(open)); };
    lnToggle.addEventListener('click', () => setLn(!lnItems.classList.contains('is-open')));
    lnItems.addEventListener('click', e => { if (e.target.closest('a')) setLn(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') setLn(false); });
  }
  // The section you're reading is marked in the local nav.
  const lnLinks = $$('[data-ln-items] a[href^="#"]');
  if (lnLinks.length && 'IntersectionObserver' in window) {
    const byId = new Map(lnLinks.map(a => [a.getAttribute('href').slice(1), a]));
    const spy = new IntersectionObserver(entries => entries.forEach(e => {
      if (!e.isIntersecting) return;
      lnLinks.forEach(a => a.removeAttribute('aria-current'));
      const link = byId.get(e.target.id);
      if (link) link.setAttribute('aria-current', 'true');
    }), { rootMargin: '-45% 0px -50% 0px' });
    byId.forEach((_, id) => { const el = document.getElementById(id); if (el) spy.observe(el); });
  }
  // In-page links land below the sticky local nav.
  const ln = $('[data-ln]');
  if (ln) document.documentElement.style.scrollPaddingTop = `${ln.offsetHeight + 8}px`;

  /* ------------------------------------------------------------ copy email */
  document.addEventListener('click', async e => {
    const btn = e.target.closest('[data-copy]');
    if (!btn) return;
    try {
      await navigator.clipboard.writeText(btn.dataset.copy);
      btn.textContent = 'Copied';
    } catch (err) {
      const range = document.createRange();
      range.selectNodeContents(btn.previousElementSibling);
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      btn.textContent = 'Selected';
    }
    btn.dataset.state = 'done';
    clearTimeout(btn._t);
    btn._t = setTimeout(() => { btn.textContent = 'Copy'; delete btn.dataset.state; }, 2200);
  });

  /* ------------------------------------------------------------- reveals
     Content rests visible. An element is hidden only just before it scrolls
     into view, then eases up into place. */
  if (!reduceMotion && 'IntersectionObserver' in window) {
    const shown = new IntersectionObserver(entries => entries.forEach(e => {
      if (!e.isIntersecting) return;
      shown.unobserve(e.target);
      requestAnimationFrame(() => e.target.classList.add('is-in'));
    }), { rootMargin: '0px 0px -8% 0px' });
    const armer = new IntersectionObserver(entries => entries.forEach(e => {
      if (!e.isIntersecting) return;
      armer.unobserve(e.target);
      const r = e.target.getBoundingClientRect();
      if (r.top > innerHeight) e.target.classList.add('is-armed');
      shown.observe(e.target);
    }), { rootMargin: '0px 0px 70% 0px' });
    $$('.reveal').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.top < innerHeight) return; // already on screen: leave it be
      armer.observe(el);
    });
  }

  /* ------------------------------------------------- words that light up */
  const lits = $$('[data-lit]');
  lits.forEach(el => {
    const words = el.textContent.trim().split(/\s+/);
    el.textContent = '';
    el._words = words.map((w, i) => {
      const span = document.createElement('span');
      span.className = 'w';
      span.textContent = w;
      el.append(span);
      if (i < words.length - 1) el.append(' ');
      return span;
    });
    el._n = -1;
  });
  const updateLit = () => {
    const vh = innerHeight;
    lits.forEach(el => {
      const r = el.getBoundingClientRect();
      let n;
      if (reduceMotion) n = el._words.length;
      else {
        const start = vh * 0.85, end = vh * 0.35;
        const p = (start - r.top) / (start - end + r.height * 0.55);
        n = Math.round(clamp(p, 0, 1) * el._words.length);
      }
      if (n === el._n) return;
      el._n = n;
      el._words.forEach((w, i) => w.classList.toggle('on', i < n));
    });
  };

  /* -------------------------------------- hero image eases forward on scroll */
  const heroMedia = $$('[data-hero-scale]');
  const updateHero = () => {
    if (reduceMotion) return;
    const vh = innerHeight;
    heroMedia.forEach(el => {
      const r = el.getBoundingClientRect();
      const p = clamp((vh - r.top) / (vh * 0.9), 0, 1);
      el.style.transform = `scale(${(0.9 + 0.1 * p).toFixed(4)})`;
    });
  };

  // Above the first section, nothing in the local nav is current.
  const firstSection = lnLinks.length ? document.getElementById(lnLinks[0].getAttribute('href').slice(1)) : null;
  const updateSpy = () => {
    if (firstSection && firstSection.getBoundingClientRect().top > innerHeight * 0.5) {
      lnLinks.forEach(a => a.removeAttribute('aria-current'));
    }
  };

  const onScroll = onFrame(() => { updateLit(); updateHero(); updateSpy(); });
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  onScroll();

  /* --------------------------------------------------------------- gallery */
  $$('[data-gallery]').forEach(g => {
    const track = $('.gallery-track', g);
    const slides = $$('.slide', track);
    const dots = $$('.dot', g);
    const btn = $('.play-btn', g);
    const DWELL = 5000;
    g.style.setProperty('--dwell', `${DWELL / 1000}s`);
    let index = 0, timer = null, playing = !reduceMotion, visible = false;

    const restartFill = () => {
      const fill = dots[index] && $('i', dots[index]);
      if (!fill) return;
      fill.style.animation = 'none';
      void fill.offsetWidth;
      fill.style.animation = '';
    };
    const setActive = i => {
      dots.forEach((d, k) => {
        d.setAttribute('aria-selected', String(k === i));
        d.tabIndex = k === i ? 0 : -1;
      });
      slides.forEach((s, k) => s.setAttribute('aria-hidden', String(k !== i)));
    };
    const schedule = () => {
      clearTimeout(timer);
      if (playing && visible) timer = setTimeout(() => go(index + 1), DWELL);
    };
    const paintBtn = () => {
      btn.innerHTML = icon(playing ? 'pause' : 'play');
      btn.setAttribute('aria-label', playing ? 'Pause the slideshow' : 'Play the slideshow');
      g.dataset.playing = String(playing && visible);
    };
    const go = (i, byUser) => {
      index = (i + slides.length) % slides.length;
      const s = slides[index];
      track.scrollTo({ left: s.offsetLeft - (track.clientWidth - s.clientWidth) / 2, behavior: reduceMotion ? 'auto' : 'smooth' });
      setActive(index);
      if (byUser) { playing = false; paintBtn(); clearTimeout(timer); return; }
      restartFill();
      schedule();
    };
    const stop = () => { playing = false; clearTimeout(timer); paintBtn(); };

    btn.addEventListener('click', () => {
      playing = !playing;
      paintBtn();
      if (playing) { restartFill(); schedule(); } else clearTimeout(timer);
    });
    dots.forEach((d, k) => {
      d.addEventListener('click', () => go(k, true));
      d.addEventListener('keydown', e => {
        const next = { ArrowRight: k + 1, ArrowLeft: k - 1, Home: 0, End: dots.length - 1 }[e.key];
        if (next === undefined) return;
        e.preventDefault();
        const j = (next + dots.length) % dots.length;
        go(j, true);
        dots[j].focus();
      });
    });
    // Follow swipes and trackpad scrolls.
    const seen = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting && e.intersectionRatio >= 0.6) {
        const k = slides.indexOf(e.target);
        if (k !== index) { index = k; setActive(k); if (playing) { restartFill(); schedule(); } }
      }
    }), { root: track, threshold: [0.6] });
    slides.forEach(s => seen.observe(s));
    track.addEventListener('pointerdown', stop);
    track.addEventListener('wheel', e => { if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) stop(); }, { passive: true });
    g.addEventListener('focusin', e => { if (e.target.closest('.slide')) stop(); });
    // Only advance while the gallery is on screen.
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      paintBtn();
      if (visible && playing) { restartFill(); schedule(); } else clearTimeout(timer);
    }, { threshold: 0.35 }).observe(g);

    setActive(0);
    paintBtn();
  });

  /* ------------------------------------------------------------------ tabs */
  $$('[data-tabs]').forEach(root => {
    const tabs = $$('[role="tab"]', root);
    const panels = tabs.map(t => document.getElementById(t.getAttribute('aria-controls')));
    const select = (i, focus) => {
      tabs.forEach((t, k) => {
        t.setAttribute('aria-selected', String(k === i));
        t.tabIndex = k === i ? 0 : -1;
        panels[k].hidden = k !== i;
      });
      if (focus) tabs[i].focus();
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => select(i));
      t.addEventListener('keydown', e => {
        const n = tabs.length;
        const next = { ArrowRight: i + 1, ArrowLeft: i - 1 + n, Home: 0, End: n - 1 }[e.key];
        if (next === undefined) return;
        e.preventDefault();
        select(next % n, true);
      });
    });
  });

  /* ------------------------------------------------------- events: filter */
  const filter = $('[data-filter]');
  if (filter) {
    const buttons = $$('button', filter);
    const rows = $$('[data-year]');
    const status = $('[data-filter-status]');
    buttons.forEach(b => b.addEventListener('click', () => {
      buttons.forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      const year = b.dataset.value;
      let shown = 0;
      rows.forEach(r => {
        const on = year === 'all' || r.dataset.year === year;
        r.hidden = !on;
        if (on) shown += 1;
      });
      if (status) status.textContent = `${shown} ${shown === 1 ? 'gathering' : 'gatherings'}`;
    }));
  }

  /* ------------------------------------------------------------- shelves */
  $$('[data-shelf]').forEach(root => {
    const track = $('.shelf', root);
    const prev = $('[data-dir="-1"]', root);
    const next = $('[data-dir="1"]', root);
    if (!track || !prev || !next) return;
    const step = () => (track.firstElementChild ? track.firstElementChild.getBoundingClientRect().width : 320) + 20;
    const update = () => {
      prev.disabled = track.scrollLeft < 8;
      next.disabled = track.scrollLeft + track.clientWidth > track.scrollWidth - 8;
    };
    prev.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: reduceMotion ? 'auto' : 'smooth' }));
    next.addEventListener('click', () => track.scrollBy({ left: step(), behavior: reduceMotion ? 'auto' : 'smooth' }));
    track.addEventListener('scroll', onFrame(update), { passive: true });
    addEventListener('resize', onFrame(update));
    update();
  });

  /* ------------------------------------------------------------- lightbox */
  const lightbox = $('[data-lightbox]');
  const albumData = $('#albums');
  if (lightbox && albumData && typeof lightbox.showModal === 'function') {
    const ALBUMS = JSON.parse(albumData.textContent);
    const img = $('.lightbox-img', lightbox);
    const title = $('[data-lb-title]', lightbox);
    const meta = $('[data-lb-meta]', lightbox);
    const count = $('[data-lb-count]', lightbox);
    let album = null, idx = 0, opener = null;
    const show = i => {
      const photos = album.photos;
      idx = (i + photos.length) % photos.length;
      const [src, alt] = photos[idx];
      img.src = src;
      img.alt = alt;
      title.textContent = album.title;
      meta.textContent = `${album.meta} · ${idx + 1} of ${photos.length}`;
      count.textContent = `Photo ${idx + 1} of ${photos.length}`;
      $$('[data-lb-step]', lightbox).forEach(b => { b.hidden = photos.length < 2; });
    };
    document.addEventListener('click', e => {
      const t = e.target.closest('[data-album]');
      if (!t || !ALBUMS[t.dataset.album]) return;
      opener = t;
      album = ALBUMS[t.dataset.album];
      show(Number(t.dataset.index || 0));
      lightbox.showModal();
    });
    $$('[data-lb-step]', lightbox).forEach(b => b.addEventListener('click', () => show(idx + Number(b.dataset.lbStep))));
    $('[data-lb-close]', lightbox).addEventListener('click', () => lightbox.close());
    lightbox.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') show(idx + 1);
      if (e.key === 'ArrowLeft') show(idx - 1);
    });
    lightbox.addEventListener('close', () => { if (opener) opener.focus(); });
  }

  /* ------------------------------------------------------------- join form */
  const form = $('#join-form');
  if (form) {
    // Country calling codes, from the current form with names brought up to date.
    const DIAL = '1 United States|93 Afghanistan|355 Albania|213 Algeria|376 Andorra|244 Angola|1268 Antigua and Barbuda|54 Argentina|374 Armenia|297 Aruba|61 Australia|43 Austria|994 Azerbaijan|1242 Bahamas|973 Bahrain|880 Bangladesh|1246 Barbados|375 Belarus|32 Belgium|501 Belize|229 Benin|975 Bhutan|591 Bolivia|387 Bosnia and Herzegovina|267 Botswana|55 Brazil|246 British Indian Ocean Territory|673 Brunei|359 Bulgaria|226 Burkina Faso|257 Burundi|855 Cambodia|237 Cameroon|1 Canada|238 Cape Verde|599 Caribbean Netherlands|1345 Cayman Islands|236 Central African Republic|235 Chad|56 Chile|86 China|57 Colombia|269 Comoros|243 Congo (DRC)|242 Congo (Republic)|506 Costa Rica|225 Côte d’Ivoire|385 Croatia|53 Cuba|599 Curaçao|357 Cyprus|420 Czechia|45 Denmark|253 Djibouti|1767 Dominica|1809 Dominican Republic|593 Ecuador|20 Egypt|503 El Salvador|240 Equatorial Guinea|291 Eritrea|372 Estonia|268 Eswatini|251 Ethiopia|298 Faroe Islands|679 Fiji|358 Finland|33 France|594 French Guiana|689 French Polynesia|241 Gabon|220 Gambia|995 Georgia|49 Germany|233 Ghana|350 Gibraltar|30 Greece|299 Greenland|1473 Grenada|590 Guadeloupe|1671 Guam|502 Guatemala|224 Guinea|245 Guinea-Bissau|592 Guyana|509 Haiti|504 Honduras|852 Hong Kong|36 Hungary|354 Iceland|91 India|62 Indonesia|98 Iran|964 Iraq|353 Ireland|972 Israel|39 Italy|1876 Jamaica|81 Japan|962 Jordan|7 Kazakhstan|254 Kenya|686 Kiribati|383 Kosovo|965 Kuwait|996 Kyrgyzstan|856 Laos|371 Latvia|961 Lebanon|266 Lesotho|231 Liberia|218 Libya|423 Liechtenstein|370 Lithuania|352 Luxembourg|853 Macau|261 Madagascar|265 Malawi|60 Malaysia|960 Maldives|223 Mali|356 Malta|692 Marshall Islands|596 Martinique|222 Mauritania|230 Mauritius|262 Mayotte|52 Mexico|691 Micronesia|373 Moldova|377 Monaco|976 Mongolia|382 Montenegro|212 Morocco|258 Mozambique|95 Myanmar|264 Namibia|674 Nauru|977 Nepal|31 Netherlands|687 New Caledonia|64 New Zealand|505 Nicaragua|227 Niger|234 Nigeria|850 North Korea|389 North Macedonia|47 Norway|968 Oman|92 Pakistan|680 Palau|970 Palestine|507 Panama|675 Papua New Guinea|595 Paraguay|51 Peru|63 Philippines|48 Poland|351 Portugal|1787 Puerto Rico|974 Qatar|262 Réunion|40 Romania|7 Russia|250 Rwanda|1869 Saint Kitts and Nevis|1758 Saint Lucia|508 Saint Pierre and Miquelon|1784 Saint Vincent and the Grenadines|685 Samoa|378 San Marino|239 São Tomé and Príncipe|966 Saudi Arabia|221 Senegal|381 Serbia|248 Seychelles|232 Sierra Leone|65 Singapore|421 Slovakia|386 Slovenia|677 Solomon Islands|252 Somalia|27 South Africa|82 South Korea|211 South Sudan|34 Spain|94 Sri Lanka|249 Sudan|597 Suriname|46 Sweden|41 Switzerland|963 Syria|886 Taiwan|992 Tajikistan|255 Tanzania|66 Thailand|670 Timor-Leste|228 Togo|676 Tonga|1868 Trinidad and Tobago|216 Tunisia|90 Türkiye|993 Turkmenistan|688 Tuvalu|256 Uganda|380 Ukraine|971 United Arab Emirates|44 United Kingdom|598 Uruguay|998 Uzbekistan|678 Vanuatu|379 Vatican City|58 Venezuela|84 Vietnam|681 Wallis and Futuna|967 Yemen|260 Zambia|263 Zimbabwe';
    const dial = $('#phone-country');
    if (dial) {
      DIAL.split('|').forEach((entry, i) => {
        const sp = entry.indexOf(' ');
        const code = entry.slice(0, sp), name = entry.slice(sp + 1);
        const opt = new Option(`+${code}  ${name}`, `${code}|${name}`);
        if (i === 0) opt.selected = true;
        dial.add(opt);
      });
    }

    // #founder, #investor… from links elsewhere on the site.
    const preset = decodeURIComponent(location.hash.slice(1));
    const presetInput = preset && form.querySelector(`input[name="network"][value="${CSS.escape(preset)}"]`);
    if (presetInput) presetInput.checked = true;

    const RULES = {
      'first-name': v => (v.trim() ? '' : 'Enter your first name.'),
      'last-name': v => (v.trim() ? '' : 'Enter your last name.'),
      organization: v => (v.trim() ? '' : 'Enter your organization. Independent is fine.'),
      email: v => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? '' : 'Enter a valid email address.'),
      phone: v => (v.replace(/\D/g, '').length >= 6 ? '' : 'Enter a phone number so we can schedule a call.'),
      linkedin: v => (/linkedin\.com\/.+/i.test(v.trim()) ? '' : 'Enter your LinkedIn profile URL.'),
    };
    let tried = false;
    const check = id => {
      const input = $(`#${id}`, form);
      const fld = input.closest('.fld');
      const msg = RULES[id](input.value);
      const err = $(`#${id}-error`, form);
      fld.classList.toggle('is-invalid', Boolean(msg));
      input.setAttribute('aria-invalid', String(Boolean(msg)));
      err.hidden = !msg;
      err.innerHTML = msg ? `${icon('info')}<span></span>` : '';
      if (msg) err.lastChild.textContent = msg;
      return !msg;
    };
    Object.keys(RULES).forEach(id => {
      const input = $(`#${id}`, form);
      input.addEventListener('blur', () => { if (tried || input.value) check(id); });
      input.addEventListener('input', () => { if (tried) check(id); });
    });

    const alertBox = $('#form-alert');
    form.addEventListener('submit', e => {
      e.preventDefault();
      tried = true;
      const bad = Object.keys(RULES).filter(id => !check(id));
      if (bad.length) {
        alertBox.hidden = false;
        $('span', alertBox).textContent = bad.length === 1
          ? 'One field needs your attention.'
          : `${bad.length} fields need your attention.`;
        $(`#${bad[0]}`, form).focus();
        return;
      }
      alertBox.hidden = true;
      const done = $('#join-success');
      $('[data-first-name]', done).textContent = $('#first-name', form).value.trim();
      form.hidden = true;
      done.hidden = false;
      done.focus();
      done.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    });
  }
})();
