/* Berkeley Summit House: the terrain.
   The site's signature graphic. Each <canvas data-terrain> draws the contour
   lines of a small landscape, the way a topographic map would: named peaks
   plus soft noise, with every fifth line drawn heavier as an index contour.

     <div data-terrain-wrap>
       <canvas data-terrain data-seed="4" data-animate
               data-peaks="house:.7,.4,1,.16;ventures:.56,.74,.7,.12"
               data-peaks-narrow="house:.5,.4,1,.2"></canvas>
       <a data-peak="house">…</a>
     </div>

   A peak is "name:x,y,height,radius", with x and y as fractions of the canvas
   and the radius as a fraction of its longer side. Elements marked
   data-peak="name" inside the wrap are pinned to their peak. data-animate
   lets the land drift slowly and rise a little under the pointer; it stays
   still under Reduce Motion and whenever it is off screen. */
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(pointer: fine)');

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

  const parsePeaks = str => (str || '').split(';').map(s => s.trim()).filter(Boolean).map(s => {
    const [name, nums] = s.includes(':') ? s.split(':') : ['', s];
    const [x, y, h, r] = nums.split(',').map(Number);
    return { name, x, y, h, r };
  });

  // Marching squares: which cell edges a contour crosses, by corner mask.
  // Corners: a top-left (8), b top-right (4), c bottom-right (2), d bottom-left (1).
  // Edges: 0 top, 1 right, 2 bottom, 3 left.
  const CASES = [
    null, [3, 2], [2, 1], [3, 1], [0, 1], [0, 1, 3, 2], [0, 2], [0, 3],
    [0, 3], [0, 2], [0, 3, 1, 2], [0, 1], [3, 1], [1, 2], [3, 2], null,
  ];

  class Terrain {
    constructor(canvas) {
      this.c = canvas;
      this.ctx = canvas.getContext('2d');
      this.wrap = canvas.closest('[data-terrain-wrap]') || canvas.parentElement;
      const d = canvas.dataset;
      this.noise = simplex(Number(d.seed) || 1);
      this.wide = parsePeaks(d.peaks);
      this.narrow = d.peaksNarrow ? parsePeaks(d.peaksNarrow) : this.wide;
      this.step = Number(d.step) || 0.07;
      this.amp = d.amp ? Number(d.amp) : 0.34;
      this.scale = Number(d.scale) || 460;
      this.animate = canvas.hasAttribute('data-animate');
      this.t = (Number(d.seed) || 1) * 17;
      this.bump = 0;
      this.bumpTarget = 0;
      this.px = -1e4;
      this.py = -1e4;
      this.visible = false;
      this.raf = 0;
      this.tick = this.tick.bind(this);

      new ResizeObserver(() => this.resize()).observe(canvas);
      new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; this.kick(); }).observe(canvas);
      document.addEventListener('visibilitychange', () => this.kick());
      reduce.addEventListener?.('change', () => this.kick());

      if (this.animate && finePointer.matches) {
        this.wrap.addEventListener('pointermove', e => {
          const r = canvas.getBoundingClientRect();
          this.px = e.clientX - r.left;
          this.py = e.clientY - r.top;
          this.bumpTarget = 1;
          this.kick();
        });
        this.wrap.addEventListener('pointerleave', () => { this.bumpTarget = 0; });
      }
    }

    resize() {
      const r = this.c.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.w = r.width;
      this.h = r.height;
      this.c.width = Math.round(this.w * dpr);
      this.c.height = Math.round(this.h * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.peaks = this.w / this.h < 1.15 ? this.narrow : this.wide;
      this.cell = this.w < 700 ? 7 : 9;
      this.cols = Math.ceil(this.w / this.cell) + 1;
      this.rows = Math.ceil(this.h / this.cell) + 1;
      this.field = new Float32Array(this.cols * this.rows);
      const cs = getComputedStyle(this.c);
      this.color = cs.color;
      this.minorAlpha = parseFloat(cs.getPropertyValue('--t-minor')) || 0.26;
      this.majorAlpha = parseFloat(cs.getPropertyValue('--t-major')) || 0.62;
      this.place();
      this.draw();
    }

    place() {
      this.wrap.querySelectorAll('[data-peak]').forEach(m => {
        const p = this.peaks.find(q => q.name === m.dataset.peak);
        m.hidden = !p;
        if (!p) return;
        m.style.left = `${p.x * 100}%`;
        m.style.top = `${p.y * 100}%`;
        // Open the legend card toward whichever side has room for it.
        m.classList.remove('peak--flip');
        m.classList.toggle('peak--flip', p.x * this.w + m.offsetWidth > this.w - 12);
      });
    }

    compute() {
      const { cols, rows, cell, w, h, noise, field, t } = this;
      const S = Math.max(w, h);
      const f1 = 1 / this.scale, f2 = 2.3 / this.scale, amp = this.amp;
      const pk = this.peaks.map(p => [p.x * w, p.y * h, p.h, 2 * (p.r * S) ** 2]);
      const bump = this.bump * 0.2, bx = this.px, by = this.py, br = 2 * (S * 0.05) ** 2;
      let k = 0;
      for (let j = 0; j < rows; j++) {
        const y = j * cell;
        for (let i = 0; i < cols; i++, k++) {
          const x = i * cell;
          let v = amp * (0.7 * noise(x * f1 + t * 0.024, y * f1 - t * 0.015)
                       + 0.3 * noise(x * f2 - t * 0.019 + 40, y * f2 + t * 0.012));
          for (let q = 0; q < pk.length; q++) {
            const dx = x - pk[q][0], dy = y - pk[q][1];
            v += pk[q][2] * Math.exp(-(dx * dx + dy * dy) / pk[q][3]);
          }
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
        for (let i = 0; i < cols - 1; i++) {
          const k = j * cols + i;
          const a = field[k], b = field[k + 1], c = field[k + cols + 1], d = field[k + cols];
          const n0 = Math.ceil(Math.min(a, b, c, d) / step);
          const n1 = Math.floor(Math.max(a, b, c, d) / step);
          if (n0 > n1) continue;
          const x = i * cell, y = j * cell;
          for (let n = n0; n <= n1; n++) {
            const L = n * step;
            const edges = CASES[(a > L ? 8 : 0) | (b > L ? 4 : 0) | (c > L ? 2 : 0) | (d > L ? 1 : 0)];
            if (!edges) continue;
            const path = n % 5 === 0 ? major : minor;
            for (let e = 0; e < edges.length; e += 2) {
              for (let s = 0; s < 2; s++) {
                let px, py;
                switch (edges[e + s]) {
                  case 0: px = x + cell * (L - a) / (b - a); py = y; break;
                  case 1: px = x + cell; py = y + cell * (L - b) / (c - b); break;
                  case 2: px = x + cell * (L - d) / (c - d); py = y + cell; break;
                  default: px = x; py = y + cell * (L - a) / (d - a);
                }
                if (s === 0) path.moveTo(px, py); else path.lineTo(px, py);
              }
            }
          }
        }
      }
      ctx.clearRect(0, 0, this.w, this.h);
      ctx.strokeStyle = this.color;
      ctx.lineCap = 'round';
      ctx.globalAlpha = this.minorAlpha;
      ctx.lineWidth = 0.9;
      ctx.stroke(minor);
      ctx.globalAlpha = this.majorAlpha;
      ctx.lineWidth = 1.5;
      ctx.stroke(major);
      ctx.globalAlpha = 1;
    }

    kick() {
      if (!this.animate || reduce.matches || !this.visible || document.hidden || this.raf) return;
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.tick);
    }

    tick(now) {
      this.raf = 0;
      if (!this.visible || document.hidden || reduce.matches) return;
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

  const init = () => document.querySelectorAll('canvas[data-terrain]').forEach(c => {
    if (!c.terrain) c.terrain = new Terrain(c);
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  // Web fonts can shift layout after first paint; redraw once they settle.
  document.fonts?.ready.then(() => document.querySelectorAll('canvas[data-terrain]').forEach(c => c.terrain?.resize()));
})();
