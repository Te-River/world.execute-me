/* mv/scenes.js — the storyboard.
 *
 * Art direction: the song is brisk and playful — 128 BPM, staccato delivery, a music-box
 * timbre, and a lyric that opens as a board game ("Lay down your pieces / and let's begin,
 * OBJECT CREATION"). So the film is drawn on light paper with ink line art and flat pop
 * colours, and everything lands with a spring (easeOutBack) rather than a fade: props pop
 * in, stamps squash and overshoot, the board fills stone by stone. Only after "you have
 * left" does the paper stain and drain; the EXECUTION chant is red ink on black paper;
 * the outro is the light going out of the page.
 *
 * Thirteen-plus scenes share one 1600x900 design space and each carries its own camera
 * move (frame(k,t) -> zoom + pan). Sub-phase thresholds come from the lyric timestamps,
 * so what is drawn changes when the line changes.
 */
(() => {
'use strict';
const DW = 1600, DH = 900, GY = DH * 0.84;
window.SCENE_SPACE = { DW, DH, GY };

const TAU = Math.PI * 2;
const clamp = (v) => v < 0 ? 0 : v > 1 ? 1 : v;
const seg = (k, a, b) => clamp((k - a) / (b - a));
const oback = (u) => { const c1 = 1.9, c3 = c1 + 1; u = clamp(u); return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); };
const wob = (t, hz, amp) => Math.sin(t * hz * TAU) * amp;

/* ink palette for the light acts; sheet() flips to paper-on-ink when the act is dark */
/* INK is the drawing colour of the current page. sheet() retargets it from the act's
   palette every frame, so the paper darkens continuously into the chant instead of
   flipping from light to dark at a boundary. */
let INK = '#2a333d';
const INK2 = '#66727d', RED = '#e8446a', MINT = '#28a07c', GOLD = '#e9a13c', BLUE = '#3f8fd0', DARK = '#12161b';
const lerp = (a, b, t) => a + (b - a) * t;

const G = {
  line(g, x1, y1, x2, y2) { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); },
  ray(g, x, y, dx, dy, len) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + dx * len, y + dy * len); g.stroke(); },
  poly(g, pts, close) {
    g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    if (close !== false) g.closePath();
    g.stroke();
  },
  fill(g, pts, close) { G.poly(g, pts, close === undefined ? true : close); g.fill(); },
  circle(g, x, y, r) { g.beginPath(); g.arc(x, y, Math.max(0.1, r), 0, TAU); g.stroke(); },
  disc(g, x, y, r) { g.beginPath(); g.arc(x, y, Math.max(0.1, r), 0, TAU); g.fill(); },
  box(g, x, y, w, h) { g.strokeRect(x, y, w, h); },
  text(g, s, x, y, size, align, weight) {
    g.font = `${weight || 500} ${size}px ui-monospace,Consolas,"Noto Sans Mono",monospace`;
    g.textAlign = align || 'center'; g.textBaseline = 'middle'; g.fillText(s, x, y);
  },
  arrowHead(g, x, y, s, ux, uy) {
    const px = -uy, py = ux;
    G.fill(g, [[x + ux * s, y + uy * s], [x + px * s * 0.55 - ux * s * 0.2, y + py * s * 0.55 - uy * s * 0.2],
    [x - px * s * 0.55 - ux * s * 0.2, y - py * s * 0.55 - uy * s * 0.2]]);
  },
  heart(g, x, y, r, fill) {
    g.beginPath(); g.moveTo(x, y + r * 0.85);
    g.bezierCurveTo(x - r * 1.35, y - r * 0.25, x - r * 0.5, y - r * 1.15, x, y - r * 0.35);
    g.bezierCurveTo(x + r * 0.5, y - r * 1.15, x + r * 1.35, y - r * 0.25, x, y + r * 0.85);
    g.closePath(); if (fill) g.fill(); g.stroke();
  },
  sine(g, x0, y, w, amp, cycles, phase, from, to) {
    from = from || 0; to = to === undefined ? 1 : to;
    g.beginPath();
    for (let i = 0; i <= 90; i++) {
      const u = from + (to - from) * (i / 90);
      const px = x0 + u * w, py = y + Math.sin(u * cycles * TAU + phase) * amp;
      i ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.stroke();
  },
  /* the girl: ink silhouette, drawn with a bob so she never stands dead still */
  figure(g, x, y, s, pose, t, rim, bounce) {
    const b = (bounce || 0) * 6;
    g.save(); g.translate(x, y - b); g.scale(s, s);
    const sway = Math.sin(t * 1.6) * 2.5;
    const body = INK;                                   /* sheet() retargets it per act */
    g.fillStyle = body; g.strokeStyle = body; g.lineCap = 'round';
    g.lineWidth = 8;
    if (pose === 'sit') {
      G.line(g, -6, -46, 26, -46); G.line(g, 26, -46, 28, -4);
      G.line(g, 2, -46, 34, -44); G.line(g, 34, -44, 36, -4);
      g.translate(0, -46);
    } else if (pose === 'kneel') {
      G.line(g, -4, -46, -16, -10); G.line(g, -16, -10, 14, -8);
      G.line(g, 6, -46, 20, -14); G.line(g, 20, -14, 22, -2);
      g.translate(0, -18);
    } else {
      G.line(g, -8, -46, -9 + sway * 0.4, -2); G.line(g, 8, -46, 9 + sway * 0.4, -2);
    }
    G.fill(g, [[-17, -104], [17, -104], [24, -46], [-24, -46]]);                    /* coat */
    g.lineWidth = 10; G.line(g, 0, -101, sway * 0.3, -113);                          /* neck */
    G.disc(g, sway * 0.3, -127, 15);                                                 /* head */
    g.beginPath(); g.arc(sway * 0.3, -129, 18, Math.PI * 0.98, Math.PI * 2.02); g.fill();
    G.fill(g, [[-16 + sway * 0.3, -131], [-12 + sway * 0.3, -110], [12 + sway * 0.3, -110], [16 + sway * 0.3, -131]]);
    g.save(); g.translate(0, -94); g.lineWidth = 8;
    if (pose === 'reach') { G.line(g, 16, 0, 54, -42); G.line(g, -16, 0, -42, 24); }
    else if (pose === 'empty') { G.line(g, 16, 0, 26, 40); G.line(g, -16, 0, -26, 40); }
    else { G.line(g, 16, 0, 26 + sway, 40); G.line(g, -16, 0, -26 + sway, 40); }
    g.restore();
    if (rim) {
      g.strokeStyle = rim; g.lineWidth = 3;
      G.poly(g, [[-17, -104], [-24, -46], [-9, -2]], false);
      g.beginPath(); g.arc(sway * 0.3, -127, 15, Math.PI * 0.7, Math.PI * 1.45); g.stroke();
    }
    g.restore();
  },
  cat(g, x, y, s, t) {
    g.save(); g.translate(x, y - Math.abs(Math.sin(t * 2.2)) * 6); g.scale(s, s);
    G.fill(g, [[-46, 0], [46, 0], [42, -26], [-42, -26]]);
    G.disc(g, 44, -38, 22);
    G.fill(g, [[33, -52], [40, -72], [47, -54]]); G.fill(g, [[52, -54], [59, -72], [64, -52]]);
    G.poly(g, [[-46, -16], [-74, -32 - Math.sin(t * 5) * 10], [-66, -12]], false);
    g.lineWidth = 2.6;
    G.line(g, 62, -38, 90, -44); G.line(g, 62, -33, 90, -29);
    g.fillStyle = INK; G.disc(g, 50, -40, 2.6); G.disc(g, 60, -40, 2.6);
    g.restore();
  },
  eggplant(g, x, y, s) {
    g.save(); g.translate(x, y); g.scale(s, s); g.rotate(-0.3);
    g.beginPath(); g.moveTo(2, -84);
    g.bezierCurveTo(34, -76, 36, -26, 12, -4); g.bezierCurveTo(-6, 12, -30, 2, -28, -34);
    g.bezierCurveTo(-27, -64, -16, -82, 2, -84); g.closePath(); g.fill();
    const cap = [[-12, -84], [2, -104], [16, -86], [2, -78]];
    const fc = g.fillStyle; g.fillStyle = MINT; G.fill(g, cap); g.fillStyle = fc;
    g.restore();
  },
  tomato(g, x, y, s) {
    g.save(); g.translate(x, y); g.scale(s, s);
    g.beginPath(); g.ellipse(0, -32, 34, 30, 0, 0, TAU); g.fill();
    const cap = [[-16, -58], [0, -74], [16, -58], [0, -64]];
    const fc = g.fillStyle; g.fillStyle = MINT; G.fill(g, cap); g.fillStyle = fc;
    g.restore();
  },
  chess(g, x, y, s, kind) {
    g.save(); g.translate(x, y); g.scale(s, s);
    if (kind === 'pawn') { G.fill(g, [[-15, 0], [15, 0], [9, -13], [-9, -13]]); G.disc(g, 0, -24, 10); }
    else { G.fill(g, [[-17, 0], [17, 0], [11, -30], [-11, -30]]); G.fill(g, [[-13, -30], [13, -30], [9, -40], [-9, -40]]); }
    g.restore();
  },
  stone(g, x, y, r, black) {
    g.fillStyle = black ? INK : '#fbfbf7';
    g.beginPath(); g.ellipse(x, y + r * 0.28, r, r * 0.72, 0, 0, TAU); g.fill();
    g.strokeStyle = black ? INK : '#c9c6ba'; g.lineWidth = 2;
    g.beginPath(); g.ellipse(x, y + r * 0.28, r, r * 0.72, 0, 0, TAU); g.stroke();
  },
  cube(g, x, y, r, a) {
    const c = Math.cos(a), s = Math.sin(a), d = 0.42;
    const v = (i, j, k2) => [x + (i + j * c * d) * r, y + (k2 * 0.9 + (i - j) * s * d * 0.5) * r * 0.6 - k2 * r * 0.2];
    const A = v(-1, -1, 0), B = v(1, -1, 0), C = v(1, 1, 0), D = v(-1, 1, 0);
    const E = v(-1, -1, 1), F2 = v(1, -1, 1), F3 = v(1, 1, 1), H = v(-1, 1, 1);
    const s2 = (p, q) => G.line(g, p[0], p[1], q[0], q[1]);
    s2(A, B); s2(B, C); s2(C, D); s2(D, A); s2(E, F2); s2(F2, F3); s2(F3, H); s2(H, E);
    s2(A, E); s2(B, F2); s2(C, F3); s2(D, H);
  },
  stamp(g, x, y, w, h, txt, size) {
    g.save(); g.translate(x, y); g.rotate(-0.05);
    G.box(g, -w / 2, -h / 2, w, h);
    if (txt) G.text(g, txt, 0, 0, size || h * 0.42);
    g.restore();
  },
  cage(g, x, yTop, yBot, w, n) {
    const yb = Math.min(yBot, DH * 0.8);
    for (let i = 0; i <= n; i++) { const px = x - w / 2 + (i / n) * w; G.line(g, px, yTop, px, yb); }
  },
  /* 朱批 — the judge's red brush. The chant is signed one stroke per word. */
  brush(g, x, y, w, h) {
    g.beginPath();
    g.moveTo(x - w / 2, y);
    g.quadraticCurveTo(x - w * 0.15, y - h * 1.5, x + w * 0.35, y - h * 0.9);
    g.quadraticCurveTo(x + w / 2, y - h * 0.4, x + w / 2, y + h * 0.2);
    g.quadraticCurveTo(x + w * 0.1, y + h * 1.3, x - w * 0.34, y + h * 0.7);
    g.closePath(); g.fill();
  },
  /* 庄周梦蝶 — sine wings. For a simulation that cannot say who is dreaming whom. */
  butterfly(g, x, y, r, t, flap) {
    const f = 0.5 + 0.5 * Math.abs(Math.sin(t * (2.6 + (flap || 0))));
    g.save(); g.translate(x, y);
    for (const s of [-1, 1]) {
      g.beginPath();
      for (let i = 0; i <= 34; i++) {
        const u = i / 34, a = u * Math.PI;
        const rr = r * Math.sin(a) * (0.55 + 0.75 * Math.cos(a * 1.6)) * (0.45 + f * 0.75);
        const px = s * rr, py = -r * 0.85 * Math.cos(a);
        i ? g.lineTo(px, py) : g.moveTo(px, py);
      }
      g.closePath(); g.stroke();
    }
    g.lineWidth = Math.max(1.6, r * 0.05); G.line(g, 0, -r * 0.6, 0, r * 0.62);
    g.restore();
  },
  /* the executioner's blade, for 刽子手 */
  blade(g, x, y, s, tilt) {
    g.save(); g.translate(x, y); g.scale(s, s); g.rotate(tilt || 0);
    G.fill(g, [[-15, 0], [15, 0], [11, -26], [-11, -26]]);
    g.beginPath(); g.moveTo(-13, -26);
    g.quadraticCurveTo(6, -120, 40, -158); g.quadraticCurveTo(20, -104, 13, -26);
    g.closePath(); g.stroke();
    g.restore();
  },
};
window.SCENE_G = G;

