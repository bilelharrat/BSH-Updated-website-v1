/* Berkeley Summit House: page behaviour.
   Each block below is self-contained and does nothing on pages without its
   markup. In the production build each becomes one small client component. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const behavior = () => (reduce.matches ? 'auto' : 'smooth');

  /* Header: tucks away while you read down, returns when you scroll up. */
  const hdr = $('[data-hdr]');
  if (hdr) {
    let lastY = scrollY;
    addEventListener('scroll', () => {
      const y = scrollY;
      if (!root.classList.contains('menu-open')) hdr.classList.toggle('is-hidden', y > lastY && y > 240);
      lastY = y;
    }, { passive: true });
    hdr.addEventListener('focusin', () => hdr.classList.remove('is-hidden'));
  }

  /* Mobile menu */
  const menuBtn = $('.hdr-menu');
  const menu = $('#site-menu');
  if (menuBtn && menu) {
    const text = $('.hdr-menu-text', menuBtn);
    const setMenu = open => {
      if (menu.hidden === !open) return; // already so: keep the photo viewer's scroll lock
      menuBtn.setAttribute('aria-expanded', open);
      text.textContent = open ? 'Close' : 'Menu';
      menu.hidden = !open;
      root.classList.toggle('menu-open', open);
      if (open) $('a', menu)?.focus();
    };
    menuBtn.addEventListener('click', () => setMenu(menu.hidden));
    addEventListener('keydown', e => {
      if (e.key === 'Escape' && !menu.hidden) { setMenu(false); menuBtn.focus(); }
    });
    matchMedia('(min-width: 1061px)').addEventListener('change', e => { if (e.matches) setMenu(false); });
  }

  /* Copy the email address */
  $$('[data-copy]').forEach(btn => {
    let timer;
    btn.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(btn.dataset.copy); }
      catch {
        getSelection().selectAllChildren(btn.previousElementSibling || btn);
        return;
      }
      btn.classList.add('is-copied');
      btn.setAttribute('aria-label', 'Copied');
      clearTimeout(timer);
      timer = setTimeout(() => { btn.classList.remove('is-copied'); btn.setAttribute('aria-label', 'Copy email address'); }, 1800);
    });
  });

  /* Reveals: only blocks that start below the fold are held back. */
  if (!reduce.matches) {
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      io.unobserve(e.target);
    }), { rootMargin: '0px 0px -8% 0px', threshold: .08 });
    // Every read before any write.
    $$('.rv').filter(el => el.getBoundingClientRect().top > innerHeight).forEach(el => {
      el.classList.add('armed');
      io.observe(el);
    });
  }

  /* Find your way in: pick who you are, see where to start. */
  $$('[data-router]').forEach(router => {
    const opts = $$('[data-route]', router);
    const panels = $$('[data-route-panel]', router);
    const pick = (btn, focus) => {
      opts.forEach(o => o.setAttribute('aria-pressed', o === btn));
      panels.forEach(p => { p.hidden = p.dataset.routePanel !== btn.dataset.route; });
      if (focus) btn.focus();
    };
    opts.forEach((btn, i) => {
      btn.addEventListener('click', () => pick(btn));
      btn.addEventListener('keydown', e => {
        const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
        if (!step) return;
        e.preventDefault();
        pick(opts[(i + step + opts.length) % opts.length], true);
      });
    });
  });

  /* Photo strip: previous and next buttons page through it. */
  $$('[data-strip]').forEach(strip => {
    const btns = $$('[data-strip-btn]', strip.closest('section') || document);
    const update = () => {
      const x = strip.scrollLeft, max = strip.scrollWidth - strip.clientWidth - 2;
      btns.forEach(b => { b.disabled = b.dataset.stripBtn === '-1' ? x <= 2 : x >= max; });
    };
    btns.forEach(b => b.addEventListener('click', () => {
      const item = strip.firstElementChild;
      const stepPx = item ? item.getBoundingClientRect().width + 16 : strip.clientWidth * .8;
      strip.scrollBy({ left: Number(b.dataset.stripBtn) * stepPx * (innerWidth > 900 ? 2 : 1), behavior: behavior() });
    }));
    strip.addEventListener('scroll', update, { passive: true });
    // Not window resize: phone toolbars fire that on every scroll.
    new ResizeObserver(update).observe(strip);
  });

  /* Story: the chapter rail follows your reading. */
  const rail = $('[data-rail]');
  if (rail) {
    const links = $$('a[href^="#"]', rail);
    const chapters = links.map(a => $(a.getAttribute('href'))).filter(Boolean);
    const list = $('ol', rail);
    let cur;
    // Every read before any write; the links are rewritten only when the chapter changes.
    const update = () => {
      if (!rail.offsetWidth) return; // hidden on narrow screens
      const line = innerHeight * .4;
      const box = chapters.map(c => c.getBoundingClientRect());
      const now = box.reduce((n, b, i) => (b.top < line ? i : n), 0);
      const p = (line - box[0].top) / (box.at(-1).bottom - box[0].top);
      if (now !== cur) links.forEach((a, i) => a.setAttribute('aria-current', i === now));
      cur = now;
      list.style.setProperty('--p', Math.min(1, Math.max(0, p)).toFixed(3));
    };
    // Scroll events come at most once a frame, so a rAF would save nothing.
    addEventListener('scroll', update, { passive: true });
    addEventListener('resize', update);
    // Reflows move the chapters too. Its first call sets the rail up.
    new ResizeObserver(update).observe(document.body);
  }

  /* Story: a dashed trail climbs from year to year. */
  $$('[data-ascent]').forEach(el => {
    const svg = $('svg', el);
    const path = $('.ascent-path', el);
    const dots = $$('.dot', el);
    // Its first call draws the trail.
    new ResizeObserver(() => {
      const box = el.getBoundingClientRect();
      if (dots.length < 2 || !box.width) return;
      const pts = dots.map(d => {
        const r = d.getBoundingClientRect();
        return [r.left + r.width / 2 - box.left, r.top + r.height / 2 - box.top];
      });
      svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
      let d = `M${pts[0][0]} ${pts[0][1]}`;
      for (let n = 1; n < pts.length; n++) {
        const [x0, y0] = pts[n - 1], [x1, y1] = pts[n];
        d += ` C${x0 + (x1 - x0) * .45} ${y0} ${x1 - (x1 - x0) * .55} ${y1} ${x1} ${y1}`;
      }
      const [lx, ly] = pts.at(-1);
      d += ` C${lx + (box.width - lx) * .5} ${ly} ${box.width - 24} ${ly - 20} ${box.width} ${ly - 56}`;
      path.setAttribute('d', d);
    }).observe(el);
  });

  /* Events: filter the logbook by year. */
  const filter = $('[data-filter]');
  if (filter) {
    const btns = $$('button', filter);
    const rows = $$('[data-year]');
    const count = $('[data-log-count]');
    filter.addEventListener('click', e => {
      const btn = e.target.closest('button');
      if (!btn) return;
      btns.forEach(b => b.setAttribute('aria-pressed', b === btn));
      let shown = 0;
      rows.forEach(r => {
        r.hidden = btn.dataset.value !== 'all' && r.dataset.year !== btn.dataset.value;
        if (!r.hidden) shown++;
      });
      if (count) count.textContent = `${shown} gathering${shown === 1 ? '' : 's'}`;
    });
  }

  /* Events: a photo peeks out beside the pointer on rows that have one. */
  const peekRows = $$('[data-peek]');
  if (peekRows.length && matchMedia('(pointer: fine)').matches) {
    document.body.insertAdjacentHTML('beforeend', '<div class="peek" aria-hidden="true"><img alt=""></div>');
    const peek = document.body.lastElementChild, img = peek.firstChild;
    let raf = 0, x = 0, y = 0;
    const place = () => { raf = 0; peek.style.transform = `translate(${x + 24}px, ${y - 90}px)`; };
    peekRows.forEach(row => {
      row.addEventListener('pointerenter', () => { img.src = row.dataset.peek; peek.classList.add('is-on'); });
      row.addEventListener('pointerleave', () => peek.classList.remove('is-on'));
      row.addEventListener('pointermove', e => { x = e.clientX; y = e.clientY; raf ||= requestAnimationFrame(place); });
    });
  }

  /* Photo viewer for albums */
  const lb = $('[data-lightbox]');
  const albumsData = $('#albums');
  if (lb && albumsData) {
    const albums = JSON.parse(albumsData.textContent);
    const stage = $('.lb-stage', lb);
    const title = $('[data-lb-title]', lb);
    const meta = $('[data-lb-meta]', lb);
    const pos = $('[data-lb-pos]', lb);
    const steps = $$('[data-lb-step]', lb);
    let album = null, i = 0, opener = null;
    // Each photo is its own <img>, kept once fetched, and both neighbours are
    // fetched ahead. Reusing one <img> left the last photo beside a new
    // caption until the next file arrived.
    const photos = new Map();
    const photo = src => {
      if (!photos.has(src)) {
        const p = new Image();
        p.onerror = () => photos.delete(src); // try again next time
        p.src = src;
        photos.set(src, p);
      }
      return photos.get(src);
    };
    const show = () => {
      const n = album.photos.length;
      const [src, alt] = album.photos[i];
      stage.replaceChildren(Object.assign(photo(src), { alt }));
      [1, n - 1].forEach(d => photo(album.photos[(i + d) % n][0]));
      title.textContent = album.title;
      meta.textContent = alt;
      pos.textContent = `${String(i + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')}`;
      steps.forEach(b => { b.hidden = n < 2; });
    };
    $$('[data-album]').forEach(btn => btn.addEventListener('click', () => {
      album = albums[btn.dataset.album];
      if (!album) return;
      i = 0;
      opener = btn;
      show();
      lb.showModal();
      root.classList.add('menu-open');
    }));
    const step = d => { i = (i + d + album.photos.length) % album.photos.length; show(); };
    steps.forEach(b => b.addEventListener('click', () => step(Number(b.dataset.lbStep))));
    lb.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    });
    lb.addEventListener('click', e => { if (e.target === lb || e.target === stage || e.target.closest('[data-lb-close]')) lb.close(); });
    lb.addEventListener('close', () => {
      root.classList.remove('menu-open');
      opener?.focus();
    });
  }

  /* Join form */
  const form = $('#join-form');
  if (form) {
    const DIAL = '1 United States|93 Afghanistan|355 Albania|213 Algeria|376 Andorra|244 Angola|1268 Antigua and Barbuda|54 Argentina|374 Armenia|297 Aruba|61 Australia|43 Austria|994 Azerbaijan|1242 Bahamas|973 Bahrain|880 Bangladesh|1246 Barbados|375 Belarus|32 Belgium|501 Belize|229 Benin|975 Bhutan|591 Bolivia|387 Bosnia and Herzegovina|267 Botswana|55 Brazil|246 British Indian Ocean Territory|673 Brunei|359 Bulgaria|226 Burkina Faso|257 Burundi|855 Cambodia|237 Cameroon|1 Canada|238 Cape Verde|599 Caribbean Netherlands|1345 Cayman Islands|236 Central African Republic|235 Chad|56 Chile|86 China|57 Colombia|269 Comoros|243 Congo (DRC)|242 Congo (Republic)|506 Costa Rica|225 Côte d’Ivoire|385 Croatia|53 Cuba|599 Curaçao|357 Cyprus|420 Czechia|45 Denmark|253 Djibouti|1767 Dominica|1809 Dominican Republic|593 Ecuador|20 Egypt|503 El Salvador|240 Equatorial Guinea|291 Eritrea|372 Estonia|268 Eswatini|251 Ethiopia|298 Faroe Islands|679 Fiji|358 Finland|33 France|594 French Guiana|689 French Polynesia|241 Gabon|220 Gambia|995 Georgia|49 Germany|233 Ghana|350 Gibraltar|30 Greece|299 Greenland|1473 Grenada|590 Guadeloupe|1671 Guam|502 Guatemala|224 Guinea|245 Guinea-Bissau|592 Guyana|509 Haiti|504 Honduras|852 Hong Kong|36 Hungary|354 Iceland|91 India|62 Indonesia|98 Iran|964 Iraq|353 Ireland|972 Israel|39 Italy|1876 Jamaica|81 Japan|962 Jordan|7 Kazakhstan|254 Kenya|686 Kiribati|383 Kosovo|965 Kuwait|996 Kyrgyzstan|856 Laos|371 Latvia|961 Lebanon|266 Lesotho|231 Liberia|218 Libya|423 Liechtenstein|370 Lithuania|352 Luxembourg|853 Macau|261 Madagascar|265 Malawi|60 Malaysia|960 Maldives|223 Mali|356 Malta|692 Marshall Islands|596 Martinique|222 Mauritania|230 Mauritius|262 Mayotte|52 Mexico|691 Micronesia|373 Moldova|377 Monaco|976 Mongolia|382 Montenegro|212 Morocco|258 Mozambique|95 Myanmar|264 Namibia|674 Nauru|977 Nepal|31 Netherlands|687 New Caledonia|64 New Zealand|505 Nicaragua|227 Niger|234 Nigeria|850 North Korea|389 North Macedonia|47 Norway|968 Oman|92 Pakistan|680 Palau|970 Palestine|507 Panama|675 Papua New Guinea|595 Paraguay|51 Peru|63 Philippines|48 Poland|351 Portugal|1787 Puerto Rico|974 Qatar|262 Réunion|40 Romania|7 Russia|250 Rwanda|1869 Saint Kitts and Nevis|1758 Saint Lucia|508 Saint Pierre and Miquelon|1784 Saint Vincent and the Grenadines|685 Samoa|378 San Marino|239 São Tomé and Príncipe|966 Saudi Arabia|221 Senegal|381 Serbia|248 Seychelles|232 Sierra Leone|65 Singapore|421 Slovakia|386 Slovenia|677 Solomon Islands|252 Somalia|27 South Africa|82 South Korea|211 South Sudan|34 Spain|94 Sri Lanka|249 Sudan|597 Suriname|46 Sweden|41 Switzerland|963 Syria|886 Taiwan|992 Tajikistan|255 Tanzania|66 Thailand|670 Timor-Leste|228 Togo|676 Tonga|1868 Trinidad and Tobago|216 Tunisia|90 Türkiye|993 Turkmenistan|688 Tuvalu|256 Uganda|380 Ukraine|971 United Arab Emirates|44 United Kingdom|598 Uruguay|998 Uzbekistan|678 Vanuatu|379 Vatican City|58 Venezuela|84 Vietnam|681 Wallis and Futuna|967 Yemen|260 Zambia|263 Zimbabwe';
    // "44 United Kingdom" is shown as "+44  United Kingdom" and sent as "44|United Kingdom".
    $('#phone-country', form).append(...DIAL.split('|').map(c => new Option(`+${c.replace(' ', '  ')}`, c.replace(' ', '|'))));

    // join.html#founder, #investor… preselect the role.
    const roles = $$('input[name="role"]', form);
    const preset = () => {
      const input = roles.find(r => `#${r.value}` === location.hash);
      if (input) input.checked = true;
    };
    preset();
    addEventListener('hashchange', preset);

    const RULES = {
      'first-name': v => (v.trim() ? '' : 'Enter your first name.'),
      'last-name': v => (v.trim() ? '' : 'Enter your last name.'),
      organization: v => (v.trim() ? '' : 'Enter your organization. Independent is fine.'),
      email: v => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? '' : 'Enter a valid email address.'),
      phone: v => (v.replace(/\D/g, '').length >= 6 ? '' : 'Enter a phone number so we can schedule a call.'),
      linkedin: v => (/linkedin\.com\/.+/i.test(v.trim()) ? '' : 'Enter your LinkedIn profile URL.'),
    };
    const setErr = (el, msg) => {
      if (el.textContent === msg) return; // unchanged: don't rebuild it on every keystroke
      el.hidden = !msg;
      el.innerHTML = msg ? `${window.BSH.icon('alert')}<span></span>` : '';
      if (msg) el.lastChild.textContent = msg;
    };
    const fields = Object.entries(RULES).map(([id, rule]) => ({ rule, input: $(`#${id}`, form), err: $(`#${id}-error`, form) }));
    let tried = false;
    const check = ({ rule, input, err }) => {
      const msg = rule(input.value);
      input.closest('.fld').classList.toggle('is-invalid', Boolean(msg));
      input.setAttribute('aria-invalid', Boolean(msg));
      setErr(err, msg);
      return !msg;
    };
    const roleErr = $('#role-error', form);
    const checkRole = () => {
      const ok = roles.some(r => r.checked);
      setErr(roleErr, ok ? '' : 'Choose the network that fits you best.');
      return ok;
    };
    fields.forEach(f => {
      f.input.addEventListener('blur', () => { if (tried || f.input.value) check(f); });
      f.input.addEventListener('input', () => { if (tried) check(f); });
    });
    form.addEventListener('change', e => { if (tried && e.target.name === 'role') checkRole(); });

    // data-endpoint on the form makes it live; until then it stays a prototype.
    const notes = $$('[data-prototype-note]');
    const endpoint = () => {
      const url = form.dataset.endpoint?.trim() || '';
      notes.forEach(n => { n.hidden = Boolean(url); });
      return url;
    };
    endpoint();
    const btn = $('[type="submit"]', form);
    const idle = [...btn.childNodes];
    const busy = on => {
      // Hold the layout width (unscaled by :active) so "Sending…" can't shrink it.
      btn.style.minWidth = on ? getComputedStyle(btn).width : '';
      btn.disabled = on;
      if (on) { btn.setAttribute('aria-busy', 'true'); btn.textContent = 'Sending…'; }
      else { btn.removeAttribute('aria-busy'); btn.replaceChildren(...idle); }
    };
    // True on a 2xx; false on any other status, a network error or 15s of silence.
    const send = url => fetch(url, {
      method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000),
    }).then(res => res.ok, () => false);

    const alertBox = $('#form-alert', form);
    const say = msg => { alertBox.hidden = false; alertBox.lastElementChild.textContent = msg; };
    const done = $('#join-success');
    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (btn.disabled) return;
      tried = true;
      const roleOk = checkRole();
      const bad = fields.filter(f => !check(f));
      const count = bad.length + (roleOk ? 0 : 1);
      if (count) {
        say(count === 1 ? 'One thing needs your attention below.' : `${count} things need your attention below.`);
        (roleOk ? bad[0].input : roles[0]).focus();
        return;
      }
      alertBox.hidden = true;
      // Word the thanks now, so edits made while sending can't change it.
      $('[data-first-name]', done).textContent = $('#first-name', form).value.trim();
      $('[data-role-name]', done).textContent = roles.find(r => r.checked).dataset.phrase;
      const url = endpoint();
      // Only bots fill the hidden _gotcha field: thank them and send nothing.
      if (url && !form.elements._gotcha.value) {
        busy(true);
        const ok = await send(url);
        busy(false);
        if (!ok) {
          say(`We couldn’t send your details. Check your connection and try again, or email ${window.BSH.EMAIL}.`);
          alertBox.scrollIntoView({ block: 'center', behavior: behavior() });
          // Disabling the button dropped its focus; give it back so Enter retries.
          if (document.activeElement === document.body) btn.focus({ preventScroll: true });
          return;
        }
      }
      form.hidden = true;
      done.hidden = false;
      done.focus();
      done.scrollIntoView({ block: 'center', behavior: behavior() });
    });
  }
})();
