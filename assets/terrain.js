/* Berkeley Summit House: the terrain.
   The site's signature graphic. Each <canvas data-terrain> draws the contour
   lines of a small landscape, the way a topographic map would: a few peaks
   plus soft noise, with every fifth line drawn heavier as an index contour.

     <canvas data-terrain data-seed="4" data-animate
             data-peaks="a:.7,.4,1,.16;b:.56,.74,.7,.12"
             data-peaks-narrow="a:.5,.4,1,.2"></canvas>

   A peak is "label:x,y,height,radius": x and y are fractions of the canvas,
   the radius a fraction of its longer side, and the label is for readers of
   the markup. data-peaks-narrow takes over when the canvas is not clearly
   wider than tall; data-step sets the height between lines. data-animate
   lets the land drift slowly and rise a little under the pointer anywhere in
   its [data-terrain-wrap]; it stays still under Reduce Motion, off screen and
   in a hidden tab. */
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const AMP = 0.34, FREQ1 = 1 / 460, FREQ2 = 2.3 / 460; // the noise: height, and its two octaves

  const mulberry = a => () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // 2D simplex noise with a seeded permutation, range roughly -1..1.
  function simplex(seed) {
    const rnd = mulberry(seed * 7919 + 13);
    const p = new Uint8Array(256).map((_, i) => i);
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    const perm = new Uint8Array(512).map((_, i) => p[i & 255]);
    const G = [1, 1, -1, 1, 1, -1, -1, -1, 1, 0, -1, 0, 0, 1, 0, -1];
    const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
    return (x, y) => {
      const s = (x + y) * F2, i = Math.floor(x + s), j = Math.floor(y + s), t = (i + j) * G2;
      const x0 = x - i + t, y0 = y - j + t;
      const i1 = x0 > y0 ? 1 : 0, j1 = 1 - i1;
      const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
      const ii = i & 255, jj = j & 255;
      let n = 0, g;
      let t0 = 0.5 - x0 * x0 - y0 * y0;
      if (t0 > 0) { g = (perm[ii + perm[jj]] & 7) * 2; t0 *= t0; n += t0 * t0 * (G[g] * x0 + G[g + 1] * y0); }
      let t1 = 0.5 - x1 * x1 - y1 * y1;
      if (t1 > 0) { g = (perm[ii + i1 + perm[jj + j1]] & 7) * 2; t1 *= t1; n += t1 * t1 * (G[g] * x1 + G[g + 1] * y1); }
      let t2 = 0.5 - x2 * x2 - y2 * y2;
      if (t2 > 0) { g = (perm[ii + 1 + perm[jj + 1]] & 7) * 2; t2 *= t2; n += t2 * t2 * (G[g] * x2 + G[g + 1] * y2); }
      return 70 * n;
    };
  }

  // "a:.7,.4,1,.16;b:…" → [[.7, .4, 1, .16], …]
  const parsePeaks = str => (str || '').split(';').filter(s => s.trim())
    .map(s => s.slice(s.indexOf(':') + 1).split(',').map(Number));

  // Marching squares: which cell edges a contour crosses, by corner mask.
  // Corners: a top-left (8), b top-right (4), c bottom-right (2), d bottom-left (1).
  // Edges: 0 top, 1 right, 2 bottom, 3 left.
  const CASES = [
    null, [3, 2], [2, 1], [3, 1], [0, 1], [0, 1, 3, 2], [0, 2], [0, 3],
    [0, 3], [0, 2], [0, 3, 1, 2], [0, 1], [3, 1], [1, 2], [3, 2], null,
  ];
  const EX = new Float64Array(4), EY = new Float64Array(4); // a contour's crossing on each edge

  // One set of observers and listeners serves every canvas.
  const animated = [];
  const kickAll = () => animated.forEach(t => t.kick());
  const sizer = new ResizeObserver(es => es.forEach(e => e.target.terrain.resize(e.contentRect)));
  const watcher = new IntersectionObserver(es => es.forEach(e => {
    e.target.terrain.visible = e.isIntersecting;
    e.target.terrain.kick();
  }));
  document.addEventListener('visibilitychange', kickAll);
  reduce.addEventListener('change', kickAll);

  class Terrain {
    constructor(canvas) {
      const d = canvas.dataset, seed = Number(d.seed) || 1;
      this.c = canvas;
      this.ctx = canvas.getContext('2d');
      this.noise = simplex(seed);
      this.wide = parsePeaks(d.peaks);
      this.narrow = d.peaksNarrow ? parsePeaks(d.peaksNarrow) : this.wide;
      this.step = Number(d.step) || 0.07;
      this.t = seed * 17;
      this.bump = this.bumpTarget = 0;
      sizer.observe(canvas);
      if (!canvas.hasAttribute('data-animate')) return;

      this.tick = this.tick.bind(this);
      animated.push(this);
      watcher.observe(canvas);
      if (matchMedia('(pointer: fine)').matches) {
        const wrap = canvas.closest('[data-terrain-wrap]') || canvas.parentElement;
        wrap.addEventListener('pointermove', e => {
          const r = canvas.getBoundingClientRect();
          this.px = e.clientX - r.left;
          this.py = e.clientY - r.top;
          this.bumpTarget = 1;
          this.kick();
        });
        wrap.addEventListener('pointerleave', () => { this.bumpTarget = 0; });
      }
    }

    resize({ width: w, height: h }) {
      const { c, ctx } = this, dpr = Math.min(devicePixelRatio || 1, 2);
      if (!w || !h || (w === this.w && h === this.h && dpr === this.dpr)) return;
      this.dpr = dpr;
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      // Resizing the canvas resets its context, so the fixed styles go here.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cs = getComputedStyle(c);
      ctx.strokeStyle = cs.color;
      ctx.lineCap = 'round';
      this.minorAlpha = parseFloat(cs.getPropertyValue('--t-minor')) || 0.26;
      this.majorAlpha = parseFloat(cs.getPropertyValue('--t-major')) || 0.62;
      const cell = this.cell = w < 700 ? 7 : 9;
      const cols = this.cols = Math.ceil(w / cell) + 1, rows = this.rows = Math.ceil(h / cell) + 1;
      this.w = w;
      this.h = h;
      this.field = new Float32Array(cols * rows);
      // The peaks stay put while the noise drifts: sum them once per size, not per frame.
      const S = Math.max(w, h);
      const peaks = (w / h < 1.15 ? this.narrow : this.wide).map(([x, y, ht, r]) => [x * w, y * h, ht, 2 * (r * S) ** 2]);
      const land = this.land = new Float64Array(cols * rows);
      for (let j = 0, k = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++, k++) {
          for (const [px, py, ph, pr] of peaks) {
            const dx = i * cell - px, dy = j * cell - py;
            land[k] += ph * Math.exp(-(dx * dx + dy * dy) / pr);
          }
        }
      }
      this.draw();
    }

    compute() {
      const { cols, rows, cell, noise, field, land, t } = this;
      const bump = this.bump * 0.2, bx = this.px, by = this.py, br = 2 * (Math.max(this.w, this.h) * 0.05) ** 2;
      const dx1 = t * 0.024, dy1 = t * 0.015, dx2 = t * 0.019, dy2 = t * 0.012;
      for (let j = 0, k = 0; j < rows; j++) {
        const y = j * cell, y1 = y * FREQ1 - dy1, y2 = y * FREQ2 + dy2;
        for (let i = 0; i < cols; i++, k++) {
          const x = i * cell;
          let v = AMP * (0.7 * noise(x * FREQ1 + dx1, y1) + 0.3 * noise(x * FREQ2 - dx2 + 40, y2)) + land[k];
          if (bump > 0.001) {
            const dx = x - bx, dy = y - by;
            v += bump * Math.exp(-(dx * dx + dy * dy) / br);
          }
          field[k] = v;
        }
      }
    }

    draw() {
      if (!this.w) return;
      this.compute();
      const { ctx, cols, rows, cell, field, step } = this;
      const minor = new Path2D(), major = new Path2D();
      for (let j = 0; j < rows - 1; j++) {
        for (let i = 0, k = j * cols; i < cols - 1; i++, k++) {
          const a = field[k], b = field[k + 1], c = field[k + cols + 1], d = field[k + cols];
          const x = i * cell, y = j * cell, n1 = Math.floor(Math.max(a, b, c, d) / step);
          for (let n = Math.ceil(Math.min(a, b, c, d) / step); n <= n1; n++) {
            const L = n * step;
            const edges = CASES[(a > L ? 8 : 0) | (b > L ? 4 : 0) | (c > L ? 2 : 0) | (d > L ? 1 : 0)];
            if (!edges) continue;
            EX[0] = x + cell * (L - a) / (b - a); EY[0] = y;
            EX[1] = x + cell; EY[1] = y + cell * (L - b) / (c - b);
            EX[2] = x + cell * (L - d) / (c - d); EY[2] = y + cell;
            EX[3] = x; EY[3] = y + cell * (L - a) / (d - a);
            const path = n % 5 === 0 ? major : minor;
            for (let e = 0; e < edges.length; e += 2) {
              path.moveTo(EX[edges[e]], EY[edges[e]]);
              path.lineTo(EX[edges[e + 1]], EY[edges[e + 1]]);
            }
          }
        }
      }
      ctx.clearRect(0, 0, this.w, this.h);
      ctx.globalAlpha = this.minorAlpha;
      ctx.lineWidth = 0.9;
      ctx.stroke(minor);
      ctx.globalAlpha = this.majorAlpha;
      ctx.lineWidth = 1.5;
      ctx.stroke(major);
    }

    get live() { return this.visible && !document.hidden && !reduce.matches; }

    kick() {
      if (this.raf || !this.live) return;
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.tick);
    }

    // The drift is slow, so ~30 frames a second is plenty.
    tick(now) {
      this.raf = 0;
      if (!this.live) return;
      const dt = now - this.last;
      if (dt >= 33) {
        this.last = now;
        this.t += Math.min(dt, 100) / 1000;
        this.bump += (this.bumpTarget - this.bump) * Math.min(1, dt / 450);
        this.draw();
      }
      this.raf = requestAnimationFrame(this.tick);
    }
  }

  const init = () => document.querySelectorAll('canvas[data-terrain]').forEach(c => { c.terrain ||= new Terrain(c); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  // A ResizeObserver can't see into a closed <details>, but measuring can, so
  // one more pass once web fonts settle draws the canvases hidden there too.
  document.fonts.ready.then(() => document.querySelectorAll('canvas[data-terrain]')
    .forEach(c => c.terrain?.resize(c.getBoundingClientRect())));
})();