const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
/* mix two hex colours; used to shade the flat colour fields */
const tint = (a, b, t) => {
  const A = hex(a), B = hex(b);
  return '#' + A.map((v, i) => Math.round(lerp(v, B[i], clamp(t))).toString(16).padStart(2, '0')).join('');
};
const env0 = (F) => (F[0] + F[1] + F[2]) / 3;
/* the page: a coloured sky (painted by mv.js), a flat ground, two tinted ridges,
   a saturated sun, and a printed grid knocked out in white. */
function sheet(g, col, t, F, o) {
  o = o || {};
  if (col.ink) INK = col.ink;                      /* the page's ink, continuous across acts */
  const hy = o.hy || DH * 0.62;
  const deep = tint(col.cool, '#000000', 0.22);
  const pale = tint(col.cool, '#ffffff', 0.35);
  if (o.horizon !== false) {
    g.fillStyle = col.cool; g.fillRect(-80, hy, DW + 160, DH - hy + 80);
    const ridge = (yb, amp, ph, tone) => {
      g.fillStyle = tone; g.beginPath(); g.moveTo(-80, DH + 40);
      for (let x = -80; x <= DW + 80; x += 22) {
        const n = Math.sin(x * 0.004 + ph) * 0.6 + Math.sin(x * 0.011 + ph * 1.7) * 0.4;
        g.lineTo(x, yb - (0.5 + n * 0.5) * amp);
      }
      g.lineTo(DW + 80, DH + 40); g.closePath(); g.fill();
    };
    ridge(hy + 4, 132, 1.2, pale);
    ridge(hy + 26, 74, 3.4, deep);
    /* the town: the snowbound world of NEKODAY, sitting on the horizon line */
    g.fillStyle = tint(col.cool, '#000000', 0.52);
    for (let i = 0; i < 14; i++) {
      const x = 40 + i * 112 + ((i * 37) % 40), w = 44 + ((i * 23) % 34), hh = 22 + ((i * 31) % 40);
      g.beginPath();
      g.moveTo(x, hy + 6); g.lineTo(x, hy - hh);
      g.lineTo(x + w / 2, hy - hh - 14); g.lineTo(x + w, hy - hh); g.lineTo(x + w, hy + 6);
      g.closePath(); g.fill();
      if (i % 3 === 0) g.fillRect(x + w * 0.35, hy - hh * 0.6, 7, 7);          // one lit window
    }
    g.strokeStyle = tint(col.cool, '#000000', 0.62); g.lineWidth = 3;
    for (let i = 0; i < 5; i++) {                                              // telephone poles and wires
      const x = 160 + i * 320;
      G.line(g, x, hy + 6, x, hy - 74); G.line(g, x - 16, hy - 60, x + 16, hy - 60);
      if (i) G.poly(g, [[x - 320, hy - 60], [x - 160, hy - 40], [x, hy - 60]], false);
    }
    g.strokeStyle = tint(col.cool, '#000000', 0.45); g.lineWidth = 2.6;
    G.line(g, -80, hy + 4, DW + 80, hy + 4);
    if (o.sun !== false) {
      g.fillStyle = col.hot;
      g.beginPath(); g.arc(DW * 0.5, hy - 152, 96 + env0(F) * 34 + wob(t, 0.5, 3), 0, TAU); g.fill();
      g.globalAlpha = 0.35; g.strokeStyle = col.hot; g.lineWidth = 3;
      G.circle(g, DW * 0.5, hy - 152, 140 + env0(F) * 44);
      g.globalAlpha = 1;
    }
  }
  /* the printed grid and the board are knocked out in white over the colour */
  if (o.grid !== 0) {
    g.strokeStyle = '#ffffff'; g.lineWidth = 1; g.globalAlpha = 0.13;
    for (let x = 0; x <= DW; x += 80) G.line(g, x, 0, x, DH);
    for (let y = 0; y <= DH; y += 80) G.line(g, 0, y, DW, y);
    g.globalAlpha = 1;
  }
  if (o.board) {
    const bx0 = DW - 300, by0 = 70, n = 9, cell = 26;
    g.strokeStyle = '#ffffff'; g.lineWidth = 1.8; g.globalAlpha = 0.55;
    for (let i = 0; i < n; i++) { G.line(g, bx0, by0 + i * cell, bx0 + (n - 1) * cell, by0 + i * cell); G.line(g, bx0 + i * cell, by0, bx0 + i * cell, by0 + (n - 1) * cell); }
    g.globalAlpha = 1;
    const stones = o.stones || 0;
    for (let i = 0; i < stones; i++) {
      const px = bx0 + ((i * 3) % 8) * cell, py = by0 + ((i * 5) % 8) * cell;
      G.stone(g, px, py, 11, i % 2 === 0);
    }
  }
}
function confetti(g, t, F, n, col) {
  if (!window.__flakes) {
    let s = 99; const r = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
    window.__flakes = Array.from({ length: 240 }, () => ({ x: r(), y: r(), z: 0.3 + r() * 0.7, d: r() }));
  }
  const cols = [col.hot, GOLD, MINT, BLUE];
  for (let i = 0; i < Math.min(n, window.__flakes.length); i++) {
    const f = window.__flakes[i];
    const y = ((f.y + t * 0.05 * f.z) % 1) * DH, x = (f.x + Math.sin(t * 1.1 + f.d * 9) * 0.03) * DW;
    g.fillStyle = cols[i % 4]; g.globalAlpha = (0.25 + f.z * 0.5) * (0.35 + F[6] * 0.7);
    g.save(); g.translate(x, y); g.rotate(t * (0.6 + f.d) + f.ph);
    g.fillRect(-3 * f.z, -2 * f.z, 7 * f.z, 4.4 * f.z); g.restore();
  }
  g.globalAlpha = 1;
}
/* the same flakes, drained: snow instead of confetti */
function snow(g, t, F, n, col) {
  if (!window.__flakes) confetti(g, 0, F, 0, col);
  g.fillStyle = col.ink;
  for (let i = 0; i < Math.min(n, window.__flakes.length); i++) {
    const f = window.__flakes[i];
    const y = ((f.y + t * 0.03 * f.z) % 1) * DH, x = (f.x + Math.sin(t * 0.5 + f.d * 9) * 0.02) * DW;
    g.globalAlpha = (0.08 + f.z * 0.35) * (0.3 + F[6] * 0.7);
    G.disc(g, x, y, f.z * (1.2 + F[7] * 1.8));
  }
  g.globalAlpha = 1;
}

