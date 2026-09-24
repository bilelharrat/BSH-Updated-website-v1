/* Berkeley Summit House: behaviour.
   Everything here is progressive enhancement: the pages read fine without it. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------- header */
  const header = $('[data-header]');
  const onScroll = () => header && header.toggleAttribute('data-scrolled', window.scrollY > 8);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ----------------------------------------------------------- mobile menu */
  const menu = $('[data-menu]');
  const openBtn = $('[data-menu-open]');
  const closeBtn = $('[data-menu-close]');
  const openMenu = () => {
    menu.hidden = false;
    openBtn.setAttribute('aria-expanded', 'true');
    document.documentElement.style.overflow = 'hidden';
    closeBtn.focus();
  };
  const closeMenu = (returnFocus = true) => {
    menu.hidden = true;
    openBtn.setAttribute('aria-expanded', 'false');
    document.documentElement.style.overflow = '';
    if (returnFocus) openBtn.focus();
  };
  if (menu && openBtn && closeBtn) {
    openBtn.addEventListener('click', openMenu);
    closeBtn.addEventListener('click', () => closeMenu());
    menu.addEventListener('click', e => { if (e.target.closest('a')) closeMenu(false); });
    menu.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeMenu();
      if (e.key !== 'Tab') return;
      const focusables = $$('a[href], button', menu);
      const first = focusables[0], last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  /* ------------------------------------------------------------ copy email */
  document.addEventListener('click', async e => {
    const btn = e.target.closest('.copy-btn');
    if (!btn) return;
    try {
      await navigator.clipboard.writeText(btn.dataset.copy);
      btn.textContent = 'Copied';
    } catch (err) {
      const target = btn.previousElementSibling;
      const range = document.createRange();
      range.selectNodeContents(target);
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      btn.textContent = 'Selected';
    }
    btn.dataset.state = 'done';
    clearTimeout(btn._t);
    btn._t = setTimeout(() => { btn.textContent = 'Copy'; delete btn.dataset.state; }, 2200);
  });

  /* ------------------------------------------------------------ appearance */
  const root = document.documentElement;
  const paintThemeSwitch = () => {
    const current = root.dataset.theme || 'system';
    $$('[data-theme-choice]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.themeChoice === current)));
  };
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-theme-choice]');
    if (!b) return;
    const choice = b.dataset.themeChoice;
    if (choice === 'system') delete root.dataset.theme;
    else root.dataset.theme = choice;
    try {
      if (choice === 'system') localStorage.removeItem('bsh-theme');
      else localStorage.setItem('bsh-theme', choice);
    } catch (err) { /* not remembered; still applied */ }
    paintThemeSwitch();
  });
  paintThemeSwitch();

  /* ============================================================ sketching
     A tiny pen: seeded jitter so every scribble is hand-made but identical
     on every visit. Primitives return SVG path data; render() writes them. */
  const NS = 'http://www.w3.org/2000/svg';
  const r1 = n => Math.round(n * 10) / 10;

  const prng = seed => {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  const smooth = pts => {
    let d = `M${r1(pts[0][0])} ${r1(pts[0][1])}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      d += ` C${r1(p1[0] + (p2[0] - p0[0]) / 6)} ${r1(p1[1] + (p2[1] - p0[1]) / 6)}`
        + ` ${r1(p2[0] - (p3[0] - p1[0]) / 6)} ${r1(p2[1] - (p3[1] - p1[1]) / 6)}`
        + ` ${r1(p2[0])} ${r1(p2[1])}`;
    }
    return d;
  };

  // Rough width of a string in the hand face; good enough to size loops.
  const tw = (s, size) => s.length * size * 0.37;

  const makePen = (seed, wobble = 1) => {
    const rand = prng(seed);
    const J = amt => (rand() - 0.5) * 2 * amt * wobble;
    const items = [];
    let g = 0, ox = 0, oy = 0;
    const P = (x, y) => [x + ox, y + oy];
    const pen = {
      items,
      at(group, x = 0, y = 0) { g = group; ox = x; oy = y; return pen; },
      path(d, o = {}) { items.push({ kind: 'path', d, g, cls: o.cls, dash: o.dash, w: o.w }); return pen; },
      line(x1, y1, x2, y2, o = {}) {
        [x1, y1] = P(x1, y1); [x2, y2] = P(x2, y2);
        const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
        const ux = dx / len, uy = dy / len;
        const bow = (o.bow ?? 0.02) * len * (rand() < 0.5 ? -1 : 1);
        const ov = o.overshoot ?? Math.min(3.5, len * 0.04);
        const a = [x1 - ux * ov * rand() + J(0.7), y1 - uy * ov * rand() + J(0.7)];
        const b = [x2 + ux * ov * rand() + J(0.7), y2 + uy * ov * rand() + J(0.7)];
        const t = 0.45 + rand() * 0.1;
        const m = [x1 + dx * t - uy * bow + J(0.5), y1 + dy * t + ux * bow + J(0.5)];
        return pen.path(`M${r1(a[0])} ${r1(a[1])} Q${r1(m[0])} ${r1(m[1])} ${r1(b[0])} ${r1(b[1])}`, o);
      },
      poly(pts, o = {}) { for (let i = 0; i < pts.length - 1; i++) pen.line(...pts[i], ...pts[i + 1], o); return pen; },
      curve(pts, o = {}) {
        const j = o.jitter ?? 0.9;
        return pen.path(smooth(pts.map(([x, y]) => { const [px, py] = P(x, y); return [px + J(j), py + J(j)]; })), o);
      },
      ellipse(cx, cy, rx, ry, o = {}) {
        [cx, cy] = P(cx, cy);
        const turns = o.turns ?? 1.1;
        const start = o.start ?? rand() * Math.PI * 2;
        const n = Math.max(12, Math.round((rx + ry) / 6));
        const steps = Math.round(n * turns);
        const ph = rand() * 6.3;
        const pts = [];
        for (let i = 0; i <= steps; i++) {
          const t = start + (i / n) * Math.PI * 2;
          const k = 1 + 0.03 * Math.sin(2 * t + ph) + (i / steps) * 0.05;
          pts.push([cx + Math.cos(t) * rx * k + J(0.5), cy + Math.sin(t) * ry * k + J(0.5)]);
        }
        return pen.path(smooth(pts), o);
      },
      arrow(x1, y1, x2, y2, o = {}) {
        [x1, y1] = P(x1, y1); [x2, y2] = P(x2, y2);
        const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
        const bend = (o.bend ?? 0.16) * len;
        const cx = (x1 + x2) / 2 - (dy / len) * bend, cy = (y1 + y2) / 2 + (dx / len) * bend;
        pen.path(`M${r1(x1 + J(0.8))} ${r1(y1 + J(0.8))} Q${r1(cx + J(1.5))} ${r1(cy + J(1.5))} ${r1(x2)} ${r1(y2)}`, o);
        const ang = Math.atan2(y2 - cy, x2 - cx), h = o.head ?? Math.min(13, len * 0.25), s = 0.5;
        const a = [x2 - Math.cos(ang - s) * h, y2 - Math.sin(ang - s) * h];
        const b = [x2 - Math.cos(ang + s) * h * 0.9, y2 - Math.sin(ang + s) * h * 0.9];
        return pen.path(`M${r1(a[0])} ${r1(a[1])} L${r1(x2 + J(0.4))} ${r1(y2 + J(0.4))} L${r1(b[0])} ${r1(b[1])}`, o);
      },
      box(x, y, w, h, o = {}) { return pen.poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]], o); },
      check(x, y, s = 14, o = {}) { return pen.curve([[x, y + s * 0.5], [x + s * 0.35, y + s * 0.95], [x + s * 1.05, y - s * 0.15]], { jitter: 0.4, ...o }); },
      brace(x1, x2, y, depth = 14, o = {}) {
        const mid = (x1 + x2) / 2;
        return pen.curve([[x1, y], [x1 + 6, y + depth * 0.7], [mid - 12, y + depth * 0.7], [mid, y + depth * 1.4], [mid + 12, y + depth * 0.7], [x2 - 6, y + depth * 0.7], [x2, y]], { jitter: 0.5, ...o });
      },
      highlight(x, y, w, h) {
        [x, y] = P(x, y);
        const pts = [[x, y + h * 0.25], [x + w * 0.33, y + J(1.5)], [x + w * 0.7, y + J(1.5)], [x + w + 2, y + h * 0.15],
          [x + w + 5, y + h * 0.7], [x + w * 0.66, y + h + J(1.5)], [x + w * 0.3, y + h + J(1.5)], [x - 4, y + h * 0.85], [x, y + h * 0.25]];
        items.push({ kind: 'fill', d: smooth(pts) + 'Z', g });
        return pen;
      },
      text(x, y, str, o = {}) {
        [x, y] = P(x, y);
        items.push({ kind: 'text', x, y, str, g, size: o.size ?? 30, rot: o.rot ?? J(1.6), anchor: o.anchor ?? 'start', cls: o.cls });
        return pen;
      },
      rand,
    };
    return pen;
  };

  const render = (target, items) => {
    const frag = document.createDocumentFragment();
    for (const it of items) {
      let el;
      if (it.kind === 'text') {
        el = document.createElementNS(NS, 'text');
        el.setAttribute('x', r1(it.x));
        el.setAttribute('y', r1(it.y));
        el.setAttribute('font-size', it.size);
        if (it.anchor !== 'start') el.setAttribute('text-anchor', it.anchor);
        if (it.rot) el.setAttribute('transform', `rotate(${r1(it.rot)} ${r1(it.x)} ${r1(it.y)})`);
        el.setAttribute('class', `sk-text${it.cls ? ' ' + it.cls : ''}`);
        el.textContent = it.str;
      } else {
        el = document.createElementNS(NS, 'path');
        el.setAttribute('d', it.d);
        el.setAttribute('class', `${it.kind === 'fill' ? 'sk-fill' : 'sk-line'}${it.cls ? ' ' + it.cls : ''}`);
        if (it.dash) el.setAttribute('stroke-dasharray', it.dash);
        if (it.w) el.style.strokeWidth = it.w;
      }
      el.dataset.g = it.g;
      frag.appendChild(el);
    }
    target.appendChild(frag);
  };

  /* ---- drawings ----------------------------------------------------- */
  const SKETCHES = {
    'hero-arrow': p => p.arrow(8, 12, 100, 50, { bend: -0.28, head: 11 }),

    'here-arrow': p => p.arrow(2, 10, 42, 16, { bend: 0.18, head: 8 }),

    'house-annot': p => {
      p.at(0).arrow(452, 440, 452, 96, { bend: 0.05, head: 12 });
      p.text(476, 66, 'realized impact', { size: 27, anchor: 'end', rot: -1 });
      p.text(476, 498, 'ideation', { size: 27, anchor: 'end', rot: 1 });
    },

    'house-doodles': p => {
      p.arrow(248, 334, 276, 327, { bend: 0.25, head: 5 });
      p.ellipse(297, 333, 9, 7, { turns: 1.05 });
      p.curve([[248, 345], [258, 343], [268, 346], [279, 344]]);
      p.curve([[248, 353], [262, 351], [274, 354]]);
      p.poly([[284, 357], [292, 347], [300, 357]]);
      p.check(304, 346, 8);
    },

    'value-nolimit': p => {
      p.poly([[46, 16], [14, 16], [14, 56], [46, 56]]);
      p.arrow(24, 36, 68, 34, { bend: 0.06, head: 9 });
    },
    'value-courage': p => {
      p.line(4, 46, 29, 46);
      p.line(43, 46, 68, 46);
      p.arrow(26, 68, 44, 6, { bend: -0.08, head: 10 });
    },
    'value-humanity': p => {
      p.ellipse(36, 38, 25, 25, { turns: 1.06 });
      p.ellipse(36, 38, 10, 25, { turns: 1.02 });
      p.line(12, 38, 60, 38, { bow: 0.04 });
    },
    'value-growth': p => {
      p.ellipse(36, 40, 4, 3, { turns: 1.2 });
      p.ellipse(36, 40, 15, 9);
      p.ellipse(36, 40, 30, 18, { turns: 1.04 });
    },

    chair: p => {
      p.curve([[26, 14], [34, 9], [46, 11]]);
      p.line(30, 12, 40, 96);
      p.line(40, 96, 33, 158);
      p.line(38, 94, 118, 99);
      p.line(113, 99, 119, 158);
      p.line(38, 132, 116, 134);
      p.line(33, 42, 37, 70, { bow: 0.05 });
    },

    'domain-education': p => {
      p.curve([[36, 24], [22, 17], [8, 20]]);
      p.line(8, 20, 8, 55);
      p.curve([[8, 55], [22, 52], [36, 58]]);
      p.curve([[36, 24], [50, 17], [64, 20]]);
      p.line(64, 20, 64, 55);
      p.curve([[64, 55], [50, 52], [36, 58]]);
      p.line(36, 24, 36, 58);
      p.line(14, 31, 29, 33); p.line(14, 39, 29, 41);
      p.line(43, 33, 58, 31); p.line(43, 41, 58, 39);
    },
    'domain-wellbeing': p => {
      p.curve([[36, 66], [35, 52], [36, 34]]);
      p.curve([[36, 48], [27, 40], [14, 40], [18, 49], [28, 51], [36, 48]]);
      p.curve([[36, 37], [45, 27], [60, 22], [58, 33], [47, 39], [36, 37]]);
      p.line(20, 66, 52, 66);
    },
    'domain-legal': p => {
      p.line(36, 12, 36, 60);
      p.line(22, 62, 50, 62);
      p.line(8, 20, 64, 20);
      p.poly([[6, 40], [12, 20], [18, 40]]);
      p.curve([[3, 40], [12, 48], [21, 40]]);
      p.poly([[54, 40], [60, 20], [66, 40]]);
      p.curve([[51, 40], [60, 48], [69, 40]]);
      p.ellipse(36, 11, 3, 3);
    },
    'domain-arts': p => {
      p.curve([[6, 60], [22, 46], [40, 56], [56, 42], [68, 46]], { jitter: 0.6 });
      p.line(28, 40, 60, 8);
      p.line(22, 46, 30, 38);
      p.curve([[24, 43], [16, 50], [11, 59], [19, 54], [27, 46]], { jitter: 0.4 });
    },

    // Braces under the 15–35 ruler; the labels are HTML so they reflow.
    ruler: p => {
      const at = age => ((age - 15) / 20) * 1000;
      [[15, 18], [18, 22], [22, 35]].forEach(([a, b], i) => p.at(i).brace(at(a) + 5, at(b) - 5, 4, 10));
    },

    // The founder's room: one wall, covered in the story itself.
    wall: (p, mode) => {
      const wide = mode === 'wide';
      const S = wide ? 34 : 38;
      const L = wide
        ? { A: [30, 34], B: [372, 150], K: [620, 40], D: [880, 30], I: [60, 196], H: [590, 250], C: [60, 330], F: [660, 330], G: [1004, 330], J: [196, 486] }
        : { A: [20, 30], B: [360, 110], I: [40, 190], K: [40, 300], D: [20, 440], C: [380, 430], H: [20, 650], F: [30, 800], G: [380, 800], J: [60, 1030] };

      // A · a one-way ticket, flown in
      p.at(0, ...L.A);
      p.text(0, 30, 'one-way ticket', { size: S });
      const px = tw('one-way ticket', S) + 16;
      p.poly([[px, 14], [px + 30, 0], [px + 18, 28], [px + 12, 18], [px, 14]]);
      p.line(px + 12, 18, px + 30, 0);
      p.curve([[40, 50], [120, 96], [230, 118], [314, 106]], { dash: '5 9' });
      p.arrow(292, 112, 318, 104, { bend: 0, head: 10 });

      // B · the house
      p.at(1, ...L.B);
      p.poly([[0, 72], [78, 12], [156, 72]]);
      p.poly([[116, 42], [116, 18], [130, 18], [130, 52]]);
      p.line(14, 72, 14, 168); p.line(142, 72, 142, 168);
      p.poly([[66, 168], [66, 122], [90, 122], [90, 168]]);
      p.box(28, 92, 26, 22); p.line(41, 92, 41, 114); p.line(28, 103, 54, 103);
      p.box(104, 92, 26, 22); p.line(117, 92, 117, 114);
      p.curve([[-24, 171], [40, 166], [110, 172], [180, 163]]);
      p.text(22, 210, 'the house', { size: S * 0.95 });

      // C · the room, inventoried
      p.at(2, ...L.C);
      p.text(0, 24, 'the room:', { size: S * 0.9 });
      ['mattress', 'chair', 'lamp'].forEach((w, i) => {
        const y = 64 + i * 36;
        p.box(2, y - 18, 18, 18);
        p.check(4, y - 15, 15);
        p.text(32, y, w, { size: S * 0.85 });
      });

      // D · the idea, circled
      p.at(3, ...L.D);
      p.text(24, 52, 'AI startup idea', { size: S * 1.1 });
      p.ellipse(24 + tw('AI startup idea', S * 1.1) / 2, 40, tw('AI startup idea', S * 1.1) / 2 + 26, 36);
      p.arrow(238, 78, 262, 122, { bend: -0.2, head: 9 });
      p.text(226, 152, 'users?', { size: S * 0.9 });
      p.arrow(64, 80, 44, 122, { bend: 0.2, head: 9 });
      p.text(0, 152, 'why now?', { size: S * 0.9 });

      // H · the question that started it all
      p.at(4, ...L.H);
      const hs = S * 1.08;
      if (wide) {
        const lead = 'why not turn the house into a ';
        const x = tw(lead, hs);
        p.highlight(x - 6, 16, tw('platform?', hs) + 10, 26);
        p.text(0, 40, lead.trim(), { size: hs, cls: 'ink', rot: -0.6 });
        p.text(x, 40, 'platform?', { size: hs, cls: 'ink', rot: -0.6 });
        p.curve([[x - 2, 52], [x + 60, 50], [x + tw('platform?', hs) + 4, 53]]);
        p.curve([[x + 4, 59], [x + 70, 57], [x + tw('platform?', hs), 60]]);
      } else {
        const x = tw('into a ', hs);
        p.text(0, 40, 'why not turn the house', { size: hs, cls: 'ink', rot: -0.6 });
        p.highlight(x - 6, 68, tw('platform?', hs) + 10, 26);
        p.text(0, 92, 'into a', { size: hs, cls: 'ink', rot: -0.6 });
        p.text(x, 92, 'platform?', { size: hs, cls: 'ink', rot: -0.6 });
        p.curve([[x - 2, 104], [x + 60, 102], [x + tw('platform?', hs) + 4, 105]]);
      }

      // F · three rooms, one house
      p.at(5, ...L.F);
      const node = (x, y, w) => {
        const s = S * 0.85;
        p.text(x, y, w, { size: s, anchor: 'middle' });
        p.ellipse(x, y - s * 0.28, tw(w, s) / 2 + 18, 24);
      };
      node(150, 30, 'Ventures');
      node(40, 190, 'Incubator');
      node(262, 190, 'Foundation');
      p.line(118, 58, 70, 160); p.line(182, 58, 232, 160); p.line(104, 184, 196, 184);
      p.text(151, 130, 'one house', { size: S * 0.75, anchor: 'middle' });

      // G · the only chart that matters
      p.at(6, ...L.G);
      p.arrow(0, 130, 0, -6, { bend: 0, head: 9 });
      p.arrow(0, 130, 186, 130, { bend: 0, head: 9 });
      p.curve([[8, 122], [60, 116], [104, 100], [140, 64], [170, 10]]);
      p.text(14, 14, 'impact', { size: S * 0.8 });
      p.text(128, 162, 'time', { size: S * 0.7 });

      // J · explore, stumble, grow
      p.at(7, ...L.J);
      p.curve([[0, 90], [60, 84], [110, 90], [150, 70], [170, 42], [150, 26], [128, 42], [150, 70], [196, 92], [250, 88], [300, 60], [340, 22], [370, 6]]);
      p.arrow(352, 14, 372, 4, { bend: 0, head: 10 });
      p.text(4, 124, 'explore', { size: S * 0.8 });
      p.text(116, 124, 'stumble', { size: S * 0.8 });
      p.text(300, 106, 'grow', { size: S * 0.8 });

      // K · the summit
      p.at(8, ...L.K);
      p.poly([[0, 96], [34, 56], [50, 70], [86, 12], [118, 62], [134, 50], [170, 96]]);
      p.line(86, 12, 86, -20);
      p.poly([[86, -20], [108, -12], [86, -4]]);
      p.text(178, 70, 'summit', { size: S * 0.85 });

      // I · the year
      p.at(9, ...L.I);
      p.text(20, 58, '2024', { size: S * 1.3 });
      p.ellipse(20 + tw('2024', S * 1.3) / 2, 46, tw('2024', S * 1.3) / 2 + 22, 30);
    },
  };

  /* ---- draw-on animation ----------------------------------------------- */
  const arm = svg => {
    if (svg.dataset.armed || svg.dataset.played) return;
    svg.dataset.armed = '1';
    $$('.sk-line', svg).forEach(el => {
      if (el.getAttribute('stroke-dasharray')) { el.style.opacity = '0'; return; }
      const len = el.getTotalLength();
      el.dataset.len = len;
      el.style.strokeDasharray = `${len} ${len}`;
      el.style.strokeDashoffset = String(len);
    });
    $$('.sk-text', svg).forEach(el => { el.style.opacity = '0'; });
    $$('.sk-fill', svg).forEach(el => { el.style.transform = 'scaleX(0)'; });
  };

  const play = (svg, { delay = 0, gap = 0.22 } = {}) => {
    if (svg.dataset.played) return;
    svg.dataset.played = '1';
    const groups = new Map();
    $$('[data-g]', svg).forEach(el => {
      const k = Number(el.dataset.g);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(el);
    });
    [...groups.keys()].sort((a, b) => a - b).forEach((k, gi) => {
      let t = delay + gi * gap;
      groups.get(k).forEach(el => {
        if (el.classList.contains('sk-line') && !el.getAttribute('stroke-dasharray')) {
          const len = Number(el.dataset.len) || 60;
          const dur = Math.min(0.6, 0.12 + len / 900);
          el.style.transition = `stroke-dashoffset ${dur.toFixed(2)}s cubic-bezier(.55,.1,.3,1) ${t.toFixed(2)}s`;
          el.style.strokeDashoffset = '0';
          t += dur * 0.3;
        } else if (el.classList.contains('sk-fill')) {
          el.style.transition = `transform .5s cubic-bezier(.2,.7,.2,1) ${t.toFixed(2)}s`;
          el.style.transform = 'scaleX(1)';
          t += 0.15;
        } else {
          el.style.transition = `opacity .45s ease ${t.toFixed(2)}s`;
          el.style.opacity = '1';
          t += 0.06;
        }
      });
    });
  };

  // Sketches stay fully drawn at rest. Each one is hidden only just before it
  // scrolls into view, then draws itself in.
  const canAnimate = !reduceMotion && 'IntersectionObserver' in window;
  const armer = canAnimate && new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting) { armer.unobserve(e.target); arm(e.target); }
  }), { rootMargin: '0px 0px 60% 0px' });
  const player = canAnimate && new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting) {
      player.unobserve(e.target);
      arm(e.target);
      requestAnimationFrame(() => requestAnimationFrame(() => play(e.target, { delay: Number(e.target.dataset.delay || 0) })));
    }
  }), { rootMargin: '0px 0px -12% 0px' });

  const drawAll = () => {
    $$('[data-sketch]').forEach((el, i) => {
      const name = el.dataset.sketch;
      const fn = SKETCHES[name];
      if (!fn) return;
      const seed = Number(el.dataset.seed) || (i + 1) * 7919;
      if (name === 'wall') {
        const mode = el.getBoundingClientRect().width < 700 ? 'tall' : 'wide';
        if (el.dataset.mode === mode) return;
        el.dataset.mode = mode;
        el.setAttribute('viewBox', mode === 'wide' ? '0 0 1200 620' : '0 0 600 1180');
        el.replaceChildren();
        const pen = makePen(seed);
        fn(pen, mode);
        render(el, pen.items);
        $$('.sk-line', el).forEach(l => { l.style.strokeWidth = mode === 'wide' ? '2' : '2.6'; });
      } else {
        if (el.dataset.drawn) return;
        el.dataset.drawn = '1';
        const pen = makePen(seed);
        fn(pen);
        render(el, pen.items);
      }
      if (!canAnimate || el.dataset.still !== undefined || el.dataset.played) return;
      if (!el.getClientRects().length) return; // not displayed at this size
      const box = el.getBoundingClientRect();
      if (box.top < innerHeight && box.bottom > 0) {
        // Already on screen at load: hide and draw in right away.
        arm(el);
        requestAnimationFrame(() => requestAnimationFrame(() => play(el, { delay: Number(el.dataset.delay || 0.3) })));
      } else {
        armer.observe(el);
        player.observe(el);
      }
    });
  };

  drawAll();
  let resizeTimer;
  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const wall = $('[data-sketch="wall"]');
      if (!wall) return;
      const mode = wall.getBoundingClientRect().width < 700 ? 'tall' : 'wide';
      if (wall.dataset.mode !== mode) {
        wall.dataset.played = '1';
        drawAll();
      }
    }, 150);
  });

  /* -------------------------------------------------- rooms ↔ house (home) */
  const rooms = $('[data-rooms]');
  if (rooms) {
    const floors = $$('[data-floor]', rooms);
    const items = $$('[data-room]', rooms);
    const light = key => {
      floors.forEach(f => f.classList.toggle('is-on', f.dataset.floor === key));
      items.forEach(i => i.classList.toggle('is-on', i.dataset.room === key));
    };
    items.forEach(item => {
      item.addEventListener('mouseenter', () => light(item.dataset.room));
      item.addEventListener('focusin', () => light(item.dataset.room));
    });
    floors.forEach(f => {
      f.addEventListener('mouseenter', () => light(f.dataset.floor));
      f.addEventListener('click', () => { location.href = `${f.dataset.floor}.html`; });
    });
    rooms.addEventListener('mouseleave', () => light(''));
    // While scrolling the list on its own, the floor you're reading lights up.
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(entries => entries.forEach(e => {
        if (e.isIntersecting && !rooms.matches(':hover')) light(e.target.dataset.room);
      }), { rootMargin: '-45% 0px -45% 0px' });
      items.forEach(i => io.observe(i));
    }
  }

  /* ------------------------------------------- which room is yours? (home) */
  const router = $('[data-router]');
  if (router) {
    const radios = $$('[role="radio"]', router);
    const select = (btn, focus) => {
      radios.forEach(b => {
        const on = b === btn;
        b.setAttribute('aria-checked', String(on));
        b.tabIndex = on ? 0 : -1;
      });
      $$('[data-panel]', router).forEach(p => { p.hidden = p.dataset.panel !== btn.dataset.role; });
      if (focus) btn.focus();
    };
    radios.forEach((b, i) => {
      b.addEventListener('click', () => select(b));
      b.addEventListener('keydown', e => {
        const n = radios.length;
        const next = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1 + n, ArrowUp: i - 1 + n, Home: 0, End: n - 1 }[e.key];
        if (next === undefined) return;
        e.preventDefault();
        select(radios[next % n], true);
      });
    });
  }

  /* ----------------------------------------------------- lightbox (events) */
  const lightbox = $('[data-lightbox]');
  const albumData = $('#albums');
  if (lightbox && albumData && typeof lightbox.showModal === 'function') {
    const ALBUMS = JSON.parse(albumData.textContent);
    const img = $('.lightbox-img', lightbox);
    const cap = $('.lightbox-cap', lightbox);
    const count = $('[data-lb-count]', lightbox);
    let album = null, idx = 0;
    const show = i => {
      const photos = album.photos;
      idx = (i + photos.length) % photos.length;
      const [src, alt] = photos[idx];
      img.src = src;
      img.alt = alt;
      cap.innerHTML = '';
      const b = document.createElement('b');
      b.textContent = album.title;
      cap.append(b, document.createTextNode(album.meta));
      count.textContent = `${idx + 1} of ${photos.length}`;
      $$('[data-lb-step]', lightbox).forEach(btn => { btn.hidden = photos.length < 2; });
    };
    document.addEventListener('click', e => {
      const t = e.target.closest('[data-album]');
      if (!t || !ALBUMS[t.dataset.album]) return;
      album = ALBUMS[t.dataset.album];
      show(Number(t.dataset.index || 0));
      lightbox.showModal();
    });
    $$('[data-lb-step]', lightbox).forEach(btn => btn.addEventListener('click', () => show(idx + Number(btn.dataset.lbStep))));
    $('[data-lb-close]', lightbox).addEventListener('click', () => lightbox.close());
    lightbox.addEventListener('click', e => { if (e.target === lightbox) lightbox.close(); });
    lightbox.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') show(idx + 1);
      if (e.key === 'ArrowLeft') show(idx - 1);
    });
  }

  /* ------------------------------------------------------------- join form */
  const form = $('#join-form');
  if (form) {
    // Country codes, from the current form with names brought up to date.
    const DIAL = '1 United States|93 Afghanistan|355 Albania|213 Algeria|376 Andorra|244 Angola|1268 Antigua and Barbuda|54 Argentina|374 Armenia|297 Aruba|61 Australia|43 Austria|994 Azerbaijan|1242 Bahamas|973 Bahrain|880 Bangladesh|1246 Barbados|375 Belarus|32 Belgium|501 Belize|229 Benin|975 Bhutan|591 Bolivia|387 Bosnia and Herzegovina|267 Botswana|55 Brazil|246 British Indian Ocean Territory|673 Brunei|359 Bulgaria|226 Burkina Faso|257 Burundi|855 Cambodia|237 Cameroon|1 Canada|238 Cape Verde|599 Caribbean Netherlands|1345 Cayman Islands|236 Central African Republic|235 Chad|56 Chile|86 China|57 Colombia|269 Comoros|243 Congo (DRC)|242 Congo (Republic)|506 Costa Rica|225 Côte d’Ivoire|385 Croatia|53 Cuba|599 Curaçao|357 Cyprus|420 Czechia|45 Denmark|253 Djibouti|1767 Dominica|1809 Dominican Republic|593 Ecuador|20 Egypt|503 El Salvador|240 Equatorial Guinea|291 Eritrea|372 Estonia|268 Eswatini|251 Ethiopia|298 Faroe Islands|679 Fiji|358 Finland|33 France|594 French Guiana|689 French Polynesia|241 Gabon|220 Gambia|995 Georgia|49 Germany|233 Ghana|350 Gibraltar|30 Greece|299 Greenland|1473 Grenada|590 Guadeloupe|1671 Guam|502 Guatemala|224 Guinea|245 Guinea-Bissau|592 Guyana|509 Haiti|504 Honduras|852 Hong Kong|36 Hungary|354 Iceland|91 India|62 Indonesia|98 Iran|964 Iraq|353 Ireland|972 Israel|39 Italy|1876 Jamaica|81 Japan|962 Jordan|7 Kazakhstan|254 Kenya|686 Kiribati|383 Kosovo|965 Kuwait|996 Kyrgyzstan|856 Laos|371 Latvia|961 Lebanon|266 Lesotho|231 Liberia|218 Libya|423 Liechtenstein|370 Lithuania|352 Luxembourg|853 Macau|261 Madagascar|265 Malawi|60 Malaysia|960 Maldives|223 Mali|356 Malta|692 Marshall Islands|596 Martinique|222 Mauritania|230 Mauritius|262 Mayotte|52 Mexico|691 Micronesia|373 Moldova|377 Monaco|976 Mongolia|382 Montenegro|212 Morocco|258 Mozambique|95 Myanmar|264 Namibia|674 Nauru|977 Nepal|31 Netherlands|687 New Caledonia|64 New Zealand|505 Nicaragua|227 Niger|234 Nigeria|850 North Korea|389 North Macedonia|47 Norway|968 Oman|92 Pakistan|680 Palau|970 Palestine|507 Panama|675 Papua New Guinea|595 Paraguay|51 Peru|63 Philippines|48 Poland|351 Portugal|1787 Puerto Rico|974 Qatar|262 Réunion|40 Romania|7 Russia|250 Rwanda|1869 Saint Kitts and Nevis|1758 Saint Lucia|508 Saint Pierre and Miquelon|1784 Saint Vincent and the Grenadines|685 Samoa|378 San Marino|239 São Tomé and Príncipe|966 Saudi Arabia|221 Senegal|381 Serbia|248 Seychelles|232 Sierra Leone|65 Singapore|421 Slovakia|386 Slovenia|677 Solomon Islands|252 Somalia|27 South Africa|82 South Korea|211 South Sudan|34 Spain|94 Sri Lanka|249 Sudan|597 Suriname|46 Sweden|41 Switzerland|963 Syria|886 Taiwan|992 Tajikistan|255 Tanzania|66 Thailand|670 Timor-Leste|228 Togo|676 Tonga|1868 Trinidad and Tobago|216 Tunisia|90 Türkiye|993 Turkmenistan|688 Tuvalu|256 Uganda|380 Ukraine|971 United Arab Emirates|44 United Kingdom|598 Uruguay|998 Uzbekistan|678 Vanuatu|379 Vatican City|58 Venezuela|84 Vietnam|681 Wallis and Futuna|967 Yemen|260 Zambia|263 Zimbabwe';
    const dialSelect = $('#phone-country');
    const dialCode = $('[data-dial-code]');
    if (dialSelect && dialCode) {
      DIAL.split('|').forEach((entry, i) => {
        const sp = entry.indexOf(' ');
        const code = entry.slice(0, sp), name = entry.slice(sp + 1);
        const opt = new Option(`${name} (+${code})`, `${code}|${name}`);
        if (i === 0) opt.selected = true;
        dialSelect.add(opt);
      });
      const syncDial = () => { dialCode.textContent = `+${dialSelect.value.split('|')[0]}`; };
      dialSelect.addEventListener('change', syncDial);
      syncDial();
    }

    // #founder, #investor … from the home page's "Which room is yours?"
    const preset = decodeURIComponent(location.hash.slice(1));
    const presetInput = preset && form.querySelector(`input[name="network"][value="${CSS.escape(preset)}"]`);
    if (presetInput) presetInput.checked = true;

    const RULES = {
      'first-name': v => v.trim() ? '' : 'Enter your first name.',
      'last-name': v => v.trim() ? '' : 'Enter your last name.',
      organization: v => v.trim() ? '' : 'Enter your organization. Independent is fine.',
      email: v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? '' : 'Enter an email address like name@example.com.',
      phone: v => v.replace(/[^\d]/g, '').length >= 6 ? '' : 'Enter a phone number so we can schedule a call.',
      linkedin: v => /linkedin\.com\/.+/i.test(v.trim()) ? '' : 'Enter your LinkedIn profile, like linkedin.com/in/yourname.',
    };
    let tried = false;
    const check = id => {
      const input = $(`#${id}`, form);
      const field = input.closest('.field');
      const msg = RULES[id](input.value);
      const err = $(`#${id}-error`, form);
      field.toggleAttribute('data-invalid', Boolean(msg));
      input.setAttribute('aria-invalid', String(Boolean(msg)));
      err.textContent = msg;
      err.hidden = !msg;
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
        alertBox.textContent = bad.length === 1
          ? 'One field needs attention before you can join.'
          : `${bad.length} fields need attention before you can join.`;
        $(`#${bad[0]}`, form).focus();
        return;
      }
      alertBox.hidden = true;
      const done = $('#join-success');
      $('[data-first-name]', done).textContent = $('#first-name', form).value.trim();
      form.hidden = true;
      done.hidden = false;
      done.focus();
      window.scrollTo({ top: done.getBoundingClientRect().top + window.scrollY - 120, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  }
})();