const S = [];

/* The program the film is running. The EXECUTION chant is not a red bar chart: it is
   this listing, one line per hit, ending where the song ends. */
const PROGRAM = [
  'class me extends world {',
  '    Heart heart;                        // never initialised',
  '    Dimension dimension() { return points; }',
  '    double circumference() { return 2 * PI * r; }',
  '    double limit() { return infinity; }',
  '    Object offer() { return nutrients; }',
  '    boolean love() { return you != null; }',
  '}',
  '',
  '// runtime',
  'world.execute(me);',
  'me.run();',
  'while (you.isPresent()) { me.stay(); }',
  'you = null;                             // though you have left',
  'me.isolate();',
  'throw new IllegalArgumentException();',
  'process.kill(me, SIGKILL);',
  'exit(0);',
  'return her;'
];
function code(g, active, x, y, lh, strikethrough) {
  const fs = Math.round(lh * 0.58);
  PROGRAM.forEach((ln, i) => {
    const yy = y + i * lh;
    if (i === active) { g.fillStyle = 'rgba(255,45,85,0.22)'; g.fillRect(x - 62, yy - lh * 0.46, DW - x + 62, lh * 0.92); }
    const done = active === undefined || i <= active;
    g.fillStyle = i === active ? '#ff2d55' : (done ? INK : INK2);
    g.globalAlpha = done ? 1 : 0.32;
    G.text(g, String(i + 1).padStart(2, ' '), x - 26, yy, fs, 'right');
    G.text(g, ln, x, yy, fs, 'left');
    const c = ln.indexOf('//');
    if (c > 0) {
      const w = g.measureText(ln.slice(0, c)).width;
      g.fillStyle = i === active ? '#ff9fb0' : INK2;
      G.text(g, ln.slice(c), x + w, yy, fs, 'left');
    }
    if (strikethrough !== undefined && i <= strikethrough) {
      g.strokeStyle = '#ff2d55'; g.lineWidth = 3;
      G.line(g, x - 60, yy, x + g.measureText(ln).width + 8, yy);
    }
    g.globalAlpha = 1;
  });
}

/* 1 — 0..16 s: plug in, lay down the pieces, create the object */
S.push({ id: 'boot', from: 0, to: 16,
  frame: (k) => k < 0.3 ? { z: 1.6, x: 300, y: 430 } : { z: 1.05, x: DW * 0.5, y: DH * 0.5 },
  draw(g, k, F, t, col) {
    sheet(g, col, t, F, { board: true, stones: Math.floor(seg(t, 3.87, 6.3) * 12) });
    const on = t > 0.1;
    g.strokeStyle = INK; g.lineWidth = 3; G.box(g, 200, 400, 120, 76);
    g.beginPath(); g.moveTo(214, 462); g.lineTo(on ? 306 : 236, on ? 412 : 396); g.stroke();
    g.lineWidth = 3.4;
    g.beginPath(); g.moveTo(320, 438); g.bezierCurveTo(620, 470, 880, 250, 1120, 300); g.stroke();
    if (on) {
      g.fillStyle = col.hot;
      for (let i = 0; i < 12; i++) {
        const u = (i / 12 + t * 0.28) % 1, x = 320 + u * 800, y = 438 - Math.sin(u * Math.PI) * 150;
        G.disc(g, x, y, 4 + F[1] * 4);
      }
    }
    if (t > 2.92 && t < 4.4) {                                   /* PROTECTION lands with a bounce */
      const u = oback(seg(t, 2.92, 3.5));
      g.strokeStyle = INK; g.lineWidth = 4;
      g.save(); g.translate(700, 372); g.scale(u, u);
      g.beginPath(); g.arc(0, 0, 62, Math.PI, 0); g.stroke();
      G.line(g, -62, 0, 62, 0);
      g.fillStyle = col.hot; g.globalAlpha = 0.25; g.fillRect(-60, 0, 120, 40); g.globalAlpha = 1;
      g.restore();
    }
    if (t > 3.87) {                                              /* the board, in perspective */
      const u = seg(t, 3.87, 6.2);
      g.strokeStyle = INK; g.lineWidth = 1.8; g.globalAlpha = 0.5 + u * 0.4;
      for (let i = 0; i <= 6; i++) G.line(g, 480 + i * 108, 690, 560 + i * 88, 570);
      for (let j = 0; j <= 3; j++) G.line(g, 480 + j * 13, 690 - j * 40, 1128 - j * 13, 690 - j * 40);
      g.globalAlpha = 1;
      const n = Math.min(5, Math.floor(u * 6.5));
      for (let i = 0; i < n; i++) {
        const pop = oback(seg(t, 3.87 + i * 0.42, 4.3 + i * 0.42));
        g.fillStyle = INK; g.strokeStyle = INK;
        g.save(); g.translate(520 + i * 116, 682 - (i % 2) * 34); g.scale(pop, pop * (2 - pop));
        G.chess(g, 0, 0, 0.95, i % 2 ? 'pawn' : 'rook'); g.restore();
      }
    }
    if (t > 6.38) {                                              /* OBJECT CREATION */
      const u = oback(seg(t, 6.38, 8.2));
      g.strokeStyle = INK; g.lineWidth = 2.6;
      g.save(); g.translate(800, 520); g.scale(u, u); G.cube(g, 0, 0, 84, t * 0.5); g.restore();
      g.textAlign = 'left';
      const fields = ['name = "me"', 'body = { points }', 'heart = null', 'run = true'];
      for (let i = 0; i < Math.min(4, Math.floor(seg(t, 10.09, 12.6) * 4.4)); i++) {
        g.globalAlpha = oback(seg(t, 10.09 + i * 0.5, 10.56 + i * 0.5));
        g.fillStyle = i === 2 ? RED : INK;                       /* the warning, in red */
        G.text(g, 'me.' + fields[i], 930, 452 + i * 34, 27, 'left');
      }
      g.globalAlpha = 1;
    }
    if (t > 11.09) sheet(g, col, t, F, { grid: 0, horizon: true, board: false, sun: false });   /* the world unfolds */
  } });

/* 2 — 16..29.7 s: the snow globe, and the title inside it */
S.push({ id: 'globe', from: 16, to: 29.7,
  frame: (k) => ({ z: 1.02 + k * 0.7, x: DW * 0.5, y: DH * 0.45 }),
  draw(g, k, F, t, col) {
    const ox = DW * 0.5, oy = DH * 0.45, r = 290;
    g.save(); g.beginPath(); g.arc(ox, oy, r, 0, TAU); g.clip();
    sheet(g, col, t, F, { grid: 0, board: false });
    confetti(g, t, F, 70, col);
    g.fillStyle = INK; g.strokeStyle = INK;
    G.figure(g, ox, oy + 200, 0.95, 'stand', t, col.hot, F[8]);
    g.restore();
    g.strokeStyle = INK; g.lineWidth = 4; G.circle(g, ox, oy, r);
    g.lineWidth = 1.6; g.globalAlpha = 0.4; G.circle(g, ox, oy, r + 16); g.globalAlpha = 1;
    g.strokeStyle = GOLD; g.lineWidth = 5;
    G.fill(g, [[ox - 100, oy + r + 10], [ox + 100, oy + r + 10], [ox + 74, oy + r + 66], [ox - 74, oy + r + 66]]);
    g.strokeStyle = INK; g.globalAlpha = 0.18; g.lineWidth = 3;
    g.beginPath(); g.ellipse(ox - r * 0.42, oy - r * 0.5, r * 0.16, r * 0.3, -0.6, 0, TAU); g.stroke();
    g.globalAlpha = 1;
  } });

/* 3 — 29.7..44.45 s: the four offers, drawn on the page */
S.push({ id: 'geometry', from: 29.7, to: 44.45,
  frame: (k) => ({ z: 1.06, x: DW * (0.4 + k * 0.16), y: DH * 0.44 }),
  draw(g, k, F, t, col) {
    sheet(g, col, t, F, { grid: 1, board: false, hy: DH * 0.8 });    /* she writes on the world itself */
    g.lineWidth = 3; g.strokeStyle = INK; g.fillStyle = INK;
    if (t < 33.41) {
      const cx = 620, cy = 400;
      G.ray(g, cx, cy, 1, 0, 400); G.ray(g, cx, cy, 0, -1, 280); G.ray(g, cx, cy, 0.62, 0.78, 230);
      G.arrowHead(g, cx + 400, cy, 22, 1, 0); G.arrowHead(g, cx, cy - 280, 22, 0, -1); G.arrowHead(g, cx + 143, cy + 179, 22, 0.62, 0.78);
      G.text(g, 'x', cx + 424, cy + 28, 28, 'left'); G.text(g, 'y', cx + 26, cy - 292, 28, 'left');
      const u = seg(t, 29.7, 32.6);
      for (let i = 0; i < 34; i++) {
        if (i / 34 > u) break;
        const a = i * 2.399, rr = 22 + i * 5.0;
        G.disc(g, cx + Math.cos(a) * rr * 1.15, cy + Math.sin(a) * rr * 0.6, 3.4 + F[3] * 2.6);
      }
    } else if (t < 37.06) {
      const u = oback(seg(t, 33.41, 35.6)), cx = 470, cy = 400;
      g.strokeStyle = INK; g.lineWidth = 3.4; G.circle(g, cx, cy, 150);
      g.strokeStyle = RED; g.lineWidth = 8;
      g.beginPath(); g.arc(cx, cy, 150, -Math.PI / 2, -Math.PI / 2 + u * TAU); g.stroke();
      const a = -Math.PI / 2 + u * TAU;
      g.strokeStyle = INK; g.lineWidth = 2.4; G.line(g, cx, cy, cx + Math.cos(a) * 150, cy + Math.sin(a) * 150);
      g.fillStyle = INK; G.disc(g, cx, cy, 5);
      g.strokeStyle = GOLD; g.lineWidth = 6; G.line(g, 860, 250, 860 + u * 600, 250);
      g.fillStyle = INK; G.text(g, 'C = 2πr', 860, 190, 34, 'left');
    } else if (t < 40.7) {
      const u = seg(t, 37.06, 39.6), y = 420;
      g.strokeStyle = INK; g.lineWidth = 4;
      G.sine(g, 160, y, DW - 320, 160, 2, t * 1.6, 0, Math.min(1, u * 1.5));
      if (u > 0.35) {
        const w = DW - 320, a = oback(seg(u, 0.35, 1));
        g.strokeStyle = MINT; g.lineWidth = 2.6;
        for (let i = 0; i < 5; i++) {
          const uu = 0.12 + i * 0.19, px = 160 + w * uu, ph = uu * 2 * TAU + t * 1.6;
          const py = y + Math.sin(ph) * 160, d = Math.cos(ph) * 160 * (2 * TAU / w), L = 130 * a;
          G.line(g, px - L, py - d * L, px + L, py + d * L);
          g.fillStyle = GOLD; G.disc(g, px, py, 7);
        }
      }
    } else {
      const u = seg(t, 40.7, 43.6);
      g.strokeStyle = INK; g.lineWidth = 2.6; G.line(g, 160, 560, DW - 160, 560);
      g.setLineDash([10, 10]); g.strokeStyle = RED; g.lineWidth = 3.4;
      G.line(g, DW - 380, 150, DW - 380, 560); g.setLineDash([]);
      g.strokeStyle = BLUE; g.lineWidth = 4.4; g.beginPath();
      for (let i = 0; i <= 80; i++) {
        const x = 160 + (i / 80) * (DW - 620) * Math.min(1, u * 1.3);
        const y = 560 - 340 / (1 + Math.pow((x - 160) / 170, 2));
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.stroke();
      g.fillStyle = INK; G.text(g, 'lim', DW - 350, 604, 30, 'left');
    }
  } });

/* 4 — 44.45..59.22 s: current, sight, dizziness, time, union */
S.push({ id: 'current', from: 44.45, to: 59.22,
  frame: (k, t) => t < 47.67 ? { z: 1.2, x: DW * 0.5, y: DH * 0.42 }
    : t < 49.53 ? { z: 1.9, x: DW * 0.5, y: DH * 0.38 }
    : t < 51.36 ? { z: 1.35, x: DW * 0.5, y: DH * 0.42 }
    : t < 55.08 ? { z: 1.02, x: DW * 0.5, y: DH * 0.44 }
    : { z: 1.25, x: DW * 0.5, y: DH * 0.4 },
  draw(g, k, F, t, col) {
    sheet(g, col, t, F, { grid: 0, board: false });
    const cx = DW * 0.5, cy = DH * 0.38;
    g.lineWidth = 3; g.strokeStyle = INK; g.fillStyle = INK;
    if (t < 47.67) {
      g.lineWidth = 5; G.box(g, 240, 170, DW - 480, 430);
      const u = seg(t, 44.45, 47.6);
      g.strokeStyle = MINT; g.lineWidth = 4;
      G.sine(g, 280, cy + 40, DW - 560, 140 * (1 - u), 3, t * 3.2);
      g.strokeStyle = GOLD; g.lineWidth = 5; g.globalAlpha = u;
      G.line(g, 280, cy + 40, 280 + (DW - 560) * u, cy + 40); g.globalAlpha = 1;
      g.fillStyle = INK; G.text(g, u < 0.5 ? 'AC' : 'DC', 320, 230, 36, 'left');
    } else if (t < 49.53) {
      const u = seg(t, 47.67, 49.5);
      g.strokeStyle = INK; g.lineWidth = 4;
      g.beginPath(); g.ellipse(cx, cy, 320, 160 * (1 - u * 0.92), 0, 0, TAU); g.stroke();
      g.fillStyle = BLUE; g.globalAlpha = 0.7; G.disc(g, cx, cy, 66 * (1 - u * 0.5)); g.globalAlpha = 1;
      g.fillStyle = INK; G.disc(g, cx, cy, 28);
      g.strokeStyle = RED; g.lineWidth = 8;
      G.line(g, cx - 340, cy - 170 * u, cx + 340, cy - 170 * u);
      G.line(g, cx - 340, cy + 170 * u, cx + 340, cy + 170 * u);
    } else if (t < 51.36) {
      g.strokeStyle = INK; g.lineWidth = 3; g.beginPath();
      for (let i = 0; i < 340; i++) { const a = i * 0.11 + t * 2.4, r = i * 2.3; const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.62; i ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke();
      g.strokeStyle = RED; g.globalAlpha = 0.5; g.beginPath();
      for (let i = 0; i < 200; i++) { const a = -i * 0.13 - t * 1.9, r = i * 3; const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.62; i ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke(); g.globalAlpha = 1;
    } else if (t < 55.08) {
      const u = seg(t, 51.36, 55);
      g.strokeStyle = INK; g.lineWidth = 3; G.line(g, 140, cy, DW - 140, cy);
      for (let i = 0; i <= 16; i++) { const x = 140 + i * ((DW - 280) / 16); G.line(g, x, cy - 18, x, cy + 18); }
      g.fillStyle = GOLD; G.text(g, 'B.C.', 170, cy - 62, 34, 'left');
      g.fillStyle = MINT; G.text(g, 'A.D.', DW - 170, cy - 62, 34, 'right');
      const px = DW - 180 - u * (DW - 360);
      g.strokeStyle = RED; g.fillStyle = RED; g.lineWidth = 5;
      G.ray(g, px, cy, -1, 0, 60); G.arrowHead(g, px - 60, cy, 24, -1, 0); G.disc(g, px, cy, 8);
      G.text(g, String(Math.round(2026 + u * 3000)) + ' B.C.', px, cy + 76, 28);
    } else {
      const u = oback(seg(t, 55.08, 58.8));
      g.lineWidth = 4; const d = 260 * (1 - u * 0.5);
      g.strokeStyle = MINT; G.circle(g, cx - d / 2, cy, 180);
      g.strokeStyle = RED; G.circle(g, cx + d / 2, cy, 180);
      g.fillStyle = GOLD; g.globalAlpha = 0.2 + u * 0.35;
      g.beginPath();
      g.arc(cx - d / 2, cy, 180, -1.05, 1.05); g.arc(cx + d / 2, cy, 180, Math.PI - 1.05, Math.PI + 1.05);
      g.closePath(); g.fill(); g.globalAlpha = 1;
    }
  } });

/* 5 — 59.22..74.04 s: first chorus, the cursor and the heart */
S.push({ id: 'chorus1', from: 59.22, to: 74.04,
  frame: (k) => ({ z: 1.12 - k * 0.08, x: DW * (0.55 - k * 0.05), y: DH * (0.5 - k * 0.04) }),
  draw(g, k, F, t, col) {
    sheet(g, col, t, F, { board: true, stones: 14 });
    confetti(g, t, F, 60, col);
    g.strokeStyle = INK; g.fillStyle = INK;
    G.figure(g, DW * 0.6, GY, 1.35, t > 70 ? 'reach' : 'stand', t, col.hot, F[8]);
    g.fillStyle = '#ffffff'; g.strokeStyle = INK; g.lineWidth = 3;
    const px = DW * 0.46 + wob(t, 0.22, 150), py = 210 + wob(t, 0.17, 46);
    G.fill(g, [[px, py], [px, py + 52], [px + 16, py + 38], [px + 28, py + 62], [px + 40, py + 56], [px + 26, py + 33], [px + 44, py + 30]]);
    g.stroke();
    if (t > 61.95 && t < 66.6) {                    /* STIMULATIONS: rings thrown off the cursor */
      const u = seg(t, 61.95, 65.3);
      g.strokeStyle = col.hot; g.lineWidth = 3.4;
      for (let i = 0; i < 4; i++) {
        const p = (u * 1.7 + i / 4) % 1;
        g.globalAlpha = 0.6 * (1 - p); G.circle(g, px, py + 40, 22 + p * 200);
      }
      g.globalAlpha = 1;
    }
    if (t > 65.39) {                                /* SATISFACTION: the heart, on its line */
      const u = oback(seg(t, 65.39, 67.0)), beat = 1 + F[8] * 0.08;
      g.save(); g.translate(DW * 0.4, 330); g.scale(u * beat, u * beat);
      g.strokeStyle = RED; g.fillStyle = 'rgba(232,68,106,0.2)'; g.lineWidth = 5;
      G.heart(g, 0, 0, 84, true); g.lineWidth = 5; G.heart(g, 0, 0, 84, false);
      g.restore();
    }
    if (t > 68.25) {                                /* I will run the EXECUTION: a prompt, then RUN */
      const u = seg(t, 68.25, 70.1);
      g.strokeStyle = INK; g.lineWidth = 3; G.box(g, 150, 618, 520, 116);
      g.fillStyle = INK;
      G.text(g, '> run execution'.slice(0, Math.max(2, Math.floor(u * 20))), 176, 662, 34, 'left');
      if (t > 69.25) { g.fillStyle = RED; G.fill(g, [[596, 636], [596, 716], [654, 676]]); }
    }
    if (t > 70.08) {
      const u = oback(seg(t, 70.08, 73.6));
      g.strokeStyle = INK; g.lineWidth = 7;
      G.cage(g, DW * 0.5, DH * 0.06 - (1 - u) * 300, GY + 6, DW * 0.8, 9);
    }
  } });

/* 6 — 74.04..88.58 s: the still life, one offering at a time */
S.push({ id: 'gifts', from: 74.04, to: 88.58,
  frame: (k, t) => t < 77.57 ? { z: 1.6, x: 420, y: DH * 0.66 }
    : t < 81.35 ? { z: 1.6, x: 800, y: DH * 0.66 }
    : t < 85.07 ? { z: 1.6, x: 1180, y: DH * 0.66 }
    : { z: 1.02, x: DW * 0.5, y: DH * 0.46 },
  draw(g, k, F, t, col) {
    sheet(g, col, t, F, { grid: 0, board: false, hy: DH * 0.7, sun: false });
    g.strokeStyle = INK; g.lineWidth = 6; G.line(g, 40, GY, DW - 40, GY);
    g.lineWidth = 3; G.line(g, 40, GY + 20, DW - 40, GY + 20);
    const items = [[420, 74.04, 'NUTRIENTS', '#7a5cc4', 'eggplant'],
                   [800, 77.57, 'ANTIOXIDANTS', RED, 'tomato'],
                   [1180, 81.35, 'ENJOYMENT', GOLD, 'cat']];
    items.forEach((it) => {
      if (t > 85.07 || t < it[1]) return;
      const u = oback(seg(t, it[1], it[1] + 0.55));
      g.fillStyle = it[3]; g.strokeStyle = INK; g.lineWidth = 3;
      const sc = 2.2 * u;
      g.save(); g.translate(it[0], GY - 6); g.rotate(wob(t, 0.3, 0.03));
      if (it[4] === 'cat') G.cat(g, 0, 0, sc, t);
      else if (it[4] === 'tomato') G.tomato(g, 0, 0, sc);
      else G.eggplant(g, 0, 0, sc);
      g.restore();
      g.fillStyle = INK; G.text(g, it[2], it[0], GY - 230, 30);
    });
    if (t > 82.83 && t < 85.07) {
      g.strokeStyle = GOLD; g.lineWidth = 3;
      for (let i = 0; i < 3; i++) { const p = (t * 0.9 + i / 3) % 1; g.globalAlpha = 0.5 * (1 - p); G.circle(g, 1250, GY - 100, 30 + p * 120); }
      g.globalAlpha = 1;
    }
    if (t > 85.07) {
      const u = oback(seg(t, 85.07, 86.8));
      g.strokeStyle = GOLD; g.lineWidth = 6;
      g.save(); g.translate(DW * 0.42, 300); g.scale(u, u);
      g.beginPath(); g.ellipse(0, 0, 132, 32, 0, 0, TAU); g.stroke(); g.restore();
      g.fillStyle = INK; g.strokeStyle = INK;
      G.figure(g, DW * 0.42, GY, 1.3, 'stand', t, GOLD, F[8]);
      const st = oback(seg(t, 87.92, 88.5));
      if (st > 0) {
        g.save(); g.translate(DW * 0.66, 400); g.rotate(-0.05); g.scale(st, st * (2 - st));
        g.strokeStyle = MINT; g.fillStyle = MINT; g.lineWidth = 5;
        G.box(g, -165, -52, 330, 104); G.text(g, 'PROOF', 0, 0, 46);
        g.restore();
      }
    }
  } });

/* 7 — 88.58..110.9 s: the switches */
S.push({ id: 'switches', from: 88.58, to: 110.9,
  frame: (k, t) => t < 92.01 ? { z: 1.4, x: DW * 0.5, y: DH * 0.42 }
    : t < 95.46 ? { z: 1.7, x: DW * 0.5, y: DH * 0.38 }
    : t < 99.34 ? { z: 1.3, x: DW * 0.5, y: DH * 0.42 }
    : t < 103.48 ? { z: 1.1, x: DW * 0.5, y: DH * 0.44 }
    : { z: 1.0, x: DW * 0.5, y: DH * 0.46 },
  draw(g, k, F, t, col) {
    sheet(g, col, t, F, { grid: 0, board: false, hy: DH * 0.72, sun: false });
    const cx = DW * 0.5, cy = DH * 0.4;
    g.lineWidth = 3; g.strokeStyle = INK; g.fillStyle = INK;
    if (t < 92.01) {
      const u = oback(seg(t, 88.58, 91.4));
      g.lineWidth = 2.4; G.line(g, cx, 140, cx, DH - 140);
      g.lineWidth = 7; g.strokeStyle = RED;
      G.circle(g, cx - 300 + u * 120, cy - 20, 82);
      G.line(g, cx - 300 + u * 120, cy + 62, cx - 300 + u * 120, cy + 136);
      G.line(g, cx - 334 + u * 120, cy + 102, cx - 266 + u * 120, cy + 102);
      g.strokeStyle = MINT; g.globalAlpha = clamp(u);
      G.circle(g, cx + 300 - u * 120, cy - 44, 66);
      G.line(g, cx + 348 - u * 120, cy - 92, cx + 412 - u * 120, cy - 156);
      G.line(g, cx + 362 - u * 120, cy - 156, cx + 412 - u * 120, cy - 156);
      G.line(g, cx + 412 - u * 120, cy - 106, cx + 412 - u * 120, cy - 156);
      g.globalAlpha = 1; g.fillStyle = INK;
      G.text(g, 'F', cx - 430, cy + 210, 40, 'left'); G.text(g, 'M', cx + 430, cy + 210, 40, 'right');
    } else if (t < 95.46) {
      const u = seg(t, 92.01, 95.4);
      g.lineWidth = 4; G.circle(g, cx, cy, 200);
      for (let i = 0; i < 12; i++) { const a = i / 12 * TAU - Math.PI / 2; G.line(g, cx + Math.cos(a) * 170, cy + Math.sin(a) * 170, cx + Math.cos(a) * 200, cy + Math.sin(a) * 200); }
      g.lineWidth = 8; const a = u * 2 * TAU - Math.PI / 2;
      G.line(g, cx, cy, cx + Math.cos(a) * 148, cy + Math.sin(a) * 148);
      g.lineWidth = 3; const b = u * 24 * TAU - Math.PI / 2;
      G.line(g, cx, cy, cx + Math.cos(b) * 186, cy + Math.sin(b) * 186);
      G.disc(g, cx, cy, 9);
      G.text(g, u < 0.5 ? 'AM' : 'PM', cx, cy + 270, 40);
    } else if (t < 99.34) {
      const u = oback(seg(t, 95.46, 99.1));
      g.lineWidth = 2.4; G.line(g, cx, 150, cx, DH - 150);
      g.fillStyle = RED; G.text(g, 'S', cx - 260 + u * 520, cy, 180, 'center', 700);
      g.fillStyle = MINT; G.text(g, 'M', cx + 260 - u * 520, cy, 180, 'center', 700);
    } else if (t < 103.48) {
      const u = seg(t, 99.34, 103.4);
      for (let i = 0; i < 10; i++) {
        const r = ((i / 10 + u * 0.9) % 1) * 400;
        g.globalAlpha = 0.15 + (1 - r / 400) * 0.6;
        g.strokeStyle = i % 2 ? RED : MINT; g.lineWidth = 4;
        G.circle(g, cx, cy, r + 24);
      }
      g.globalAlpha = 1;
    } else {
      const u = seg(t, 106.29, 110.4);
      g.strokeStyle = MINT; g.lineWidth = 4;
      G.sine(g, 200, cy, DW - 400, 120 * (1 - u), 4, t * 5);
      g.strokeStyle = GOLD; g.lineWidth = 9;
      g.beginPath(); g.arc(cx, cy, 160, -Math.PI / 2, -Math.PI / 2 + u * TAU); g.stroke();
      g.fillStyle = INK; G.text(g, Math.round(u * 100) + '%', cx, cy + 260, 46);
    }
  } });

/* 8 — 110.9..131.22 s: the paper starts to drain */
S.push({ id: 'left', from: 110.9, to: 131.22,
  frame: (k, t) => t < 117.27 ? { z: 1.02, x: DW * 0.55, y: DH * 0.52 }
    : t < 124.89 ? { z: 1.7, x: DW * 0.5, y: DH * 0.4 }
    : { z: 1.35, x: DW * 0.5, y: DH * 0.42 },
  draw(g, k, F, t, col) {
    const dark = t > 117.27;
    sheet(g, col, t, F, { grid: 0, board: false, hy: DH * 0.74, sun: false });
    if (!dark) {
      g.strokeStyle = INK; g.lineWidth = 3;
      G.box(g, 1080, 150, 300, 330); G.line(g, 1230, 150, 1230, 480); G.line(g, 1080, 315, 1380, 315);
      const gone = Math.floor(seg(t, 110.9, 116.5) * 5);
      g.lineWidth = 4;
      if (gone < 1) { G.line(g, DW * 0.24, GY, DW * 0.24, GY - 210); G.line(g, DW * 0.24 - 46, GY - 190, DW * 0.24 + 46, GY - 190); }
      if (gone < 2) {
        G.line(g, DW * 0.62, GY, DW * 0.62, GY - 150); G.line(g, DW * 0.62, GY - 70, DW * 0.7, GY - 70);
        G.line(g, DW * 0.7, GY - 70, DW * 0.7, GY); G.line(g, DW * 0.62, GY - 150, DW * 0.7, GY - 150);
      }
      g.fillStyle = INK;
      if (gone < 3) G.figure(g, DW * 0.655, GY - 46, 0.95, 'sit', t, null, 0);
      if (gone < 4) G.figure(g, DW * 0.44, GY, 1.25, 'empty', t, col.hot, F[8] * 0.3);
      const dw = 250 * (1 - oback(seg(t, 112.22, 116.4)));
      g.lineWidth = 4;
      G.poly(g, [[DW * 0.84 - 125, GY], [DW * 0.84 - 125, GY - 340], [DW * 0.84 - 125 + 250 - dw, GY - 340], [DW * 0.84 - 125 + 250 - dw, GY]]);
      /* and he goes: a second silhouette crossing the threshold, shrinking out of the world */
      const out = seg(t, 112.22, 116.0);
      if (out > 0 && out < 1) {
        g.fillStyle = INK; g.strokeStyle = INK;
        G.figure(g, lerp(DW * 0.56, DW * 0.83, oback(out)), GY, 1.2 * (1 - out * 0.78), 'stand', t, null, 0);
      }
    } else if (t < 124.89) {
      const u = oback(seg(t, 117.27, 118.6));
      const nx = DW * 0.5, ny = DH * 0.4;
      g.strokeStyle = INK; g.lineWidth = 4;
      g.save(); g.translate(nx, ny); g.scale(u, u); G.box(g, -190, -130, 380, 260); g.restore();
      g.fillStyle = INK; G.disc(g, nx, ny, 12 + F[8] * 10);
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * TAU + 0.4;
        g.strokeStyle = INK; g.lineWidth = 2.6; g.globalAlpha = 0.6;
        G.line(g, nx + Math.cos(a) * 190, ny + Math.sin(a) * 130, nx + Math.cos(a) * 330, ny + Math.sin(a) * 230);
        g.strokeStyle = RED; g.globalAlpha = u; g.lineWidth = 6;
        G.line(g, nx + Math.cos(a) * 258 - 11, ny + Math.sin(a) * 176 - 11, nx + Math.cos(a) * 258 + 11, ny + Math.sin(a) * 176 + 11);
      }
      g.globalAlpha = 1;
      if (t > 118.97) {
        const fr = seg(t, 118.97, 124.5);
        g.fillStyle = INK;
        for (let i = 0; i < 30; i++) {
          const x = ((i * 137) % 1400) + 100, y = 150 + ((i * 91) % 580);
          g.globalAlpha = Math.max(0, 1 - fr * 1.4);
          G.fill(g, [[x + fr * 640, y], [x + fr * 640 + 20, y + 9], [x + fr * 640 + 7, y + 24]]);
        }
        g.globalAlpha = 1;
      }
    } else {
      /* DISHEARTENED — 无心: the heart with its heart taken out, on its own line */
      const u = oback(seg(t, 124.89, 126.4));
      g.save(); g.translate(DW * 0.5, DH * 0.42); g.scale(u, u);
      g.strokeStyle = INK; g.lineWidth = 5; g.fillStyle = 'rgba(232,68,106,0.16)';
      G.heart(g, 0, 0, 190, true); g.lineWidth = 5; G.heart(g, 0, 0, 190, false);
      g.fillStyle = col.bg1; g.beginPath(); g.moveTo(0, 0);
      g.arc(0, 0, 196, -Math.PI / 2 - 0.4, -Math.PI / 2 + 0.4); g.closePath(); g.fill();
      g.strokeStyle = RED; g.lineWidth = 4;
      G.line(g, 0, 0, 0, -196); G.line(g, 0, 0, Math.sin(0.4) * 196, -Math.cos(0.4) * 196);
      g.restore();
      if (t > 125.7) {                                   /* challenging your god */
        g.globalAlpha = seg(t, 125.7, 127.2);
        g.strokeStyle = INK; g.lineWidth = 5;
        G.line(g, DW * 0.5 - 360, DH * 0.44, DW * 0.5 - 250, DH * 0.44);
        G.ray(g, DW * 0.5 - 305, DH * 0.44, 0, -1, 150);
        G.arrowHead(g, DW * 0.5 - 305, DH * 0.44 - 150, 26, 0, -1);
        g.globalAlpha = 1;
      }
    }
  } });

/* 9 — 131.22..147.66 s: nothing scheduled */
S.push({ id: 'void', from: 131.22, to: 147.66,
  frame: (k) => ({ z: 0.92 - k * 0.08, x: DW * 0.56, y: DH * 0.56 }),
  draw(g, k, F, t, col) {
    sheet(g, col, t, F, { grid: 0, board: false, hy: DH * 0.7, sun: false });
    if (t < 134.8) {
      /* ILLEGAL ARGUMENTS lands where the line is, not six seconds early */
      const u = oback(seg(t, 131.22, 132.5));
      g.save(); g.translate(DW * 0.5, DH * 0.34); g.scale(u, u); g.rotate(-0.02);
      g.fillStyle = 'rgba(232,68,106,0.10)'; g.fillRect(-440, -124, 880, 248);
      g.strokeStyle = RED; g.lineWidth = 5; G.box(g, -440, -124, 880, 248);
      g.fillStyle = RED; G.text(g, 'IllegalArgumentError: challenging your god', 0, -66, 34);
      g.fillStyle = INK;
      G.text(g, '    at world.execute(me.js:11)', 0, -6, 30);
      G.text(g, '    at you.leave(me.js:14)', 0, 40, 30);
      G.text(g, '    at me.love(me.js:7)', 0, 86, 30);
      g.restore();
    }
    snow(g, t, F, 40, col);
    g.fillStyle = INK; g.strokeStyle = INK;
    G.figure(g, DW * 0.56, GY, 1.05, 'kneel', t, null, F[8] * 0.2);
    g.fillStyle = INK;
    if (Math.floor(t * 2) % 2 === 0) g.fillRect(DW * 0.56 + 220, GY - 26, 26, 8);
  } });

/* 10a — 147.66..155.20 s: the chant. Hard framing cuts every two repetitions. */
S.push({ id: 'chant', from: 147.66, to: 155.20,
  frame: (k, t) => Math.floor((t - 147.66) / 1.88) % 2 ? { z: 1.22, x: DW * 0.5, y: DH * 0.36 } : { z: 1.0, x: DW * 0.5, y: DH * 0.5 },
  draw(g, k, F, t, col) {
    sheet(g, col, t, F, { grid: 0, board: false, hy: DH * 0.72, sun: false, dark: true });
    const hit = Math.min(7, Math.floor((t - 147.66) / 0.94));
    code(g, 10 + hit, 240, 150, 62);
    g.fillStyle = INK; g.strokeStyle = col.rim;
    G.figure(g, DW * 0.5, GY, 1.2, t > 150.5 ? 'kneel' : 'stand', t, RED, F[8] * 0.5);
  } });

/* 10b — 155.20..158.90 s: the same word becomes 死刑. Closer, still cutting. */
S.push({ id: 'sentence', from: 155.20, to: 158.90,
  frame: (k, t) => [{ z: 1.22, x: DW * 0.5, y: DH * 0.34 }, { z: 1.1, x: DW * 0.5, y: DH * 0.52 },
                    { z: 1.22, x: DW * 0.5, y: DH * 0.44 }, { z: 1.0, x: DW * 0.5, y: DH * 0.58 }][Math.floor((t - 155.2) / 0.94) % 4],
  draw(g, k, F, t, col) {
    sheet(g, col, t, F, { grid: 0, board: false, hy: DH * 0.74, sun: false, dark: true });
    const hit = Math.min(3, Math.floor((t - 155.2) / 0.94));
    code(g, 15 + hit, 240, 150 - 9 * 62, 62);       /* the last four statements */
    g.fillStyle = INK; g.strokeStyle = col.rim;
    G.figure(g, DW * 0.5, GY, 1.25, 'kneel', t, RED, F[8] * 0.4);
  } });

/* 10c — 158.90..161.58 s: counting to six in six languages, one frame per numeral */
S.push({ id: 'count', from: 158.90, to: 161.58,
  frame: (k, t) => { const i = Math.min(5, Math.floor((t - 158.9) / 0.44)); return { z: 1.45 + (i % 3) * 0.3, x: DW * (0.34 + (i % 3) * 0.16), y: DH * (0.32 + (i % 2) * 0.22) }; },
  draw(g, k, F, t, col) {
    sheet(g, col, t, F, { grid: 0, board: false, horizon: false, dark: true });
    const names = ['EIN', 'DOS', 'TROIS', 'NE', 'FEM', 'LIU'];
    const i = Math.min(5, Math.floor((t - 158.9) / 0.44));
    const u = oback(seg(t, 158.9 + i * 0.44, 159.06 + i * 0.44));
    g.fillStyle = GOLD; g.save(); g.translate(DW * 0.5, DH * 0.42); g.scale(u, u);
    G.text(g, names[i], 0, 0, 190, 'center', 700); g.restore();
    g.strokeStyle = RED; g.lineWidth = 5;
    for (let j = 0; j <= i; j++) G.line(g, DW * 0.5 - 300 + j * 104, DH * 0.62, DW * 0.5 - 240 + j * 104, DH * 0.62);
    g.fillStyle = INK; g.strokeStyle = col.rim;
    G.figure(g, DW * 0.5, GY, 1.1, 'kneel', t, RED, 0);
  } });

/* 10d — 161.58..169.82 s: give them all the execution. The cage comes down. */
S.push({ id: 'give', from: 161.58, to: 169.82,
  frame: (k) => ({ z: 1.02 + k * 0.2, x: DW * 0.5, y: DH * (0.52 - k * 0.06) }),
  draw(g, k, F, t, col) {
    sheet(g, col, t, F, { grid: 0, board: false, hy: DH * 0.7, sun: false, dark: true });
    code(g, 18, 240, 150 - 6 * 62, 62);             /* the whole program has run */
    const u = oback(seg(t, 161.58, 164.6));
    g.strokeStyle = RED; g.lineWidth = 8;
    G.cage(g, DW * 0.5, DH * (0.02 + u * 0.12), GY + 6, DW * 0.66, 8);
    g.fillStyle = INK; g.strokeStyle = col.rim;
    G.figure(g, DW * 0.5, GY, 1.2, t > 167.02 ? 'stand' : 'kneel', t, RED, F[8] * 0.3);
    if (t > 168.91) { g.strokeStyle = RED; g.fillStyle = RED; G.blade(g, DW * 0.72, GY, 1.5, -0.12); }
  } });

/* 10e — 169.82..177.24 s: if I can have you back. The red drains out of the sky. */
S.push({ id: 'back', from: 169.82, to: 177.24,
  frame: (k) => ({ z: 1.45 - k * 0.5, x: DW * (0.5 + 0.07 * Math.sin(k * 4)), y: DH * (0.44 + k * 0.1) }),
  draw(g, k, F, t, col) {
    sheet(g, col, t, F, { grid: 0, board: false, hy: DH * 0.66, sun: true, dark: true });
    /* unwinding, line by line — Orpheus looking back, and losing her again */
    code(g, undefined, 240, 150 - 6 * 62, 62, Math.round(18 - k * 9));
    snow(g, t, F, 60, col);
    g.fillStyle = INK; g.strokeStyle = col.rim;
    G.figure(g, DW * 0.5, GY, 1.25, t > 173.6 ? 'reach' : 'stand', t, col.hot, F[8]);
    g.strokeStyle = 'rgba(232,68,106,0.6)'; g.lineWidth = 3;
    G.circle(g, DW * 0.5, GY - 150, 210 + F[8] * 40);
  } });

/* 11a — 177.24..184.54 s: she has studied. Three framings, written as she sings. */
S.push({ id: 'study', from: 177.24, to: 184.54,
  frame: (k, t) => t < 179.92 ? { z: 1.7, x: DW * 0.28, y: DH * 0.32 }
    : t < 180.85 ? { z: 1.55, x: DW * 0.52, y: DH * 0.3 } : { z: 1.15, x: DW * 0.5, y: DH * 0.4 },
  draw(g, k, F, t, col) {
    sheet(g, col, t, F, { grid: 1, board: false, hy: DH * 0.8 });    /* she writes on the world itself */
    g.lineWidth = 4; g.strokeStyle = INK; g.fillStyle = INK;
    const u = seg(t, 177.9, 180.6);
    G.sine(g, 180, DH * 0.32, 420, 72, 2, t * 1.6, 0, u);
    if (t > 180.85) {
      const v = oback(seg(t, 180.85, 183.4));
      g.globalAlpha = v;
      G.text(g, 'love(x) =', 660, DH * 0.32, 48, 'left', 600);
      g.strokeStyle = MINT; g.lineWidth = 4; G.line(g, 950, DH * 0.32 - 30, 950 + 110 * v, DH * 0.32 - 30);
      g.fillStyle = MINT; if (v > 0.5) G.text(g, 'x→∞', 1005, DH * 0.32 + 32, 28);
      g.globalAlpha = 1;
    }
    if (t > 183.6) {
      g.globalAlpha = oback(seg(t, 183.6, 184.3)); g.fillStyle = GOLD;
      G.text(g, 'Q?', 260, 220, 48); G.text(g, 'A!', DW - 260, 220, 48);
      g.globalAlpha = 1;
    }
    g.fillStyle = INK; g.strokeStyle = INK;
    G.figure(g, DW * 0.5, GY, 1.05, 'stand', t, RED, F[8]);
  } });

/* 11b — 184.54..193 s: the answer. The cage was the outline of the heart. */
S.push({ id: 'free', from: 184.54, to: 193,
  frame: (k) => ({ z: 1.3 - k * 0.32, x: DW * 0.5, y: DH * (0.4 + k * 0.08) }),
  draw(g, k, F, t, col) {
    sheet(g, col, t, F, { grid: 1, board: false, hy: DH * 0.8 });    /* she writes on the world itself */
    confetti(g, t, F, 40, col);
    g.lineWidth = 4; g.strokeStyle = INK; g.fillStyle = INK;
    G.sine(g, 180, DH * 0.3, 420, 72, 2, t * 1.6);
    G.text(g, 'love(x) =', 660, DH * 0.3, 48, 'left', 600);
    g.strokeStyle = MINT; g.lineWidth = 4; G.line(g, 950, DH * 0.3 - 30, 1060, DH * 0.3 - 30);
    g.fillStyle = MINT; G.text(g, 'x→∞', 1005, DH * 0.3 + 32, 28);
    g.strokeStyle = RED; g.fillStyle = 'rgba(232,68,106,0.22)'; g.lineWidth = 6;
    G.heart(g, 1200, DH * 0.3, 60, true);
    const v = seg(t, 188.48, 192.6);
    if (v < 0.85) { g.strokeStyle = INK; g.lineWidth = 4; G.cage(g, DW * 0.5, DH * 0.42 + v * 240, DH * 0.8, DW * 0.6, 8); }
    const u = oback(v);
    g.strokeStyle = RED; g.lineWidth = 6; g.globalAlpha = clamp(v);
    g.save(); g.translate(DW * 0.5, DH * 0.62); g.scale(u, u); G.heart(g, 0, 0, 210, false); g.restore();
    g.globalAlpha = 1;
    g.fillStyle = INK; g.strokeStyle = INK;
    G.figure(g, DW * 0.5, GY, 1.1, 'reach', t, RED, F[8]);
    g.fillStyle = GOLD; G.text(g, 'Q?', 260, 210, 48); G.text(g, 'A!', DW - 260, 210, 48);
  } });

/* 12 — 193..205.81 s: power down, the light going out of the page */
S.push({ id: 'powerdown', from: 193, to: 205.81,
  frame: (k) => ({ z: 1.02 + k * 0.24, x: DW * 0.5, y: DH * (0.5 + k * 0.08) }),
  draw(g, k, F, t, col) {
    sheet(g, col, t, F, { grid: 0, board: false, hy: DH * (0.66 + k * 0.1), sun: k < 0.7 });
    g.strokeStyle = INK; g.lineWidth = 3;
    G.box(g, 1080, 150, 300, 330); g.globalAlpha = 1 - k; g.fillStyle = col.hot;
    g.fillRect(1082, 152, 296, 326); g.globalAlpha = 1;
    g.fillStyle = INK; g.strokeStyle = INK;
    G.figure(g, DW * 0.5, GY, 1.15 * (1 - k * 0.2), 'stand', t, col.hot, (1 - k) * F[8]);
    if (k > 0.6) { g.fillStyle = INK; g.globalAlpha = seg(t, 203, 205); G.disc(g, DW * 0.5, DH * 0.44, 5); g.globalAlpha = 1; }
  } });

/* 13 — 205.81..end s: the last line, then the prompt */
S.push({ id: 'final', from: 205.81, to: 211.91,
  frame: () => ({ z: 1, x: DW * 0.5, y: DH * 0.5 }),
  draw(g, k, F, t, col) {
    g.fillStyle = RED;
    const w = 960 * oback(seg(t, 205.81, 206.6));
    g.fillRect(DW / 2 - w / 2, DH * 0.45, w, 26);
    if (t > 207.4) {
      g.globalAlpha = seg(t, 207.4, 208.6); g.fillStyle = col.rim;
      G.text(g, 'PROCESS ENDED', DW / 2, DH * 0.56, 32);
      if (Math.floor(t * 2) % 2 === 0) g.fillRect(DW / 2 - 9, DH * 0.6, 18, 6);
      g.globalAlpha = 1;
    }
  } });

window.SCENES = S;
})();
