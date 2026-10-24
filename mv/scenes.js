/* mv/scenes.js — the storyboard.
 *
 * The room is dark and the page is the only light in it. That is the whole art direction,
 * and it is a constraint rather than a style: canvas draws light, falloff and silhouette
 * well and draws cartoon objects badly, so nothing is a coloured prop floating in the air
 * any more. Everything the lyric describes is drawn in ink *on the sheet*, and the sheet is
 * clipped — a diagram cannot escape onto the wall, which is also why this version cannot
 * occlude the way the flat-pop one did.
 *
 * What carries the emotion instead of hue:
 *   how big the page is, how bright, how warm its light, how far the node stands from
 *   it, and how much of the room the light fails to reach. The chorus over-exposes; the
 *   collapse browns and dims; the EXECUTION turns the room the colour of the verdict; the
 *   outro is the light leaving.
 *
 * Thirteen-plus scenes share one 1600x900 design space and each carries its own camera move
 * (frame(k,t) -> zoom + pan). Sub-phase thresholds come from the lyric timestamps, so what
 * is drawn changes when the line changes.
 */
(() => {
'use strict';
const DW = 1600, DH = 900, GY = DH * 0.84;
window.SCENE_SPACE = { DW, DH, GY };

const TAU = Math.PI * 2;
const clamp = (v) => v < 0 ? 0 : v > 1 ? 1 : v;
const seg = (k, a, b) => clamp((k - a) / (b - a));
const lerp = (a, b, t) => a + (b - a) * t;
const oback = (u) => { const c1 = 1.9, c3 = c1 + 1; u = clamp(u); return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); };
/* Nothing wobbles on its own. Motion is the camera's, the light's, or a prop doing what the
   lyric says. The only shake is the chant's, and mv.js gates it on measured onsets. */

const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
const tint = (a, b, t) => {
  const A = hex(a), B = hex(b);
  return '#' + A.map((v, i) => Math.round(lerp(v, B[i], clamp(t))).toString(16).padStart(2, '0')).join('');
};
const rgba = (s, a) => { const c = hex(s); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };
/* the current stroke colour, with its alpha scaled — so a helper can re-stroke in the caller's ink */
function fade(st, k) {
  if (typeof st !== 'string') return st;
  if (st.charAt(0) === '#') return rgba(st, k);
  const m = st.match(/[\d.]+/g);
  if (!m || m.length < 3) return st;
  return `rgba(${m[0]},${m[1]},${m[2]},${(m.length > 3 ? +m[3] : 1) * k})`;
}
/* Ink, not vector. A single uniform stroke reads as a shape on a screen; the same path laid down
   twice - once wide and faint, as the bleed a nib leaves around its own line - reads as something
   somebody wrote on paper, which is what the sheet is supposed to be. Every stroked primitive goes
   through here so the whole film's hand changes at once. */
function inkStroke(g) {
  const lw = g.lineWidth, st = g.strokeStyle;
  if (lw > 0.7) { g.lineWidth = lw * 2.5; g.strokeStyle = fade(st, 0.15); g.stroke(); }
  g.lineWidth = lw; g.strokeStyle = st; g.stroke();
}

/* the page's ink, retargeted per act by room() so the film darkens continuously */
let INK = '#1d2833', ACC = '#b3263a', SIL = '#04070a', RIM = '#cfe0f0', PAGE = '#eef2f6';

const G = {
  line(g, x1, y1, x2, y2) { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); inkStroke(g); },
  ray(g, x, y, dx, dy, len) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + dx * len, y + dy * len); inkStroke(g); },
  poly(g, pts, close) {
    g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    if (close !== false) g.closePath();
    inkStroke(g);
  },
  fill(g, pts, close) { G.poly(g, pts, close === undefined ? true : close); g.fill(); },
  circle(g, x, y, r) { g.beginPath(); g.arc(x, y, Math.max(0.1, r), 0, TAU); inkStroke(g); },
  disc(g, x, y, r) { g.beginPath(); g.arc(x, y, Math.max(0.1, r), 0, TAU); g.fill(); },
  box(g, x, y, w, h) { g.beginPath(); g.rect(x, y, w, h); inkStroke(g); },
  text(g, s, x, y, size, align, weight) {
    g.font = `${weight || 400} ${size}px ui-monospace,Consolas,"Noto Sans Mono",monospace`;
    g.textAlign = align || 'center'; g.textBaseline = 'middle'; g.fillText(s, x, y);
  },
  arrowHead(g, x, y, s, ux, uy) {
    const px = -uy, py = ux;
    G.fill(g, [[x + ux * s, y + uy * s], [x + px * s * 0.55 - ux * s * 0.2, y + py * s * 0.55 - uy * s * 0.2],
    [x - px * s * 0.55 - ux * s * 0.2, y - py * s * 0.55 - uy * s * 0.2]]);
  },
  sine(g, x0, y, w, amp, cycles, phase, from, to) {
    from = from || 0; to = to === undefined ? 1 : to;
    g.beginPath();
    for (let i = 0; i <= 90; i++) {
      const u = from + (to - from) * (i / 90);
      const px = x0 + u * w, py = y + Math.sin(u * cycles * TAU + phase) * amp;
      i ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    inkStroke(g);
  },
  /* "if I approach infinity then you can be my LIMITATIONS": a curve running toward a bound it
     never meets. Verse one draws it as the offer, the last chorus draws it as the answer, so
     the two shots share one call and the film visibly quotes itself. */
  approach(g, x0, y0, w, rise, u) {
    g.beginPath();
    for (let i = 0; i <= 80; i++) {
      const x = x0 + (i / 80) * w * Math.min(1, u * 1.3);
      const y = y0 - rise / (1 + Math.pow((x - x0) / (w * 0.18), 2));
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    inkStroke(g);
  },
  heart(g, x, y, r, fill) {    g.beginPath(); g.moveTo(x, y + r * 0.85);
    g.bezierCurveTo(x - r * 1.35, y - r * 0.25, x - r * 0.5, y - r * 1.15, x, y - r * 0.35);
    g.bezierCurveTo(x + r * 0.5, y - r * 1.15, x + r * 1.35, y - r * 0.25, x, y + r * 0.85);
    g.closePath(); if (fill) g.fill(); inkStroke(g);
  },
  /* The subject of a shot. It is not a person: the lyric is spoken by an instance — something
     that was created, filled in with parameters, given a world, and executed by it — so the
     subject is drawn as a node in a network. What happens to it is stated as light: it either
     receives the page's light or it does not. 'reach' has a dashed arm toward something it
     cannot join, 'kneel'/'sit' sink it toward the floor, 'empty' leaves only the socket,
     'dead' strikes it through. */
  subject(g, x, y, s, pose, rimSide, bounce) {
    /* The camera is now zoomed past the edges of the design space, so anything parked at the
       right margin falls out of view. The subject is held inside the window; 'empty' is left
       where it is on purpose — the other one is out of frame, which is the whole point. */
    if (pose !== 'empty') x = Math.min(x, DW * 0.755);
    const r = 27 * s, side = x > DW * 0.5 ? -1 : 1;
    let cy = y - r - (bounce || 0) * 6, lit = rimSide === 0 ? 0.18 : 0.85;
    if (pose === 'kneel' || pose === 'sit') { cy = y - r * 0.62; lit *= 0.55; }
    if (pose === 'empty') {
      g.strokeStyle = rgba(INK, 0.3); g.lineWidth = 2; g.setLineDash([6, 8]);
      G.circle(g, x, y - r, r); g.setLineDash([]);
      return;
    }
    G.node(g, x, cy, r, lit, { rim: RIM, page: PAGE });
    if (pose === 'dead') {
      g.strokeStyle = rgba(ACC, 0.85); g.lineWidth = 4;
      G.line(g, x - r * 0.8, cy - r * 0.8, x + r * 0.8, cy + r * 0.8);
      G.line(g, x + r * 0.8, cy - r * 0.8, x - r * 0.8, cy + r * 0.8);
    }
    if (pose === 'reach') {
      g.strokeStyle = rgba(ACC, 0.55); g.lineWidth = 2.4; g.setLineDash([7, 9]);
      G.line(g, x + side * r, cy, x + side * (r + 130), cy - 30);
      g.setLineDash([]);
    }
  },
  /* the three forms the instance can be re-typed as, drawn as ink plates */
  specimen(g, kind, x, y, s) {
    g.save(); g.translate(x, y); g.scale(s, s);
    g.lineWidth = 3; g.strokeStyle = INK;
    if (kind === 'eggplant') {
      g.beginPath(); g.moveTo(2, -84);
      g.bezierCurveTo(34, -76, 36, -26, 12, -4); g.bezierCurveTo(-6, 12, -30, 2, -28, -34);
      g.bezierCurveTo(-27, -64, -16, -82, 2, -84); g.closePath();
      g.fillStyle = rgba(ACC, 0.16); g.fill(); g.stroke();
      G.poly(g, [[-12, -84], [2, -104], [16, -86], [2, -78]]);
    } else if (kind === 'tomato') {
      g.beginPath(); g.ellipse(0, -32, 34, 30, 0, 0, TAU);
      g.fillStyle = rgba(ACC, 0.2); g.fill(); g.stroke();
      G.poly(g, [[-16, -58], [0, -74], [16, -58], [0, -64]]);
    } else {
      G.fill(g, [[-46, 0], [46, 0], [42, -26], [-42, -26]]);
      G.disc(g, 44, -38, 22);
      G.fill(g, [[33, -52], [40, -72], [47, -54]]); G.fill(g, [[52, -54], [59, -72], [64, -52]]);
      G.poly(g, [[-46, -16], [-74, -32], [-66, -12]], false);
      g.lineWidth = 2; G.line(g, 62, -38, 90, -44); G.line(g, 62, -33, 90, -29);
    }
    g.restore();
  },
  chess(g, x, y, s, kind) {
    g.save(); g.translate(x, y); g.scale(s, s);
    if (kind === 'pawn') { G.fill(g, [[-15, 0], [15, 0], [9, -13], [-9, -13]]); G.disc(g, 0, -24, 10); }
    else { G.fill(g, [[-17, 0], [17, 0], [11, -30], [-11, -30]]); G.fill(g, [[-13, -30], [13, -30], [9, -40], [-9, -40]]); }
    g.restore();
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
  /* a node. The film's subject is not a person — it is a program in a network — so the
     things that leave, kneel, are sentenced and are missed are nodes, and what happens to
     them is whether they still receive light. */
  node(g, x, y, r, lit, col) {
    /* a body, not a disc: the same key light that lifts the rim has to fall across the face of
       it, or the node reads as a sticker on the room rather than something standing in it */
    const body = g.createRadialGradient(x - r * 0.38, y - r * 0.44, r * 0.06, x, y, r * 1.06);
    body.addColorStop(0, tint(SIL, col.page, 0.1 + lit * 0.42));
    body.addColorStop(0.55, SIL);
    body.addColorStop(1, '#000000');
    g.fillStyle = body; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    if (lit > 0) {
      g.strokeStyle = rgba(col.rim, 0.25 + lit * 0.6); g.lineWidth = Math.max(1.4, r * 0.14);
      g.beginPath(); g.arc(x, y, r, Math.PI * 1.18, Math.PI * 1.86); g.stroke();
      g.fillStyle = rgba(col.page, lit * 0.5);
      g.beginPath(); g.arc(x - r * 0.3, y - r * 0.34, r * 0.2, 0, TAU); g.fill();
    }
  },
  /* a star topology: one hub, n arms, and the arms cut one at a time on the words */
  star(g, cx, cy, R, n, cut, born, col, t) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + i * TAU / n;
      const px = cx + Math.cos(a) * R, py = cy + Math.sin(a) * R * 0.72;
      const live = i >= cut;
      g.strokeStyle = rgba(INK, live ? 0.7 : 0.16); g.lineWidth = live ? 2.6 : 1.4;
      g.setLineDash(live ? [] : [6, 8]);
      G.line(g, cx, cy, px, py);
      g.setLineDash([]);
      if (!live) {                                            /* the cut, signed in red */
        const mx = (cx + px) / 2, my = (cy + py) / 2, k = oback(clamp((t - (born + i * 1.08)) * 4));
        g.strokeStyle = rgba(ACC, 0.35 + k * 0.6); g.lineWidth = 4;
        G.line(g, mx - 11 * k, my - 11 * k, mx + 11 * k, my + 11 * k);
      }
      G.node(g, px, py, 17 * (live ? 1 : 0.72), live ? 0.9 : 0.1, col);
    }
    G.node(g, cx, cy, 30 + (1 - cut / n) * 5, 1, col);
    g.strokeStyle = rgba(ACC, 0.5); g.lineWidth = 2;
    G.circle(g, cx, cy, 46 + Math.sin(t * 2.2) * 3);
  },
  cage(g, x, yTop, yBot, w, n) {
    for (let i = 0; i <= n; i++) { const px = x - w / 2 + (i / n) * w; G.line(g, px, yTop, px, yBot); }
  },
  /* 朱批 — the judge's red brush. The sentence is signed one stroke per verdict. */
  brush(g, x, y, w, h) {
    g.beginPath(); g.moveTo(x - w / 2, y);
    g.quadraticCurveTo(x - w * 0.15, y - h * 1.5, x + w * 0.35, y - h * 0.9);
    g.quadraticCurveTo(x + w / 2, y - h * 0.4, x + w / 2, y + h * 0.2);
    g.quadraticCurveTo(x + w * 0.1, y + h * 1.3, x - w * 0.34, y + h * 0.7);
    g.closePath(); g.fill();
  },
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
  blade(g, x, y, s, tilt) {
    g.save(); g.translate(x, y); g.scale(s, s); g.rotate(tilt || 0);
    G.fill(g, [[-15, 0], [15, 0], [11, -26], [-11, -26]]);
    g.beginPath(); g.moveTo(-13, -26);
    g.quadraticCurveTo(6, -120, 40, -158); g.quadraticCurveTo(20, -104, 13, -26);
    g.closePath(); g.stroke(); g.restore();
  },
};
window.SCENE_G = G;

/* ---------------- the room, the page, the light ---------------- */
/* room() paints what the light fails to reach; page() paints the lamp itself.
   L is the page rect in design space. Everything a scene draws after page() is clipped to
   it, so a diagram physically cannot spill into the room. */
/* Until 110.9 s there are two lights in this room, and the other one is not hers. The song is a
   dialogue with a second person who configures her, is handed everything she is, and then closes
   the program — so the film needs a presence that can be absent. It is deliberately not a body:
   a shaft at the end of the hall, a self-lit sphere for the one who is looked at, and a chalk ring
   on the floor. When "you have left" is sung six times the shaft and the sphere go out across
   exactly those six lines, and the ring is all that is left of him for the remaining ninety
   seconds — including the shot where she says she is the one still trapped. */
function companion(g, col, F, t, L) {
  const x = DW * 0.215, foot = GY - 18, head = DH * 0.165;
  const born = clamp((t - 6.38) / 1.6);
  const gone = clamp((t - 112.22) / 3.56);          /* 112.22 → 115.78: the six "you have left" */
  const live = born * (1 - gone);
  /* the ring stays lit by nothing; it is only where he stood, and it is the one thing of his she
     cannot delete */
  g.strokeStyle = rgba(col.rim, 0.1 + live * 0.2 + gone * 0.16);
  g.lineWidth = 1.6;
  g.save(); g.translate(x, foot); g.scale(1, 0.26);
  g.beginPath(); g.arc(0, 0, 92, 0, TAU); g.stroke(); g.restore();
  /* The giving is an act, not an annotation: each thing she names leaves the sheet and lands where
     he is standing. By the end the ring he left behind is full of what she gave him, and nobody is
     there to hold it — which is the song's last argument, made without a word. The heart is the one
     entry that never arrives: it was deleted, not offered. */
  const ox = L.x + L.w * 0.04, oy = L.y + L.h * 0.52;
  let parked = 0;
  GIVEN.forEach((it, i) => {
    if (it.cut) return;
    const u = clamp((t - it.at - 0.6) / 2.4);
    if (u <= 0) return;
    const a = (parked / 8) * TAU; parked++;
    const px = u < 1 ? ox + (x - ox) * u : x + Math.cos(a) * 52;
    const py = u < 1 ? oy + (foot - oy) * u - Math.sin(u * Math.PI) * 96 : foot + Math.sin(a) * 13;
    g.save(); g.globalCompositeOperation = 'lighter';
    g.globalAlpha = (u < 1 ? 1 : clamp((t - it.at - 3.0) / 1.2) * 0.85) * (0.35 + gone * 0.45);
    const s = g.createRadialGradient(px - 2, py - 3, 0.5, px, py, 11);
    s.addColorStop(0, rgba(col.page, 0.95)); s.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = s; g.beginPath(); g.arc(px, py, 11, 0, TAU); g.fill();
    g.restore();
  });
  if (live <= 0.001) return;
  g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = live;
  /* a column of light has no edges to draw: filling a rect left a translucent bar leaning against
     the paper, which is the one thing light is never allowed to look like */
  const midY = (head + foot) / 2, halfH = (foot - head) / 2 + 90;
  g.save(); g.translate(x, midY); g.scale(0.3, 1);
  const shaft = g.createRadialGradient(0, 0, 0, 0, 0, halfH);
  shaft.addColorStop(0, rgba(col.page, 0.14 + F[8] * 0.06));
  shaft.addColorStop(0.5, rgba(col.rim, 0.09 + F[8] * 0.05));
  shaft.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = shaft; g.beginPath(); g.arc(0, 0, halfH, 0, TAU); g.fill();
  g.restore();
  const b = g.createRadialGradient(x - 8, head - 10, 1, x, head, 31);
  b.addColorStop(0, rgba(col.page, 0.98)); b.addColorStop(0.5, rgba(col.rim, 0.45));
  b.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = b; g.beginPath(); g.arc(x, head, 31, 0, TAU); g.fill();
  g.restore();
}

function room(g, col, F, t, L, o) {
  o = o || {};
  INK = col.ink; ACC = col.accent; RIM = col.rim; PAGE = col.page;
  TT = t;
  SIL = tint(col.room0, '#000000', 0.55);
  companion(g, col, F, t, L);
  const cx = L.x + L.w / 2, cy = L.y + L.h / 2;
  const reach = Math.max(L.w, L.h) * (o.reach || 1.5);
  const warm = col.glow;
  g.save(); g.globalCompositeOperation = 'lighter';
  const beam = g.createRadialGradient(cx, cy, Math.min(L.w, L.h) * 0.14, cx, cy, reach);
  const power = 0.17 + col.lum * 0.24 + F[8] * 0.09;
  beam.addColorStop(0, rgba(warm, power));
  beam.addColorStop(0.42, rgba(warm, power * 0.28));
  beam.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = beam; g.fillRect(0, 0, DW, DH);
  g.restore();
  /* the ground itself belongs to mv.js's hall, which is drawn in screen space so it can disagree
     with the sheet about how the camera moved. What stays here is the paper's **own** light on the
     floor, and the shadow under it — those travel with the sheet, which is what makes it an object
     standing in that room rather than a card in front of a backdrop. */
  const base = Math.min(DH - 6, L.y + L.h);
  g.save(); g.globalCompositeOperation = 'lighter';
  const pool = g.createRadialGradient(cx, base, 0, cx, base, L.w * 1.25);
  pool.addColorStop(0, rgba(warm, 0.4 + col.lum * 0.22));
  pool.addColorStop(0.45, rgba(warm, 0.13));
  pool.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = pool;
  g.save(); g.translate(cx, base); g.scale(1, 0.26); g.translate(-cx, -base);
  g.fillRect(cx - L.w * 1.25, base - L.w * 1.25, L.w * 2.5, L.w * 2.5); g.restore();
  g.restore();
  g.save();
  const sh = g.createRadialGradient(cx, base, 0, cx, base, L.w * 0.62);
  sh.addColorStop(0, 'rgba(0,0,0,0.5)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = sh;
  g.translate(cx, base); g.scale(1, 0.16); g.translate(-cx, -base);
  g.fillRect(cx - L.w * 0.62, base - L.w * 0.62, L.w * 1.24, L.w * 1.24);
  g.restore();
}

/* The song's actual spine, which the diagrams only describe: she is made by someone who fills in
   her parameters, and she answers by handing over whatever part of herself the metaphor is
   standing on — her dimension, her circumference, her tangents, her bound, her nourishment, her
   proof of existence — until the last one is not given but taken (DISHEARTENED, the heart
   deleted). The film had no memory of any of that: each scene drew its figure and the next scene
   started clean. The ledger is what makes the giving cumulative, so that by the chant the sheet is
   mostly the space where things used to be. */
const GIVEN = [
  { at: 32.68, w: 'DIMENSION' }, { at: 36.28, w: 'CIRCUMFERENCE' }, { at: 40.04, w: 'TANGENTS' },
  { at: 43.50, w: 'LIMITATIONS' }, { at: 76.95, w: 'NUTRIENTS' }, { at: 80.62, w: 'ANTIOXIDANTS' },
  { at: 84.26, w: 'ENJOYMENT' }, { at: 87.92, w: 'EXISTENCE' }, { at: 124.89, w: 'HEART', cut: true },
];
let TT = 0;
function givings(g, L) {
  /* What stays on the sheet is the hole, not the label: the word is legible while she sings it and
     collapses afterwards into an empty dashed box, so the accumulation reads as a column of gaps
     down the edge of the page rather than as a second diagram competing with the first. */
  const x = L.x + L.w * 0.945, sz = L.h * 0.03;
  g.save();
  g.font = `400 ${sz * 0.62}px ui-monospace,Consolas,monospace`;
  g.textBaseline = 'middle'; g.textAlign = 'right';
  GIVEN.forEach((it, i) => {
    const a = clamp((TT - it.at) / 0.6);
    if (a <= 0) return;
    const y = L.y + L.h * 0.1 + i * sz * 1.7;
    const word = a * (1 - clamp((TT - it.at - 1.2) / 2.2));
    g.globalAlpha = a * 0.42;
    g.strokeStyle = it.cut ? rgba(ACC, 0.95) : rgba(INK, 0.6);
    g.lineWidth = it.cut ? 1.6 : 1;
    if (it.cut) { g.strokeRect(x - sz, y - sz / 2, sz, sz);
      G.line(g, x - sz, y - sz / 2, x, y + sz / 2); G.line(g, x, y - sz / 2, x - sz, y + sz / 2); }
    else { g.setLineDash([3, 3]); g.strokeRect(x - sz, y - sz / 2, sz, sz); g.setLineDash([]); }
    if (word > 0.02) {
      g.globalAlpha = word * 0.75; g.fillStyle = it.cut ? rgba(ACC, 0.95) : rgba(INK, 0.8);
      g.fillText(it.w, x - sz * 1.5, y);
    }
  });
  g.restore();
}

function page(g, col, L, o) {
  o = o || {};
  const mcx = L.x + L.w / 2, mcy = L.y + L.h / 2;
  g.save();
  /* The sheet used to be an axis-aligned card pasted onto the frame, near-white and covering two
     thirds of it — no room survives that, and the 9-cell grid showed every shot as a lit slide on
     black. It is now a board standing in the hall: smaller, turned a few degrees, and lit only
     where it faces the lamp. The turn is derived from the sheet's own geometry rather than from
     the clock, so each shot is framed differently but nothing can jump between frames. The
     transform stays live until endPage, so the clip and the ink drawn through on() are sheared by
     exactly the same matrix. */
  const side = (mcx / DW) - 0.5;
  const seed = ((Math.round(L.x) * 7 + Math.round(L.y) * 13 + Math.round(L.w) * 5) % 97) / 97;
  const turn = side * 0.05 + (seed - 0.5) * 0.085 + (L.h / L.w - 0.55) * 0.04;
  const lean = -0.03 - side * 0.05 + (seed - 0.5) * 0.05;
  g.translate(mcx, mcy); g.transform(1, lean, 0, 1, 0, 0); g.rotate(turn);
  g.scale(0.76, 0.84); g.translate(-mcx, -mcy);
  /* the cast bloom: a blurred copy of the sheet lying behind it */
  g.save(); g.filter = `blur(${o.blur === undefined ? 26 : o.blur}px)`;
  g.fillStyle = rgba(col.page, 0.34 + col.lum * 0.2);
  g.fillRect(L.x - L.w * 0.09, L.y - L.h * 0.09, L.w * 1.18, L.h * 1.18);
  g.restore();
  const pg = g.createLinearGradient(L.x, L.y, L.x + L.w * 0.78, L.y + L.h);
  /* The sheet has to be an EMITTER, not a lit card. Every earlier pass over-corrected toward
     "don't blow it out" and ended with grey MDF in a dark room — which silently cancelled the one
     premise the whole film rests on. The near corner is allowed to clip; the ink then reads as
     silhouette against a light source rather than as drawing on a whiteboard. */
  pg.addColorStop(0, tint(col.page, '#ffffff', 0.66));
  pg.addColorStop(0.22, tint(col.page, '#ffffff', 0.3));
  pg.addColorStop(0.55, tint(col.page, col.glow, 0.24));
  pg.addColorStop(1, tint(col.page, col.room0, 0.52));
  g.fillStyle = pg; g.fillRect(L.x, L.y, L.w, L.h);
  g.save(); g.globalCompositeOperation = 'lighter';
  const hot = g.createRadialGradient(L.x + L.w * 0.2, L.y + L.h * 0.18, 0,
                                     L.x + L.w * 0.2, L.y + L.h * 0.18, L.w * 0.85);
  hot.addColorStop(0, rgba(col.page, 0.3 + col.lum * 0.18));
  hot.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = hot; g.fillRect(L.x, L.y, L.w, L.h);
  g.restore();
  /* the sheet is ruled. Since the board got smaller, shots whose diagram is two letters and a
     line showed the paper as a blank grey card; a faint rule says "this is a page" without
     adding anything that competes with the ink drawn on it */
  g.strokeStyle = rgba(INK, 0.075); g.lineWidth = 1;
  for (let y = L.y + L.h / 16; y < L.y + L.h; y += L.h / 16) G.line(g, L.x, y, L.x + L.w, y);
  g.strokeStyle = rgba(ACC, 0.16); g.lineWidth = 1;
  G.line(g, L.x + L.w * 0.055, L.y, L.x + L.w * 0.055, L.y + L.h);
  if (o.rule !== false) { g.fillStyle = rgba(ACC, 0.8); g.fillRect(L.x, L.y, 3, L.h); }
  g.save();
  g.beginPath(); g.rect(L.x, L.y, L.w, L.h); g.clip();
  if (o.ledger !== false) givings(g, L);
  return g;
}
/* draw in page-local coordinates: (0,0) is the sheet's top-left, 1x1 units are fractions of it */
function on(g, L, fn) {
  g.save(); g.translate(L.x, L.y);
  fn(g, L.w, L.h);
  g.restore();
}
function endPage(g) { g.restore(); g.restore(); }   /* the clip, then the board's own matrix */

/* dust in the beam — only where the light reaches */
function dust(g, L, F, n) {
  const cx = L.x + L.w / 2, cy = L.y + L.h / 2;
  for (let i = 0; i < n; i++) {
    const a = (i * 2.399963) % TAU, r = Math.sqrt((i * 0.6180339887) % 1) * Math.max(L.w, L.h) * 1.15;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.66;
    const near = 1 - Math.min(1, r / (Math.max(L.w, L.h) * 1.15));
    g.fillStyle = rgba(RIM, (0.05 + near * 0.34) * (0.35 + F[6] * 0.65) * ((i * 7919 % 100) / 100));
    g.beginPath(); g.arc(x, y, 0.7 + near * 1.8, 0, TAU); g.fill();
  }
}

const S = [];

/* ---------------- the program, as a warrant ---------------- */
const PROGRAM = [
  'class me extends world {',
  '    Heart heart;    // never initialised',
  '    Dimension dimension() { return points; }',
  '    double circumference() { return 2 * PI * r; }',
  '    double limit() { return infinity; }',
  '    Object offer() { return nutrients; }',
  '    boolean love() { return you != null; }',
  '}', '',
  '// runtime',
  'world.execute(me);',
  'me.run();',
  'while (you.isPresent()) { me.stay(); }',
  'you = null;    // though you have left',
  'me.isolate();',
  'throw new IllegalArgumentException();',
  'process.kill(me, SIGKILL);',
  'exit(0);',
  'return you;'
];
const RUNTIME = { from: 9, n: 10 };
const CRIM_DIM = 'rgba(120,96,92,.55)';
/* the warrant: crimson ink on the one bright sheet in a room that has gone red */
function code(g, L, active, strikeFrom) {
  const lh = L.h / RUNTIME.n, fs = Math.round(lh * 0.44);
  for (let i = 0; i < RUNTIME.n; i++) {
    const idx = RUNTIME.from + i, ln = PROGRAM[idx], yy = i * lh + lh / 2;
    const done = active === undefined || idx <= active;
    if (idx === active) { g.fillStyle = rgba(ACC, 0.16); g.fillRect(-10, yy - lh / 2, L.w + 20, lh); }
    g.fillStyle = idx === active ? ACC : (done ? tint(ACC, '#000000', 0.18) : CRIM_DIM);
    G.text(g, String(idx + 1).padStart(2, ' '), 26, yy, Math.round(fs * 0.8), 'right');
    G.text(g, ln, 40, yy, fs, 'left');
    const c = ln.indexOf('//');
    if (c > 0) {
      const wpx = g.measureText(ln.slice(0, c)).width;
      g.fillStyle = done ? rgba(INK, 0.55) : CRIM_DIM;
      G.text(g, ln.slice(c), 40 + wpx, yy, fs, 'left');
    }
    if (strikeFrom !== undefined && idx >= strikeFrom) {
      g.strokeStyle = ACC; g.lineWidth = 2.6;
      G.line(g, 36, yy, 44 + g.measureText(ln).width, yy);
    }
  }
}

/* 1 — 0..16 s: the lamp wakes, and the object is written down */
S.push({ id: 'boot', from: 0, to: 16,
  frame: (k) => k < 0.34 ? { z: 1.5, x: DW * 0.44, y: DH * 0.5 } : { z: 1.0, x: DW * 0.5, y: DH * 0.5 },
  draw(g, k, F, t, col) {
    const w = 620 * (t < 0.9 ? seg(t, 0.05, 0.9) : 1), h = 470 * (t < 1.5 ? seg(t, 0.6, 1.5) : 1);
    const L = { x: DW * 0.44 - w / 2, y: DH * 0.5 - h / 2, w: w, h: h };
    room(g, col, F, t, L);
    if (w < 20) return;
    page(g, col, L);
    on(g, L, (gg, W, H) => {
      gg.strokeStyle = INK; gg.fillStyle = INK; gg.lineWidth = 2.4;
      const bars = [[.10, .62], [.17, .34], [.25, .74], [.32, .48], [.40, .60], [.47, .26]];
      for (let i = 0; i < Math.min(6, Math.floor(seg(t, 1.6, 5.2) * 7)); i++) {
        gg.globalAlpha = oback(seg(t, 1.6 + i * 0.5, 2.1 + i * 0.5));
        gg.fillRect(W * 0.07, H * bars[i][0], W * bars[i][1] * 0.88, 6);
      }
      gg.globalAlpha = 1;
      if (t > 2.92) {                                        /* PROTECTION, as a drawn dome */
        const u = oback(seg(t, 2.92, 3.6));
        gg.save(); gg.translate(W * 0.7, H * 0.72); gg.scale(u, u);
        gg.beginPath(); gg.arc(0, 0, 58, Math.PI, 0); gg.stroke(); G.line(gg, -58, 0, 58, 0);
        gg.fillStyle = rgba(ACC, 0.12); gg.fillRect(-56, 0, 112, 34); gg.restore();
      }
      if (t > 3.87) {                                        /* lay down your pieces */
        const u = seg(t, 3.87, 6.2);
        gg.strokeStyle = INK; gg.lineWidth = 1.6; gg.globalAlpha = 0.4 + u * 0.4;
        for (let i = 0; i <= 5; i++) G.line(gg, W * 0.08 + i * W * 0.17, H * 0.94, W * 0.12 + i * W * 0.15, H * 0.78);
        gg.globalAlpha = 1;
        for (let i = 0; i < Math.min(5, Math.floor(u * 6.5)); i++) {
          const pop = oback(seg(t, 3.87 + i * 0.42, 4.3 + i * 0.42));
          gg.fillStyle = INK; gg.strokeStyle = INK;
          gg.save(); gg.translate(W * 0.1 + i * W * 0.17, H * 0.93); gg.scale(pop, pop * (2 - pop));
          G.chess(gg, 0, 0, 0.62, i % 2 ? 'pawn' : 'rook'); gg.restore();
        }
      }
      if (t > 6.38) {                                        /* OBJECT CREATION */
        const u = oback(seg(t, 6.38, 8.2));
        gg.strokeStyle = INK; gg.lineWidth = 2;
        gg.save(); gg.translate(W * 0.26, H * 0.6); gg.scale(u, u); G.cube(gg, 0, 0, 62, t * 0.5); gg.restore();
        const fields = ['name = "me"', 'body = { points }', 'heart = null', 'run = true'];
        for (let i = 0; i < Math.min(4, Math.floor(seg(t, 10.09, 12.6) * 4.4)); i++) {
          gg.globalAlpha = oback(seg(t, 10.09 + i * 0.5, 10.56 + i * 0.5));
          gg.fillStyle = i === 2 ? ACC : tint(ACC, '#000000', 0.2);   /* used before defined */
          G.text(gg, 'me.' + fields[i], W * 0.52, H * (0.46 + i * 0.09), 24, 'left');
        }
        gg.globalAlpha = 1;
      }
    });
    endPage(g);
    if (t > 4) G.subject(g, DW * 0.86, GY, 1.05, 'stand', -1, F[8] * 0.4);
    dust(g, L, F, 120);
  } });

/* 2 — 16..29.7 s: the world the instance is handed, small and round and sealed */
S.push({ id: 'globe', from: 16, to: 29.7,
  frame: (k) => ({ z: 1.04 + k * 0.5, x: DW * 0.5, y: DH * 0.46 }),
  draw(g, k, F, t, col) {
    const r = 250, L = { x: DW * 0.5 - r, y: DH * 0.46 - r, w: r * 2, h: r * 2 };
    room(g, col, F, t, L, { reach: 2.2 });
    g.save(); g.filter = 'blur(30px)'; g.fillStyle = rgba(col.page, 0.4);
    g.beginPath(); g.arc(DW * 0.5, DH * 0.46, r, 0, TAU); g.fill(); g.restore();
    g.save(); g.beginPath(); g.arc(DW * 0.5, DH * 0.46, r, 0, TAU); g.clip();
    /* the globe is a lit sphere, not a grey one: a flat fill inside a circular clip read as a
       disc of paper, and only a highlight with a terminator opposite it says "body, in a room" */
    const lit = g.createRadialGradient(DW * 0.5 - r * 0.42, DH * 0.46 - r * 0.5, r * 0.05,
                                       DW * 0.5, DH * 0.46, r * 1.15);
    lit.addColorStop(0, tint(col.page, '#ffffff', 0.24));
    lit.addColorStop(0.42, tint(col.page, col.room1, 0.22));
    lit.addColorStop(1, tint(col.room1, '#000000', 0.62));
    g.fillStyle = lit; g.fillRect(L.x, L.y, L.w, L.h);
    g.fillStyle = rgba(col.glow, 0.5); g.fillRect(L.x, DH * 0.46 + 60, L.w, 200);
    dust(g, L, F, 90);
    G.subject(g, DW * 0.5, DH * 0.46 + 150, 0.72, 'stand', 1, F[8] * 0.5);
    g.restore();
    g.strokeStyle = rgba(col.page, 0.55); g.lineWidth = 2.6; G.circle(g, DW * 0.5, DH * 0.46, r);
    g.strokeStyle = rgba(col.rim, 0.22); g.lineWidth = 1.4; G.circle(g, DW * 0.5, DH * 0.46, r + 22);
    g.fillStyle = rgba(INK, 0.72); G.text(g, 'world.execute (me) ;', DW * 0.5, DH * 0.46 - r * 0.52, 30, 'center', 300);
  } });

/* 3 — 29.7..44.45 s: the four offers, drawn on the page the instance is handed */
S.push({ id: 'geometry', from: 29.7, to: 44.45,
  frame: (k) => ({ z: 1.18, x: DW * 0.44, y: DH * 0.48 }),
  draw(g, k, F, t, col) {
    const L = { x: 330, y: 150, w: 700, h: 520 };
    room(g, col, F, t, L);
    page(g, col, L);
    on(g, L, (gg, W, H) => {
      gg.strokeStyle = INK; gg.fillStyle = INK; gg.lineWidth = 2.2;
      if (t < 33.41) {                                       /* an infinity of points */
        const cx = W * 0.42, cy = H * 0.52;
        G.ray(gg, cx, cy, 1, 0, W * 0.5); G.ray(gg, cx, cy, 0, -1, H * 0.4);
        G.arrowHead(gg, cx + W * 0.5, cy, 16, 1, 0); G.arrowHead(gg, cx, cy - H * 0.4, 16, 0, -1);
        G.text(gg, 'x', cx + W * 0.52, cy + 16, 22, 'left'); G.text(gg, 'y', cx + 14, cy - H * 0.42, 22, 'left');
        const u = seg(t, 29.7, 32.6);
        for (let i = 0; i < 34; i++) {
          if (i / 34 > u) break;
          const a = i * 2.399, rr = 16 + i * 4.2;
          gg.globalAlpha = 0.85;
          G.disc(gg, cx + Math.cos(a) * rr * 1.1, cy + Math.sin(a) * rr * 0.62, 3 + F[3] * 2.4);
        }
        gg.globalAlpha = 1;
      } else if (t < 37.06) {                                /* a circle, and its circumference */
        const u = oback(seg(t, 33.41, 35.6)), cx = W * 0.34, cy = H * 0.5;
        gg.lineWidth = 2.6; gg.strokeStyle = INK; G.circle(gg, cx, cy, 132);
        gg.strokeStyle = ACC; gg.lineWidth = 7;
        gg.beginPath(); gg.arc(cx, cy, 132, -Math.PI / 2, -Math.PI / 2 + u * TAU); gg.stroke();
        const a = -Math.PI / 2 + u * TAU;
        gg.strokeStyle = INK; gg.lineWidth = 2; G.line(gg, cx, cy, cx + Math.cos(a) * 132, cy + Math.sin(a) * 132);
        gg.fillStyle = INK; G.disc(gg, cx, cy, 4);
        gg.strokeStyle = ACC; gg.lineWidth = 4; G.line(gg, W * 0.62, H * 0.34, W * 0.62 + u * W * 0.3, H * 0.34);
        gg.fillStyle = INK; G.text(gg, 'C = 2πr', W * 0.62, H * 0.24, 28, 'left');
      } else if (t < 40.7) {                                 /* a sine wave, and its tangents */
        const u = seg(t, 37.06, 39.6), y = H * 0.5;
        gg.strokeStyle = INK; gg.lineWidth = 3;
        G.sine(gg, W * 0.06, y, W * 0.88, H * 0.26, 2, t * 1.6, 0, Math.min(1, u * 1.5));
        if (u > 0.35) {
          const a = oback(seg(u, 0.35, 1));
          gg.save(); gg.globalAlpha = clamp(a);            /* the dots used to pop in on one frame */
          gg.strokeStyle = tint(ACC, '#000000', 0.1); gg.lineWidth = 2;
          for (let i = 0; i < 5; i++) {
            const uu = 0.12 + i * 0.19, px = W * 0.06 + W * 0.88 * uu, ph = uu * 2 * TAU + t * 1.6;
            const py = y + Math.sin(ph) * H * 0.26, d = Math.cos(ph) * H * 0.26 * (2 * TAU / (W * 0.88)), Ln = 96 * a;
            G.line(gg, px - Ln, py - d * Ln, px + Ln, py + d * Ln);
            gg.fillStyle = ACC; G.disc(gg, px, py, 5);
          }
          gg.restore();
        }
      } else {                                               /* a limit that never arrives */
        const u = seg(t, 40.7, 43.6);
        gg.strokeStyle = INK; gg.lineWidth = 2.4; G.line(gg, W * 0.06, H * 0.78, W * 0.94, H * 0.78);
        gg.setLineDash([9, 9]); gg.strokeStyle = ACC; gg.lineWidth = 2.6;
        G.line(gg, W * 0.82, H * 0.1, W * 0.82, H * 0.78); gg.setLineDash([]);
        gg.strokeStyle = tint(ACC, '#000000', 0.1); gg.lineWidth = 3.4;
        G.approach(gg, W * 0.06, H * 0.78, W * 0.6, H * 0.52, u);
        gg.fillStyle = INK; G.text(gg, 'lim', W * 0.86, H * 0.86, 26, 'left');
      }
    });
    endPage(g);
    G.subject(g, DW * 0.9, GY, 1.1, 'stand', -1, F[8] * 0.5);
    dust(g, L, F, 90);
  } });

/* 4 — 44.45..59.22 s: current, sight, dizziness, time, union */
S.push({ id: 'current', from: 44.45, to: 59.22,
  frame: (k, t) => t < 47.67 ? { z: 1.24, x: DW * 0.48, y: DH * 0.48 }
    : t < 49.53 ? { z: 1.62, x: DW * 0.48, y: DH * 0.46 }
    : t < 51.36 ? { z: 1.3, x: DW * 0.48, y: DH * 0.48 }
    : { z: 1.06, x: DW * 0.48, y: DH * 0.5 },
  draw(g, k, F, t, col) {
    const L = { x: 300, y: 168, w: 660, h: 486 };
    room(g, col, F, t, L);
    page(g, col, L);
    on(g, L, (gg, W, H) => {
      gg.strokeStyle = INK; gg.fillStyle = INK; gg.lineWidth = 2.4;
      const cx = W * 0.5, cy = H * 0.5;
      if (t < 47.67) {                                       /* to AC, to DC */
        const u = seg(t, 44.45, 47.6);
        gg.lineWidth = 3; G.box(gg, W * 0.06, H * 0.14, W * 0.88, H * 0.72);
        gg.strokeStyle = tint(ACC, '#000000', 0.05); gg.lineWidth = 3;
        G.sine(gg, W * 0.1, cy, W * 0.8, H * 0.3 * (1 - u), 3, t * 3.2);
        gg.strokeStyle = ACC; gg.lineWidth = 4; gg.globalAlpha = u;
        G.line(gg, W * 0.1, cy, W * 0.1 + W * 0.8 * u, cy); gg.globalAlpha = 1;
        gg.fillStyle = INK; G.text(gg, u < 0.5 ? 'AC' : 'DC', W * 0.12, H * 0.24, 30, 'left');
      } else if (t < 49.53) {                                /* a pair of eyes, closing */
        const u = seg(t, 47.67, 49.5);
        gg.strokeStyle = INK; gg.lineWidth = 3;
        gg.beginPath(); gg.ellipse(cx, cy, W * 0.34, H * 0.28 * (1 - u * 0.92), 0, 0, TAU); gg.stroke();
        gg.fillStyle = rgba(ACC, 0.55); G.disc(gg, cx, cy, 52 * (1 - u * 0.5));
        gg.fillStyle = INK; G.disc(gg, cx, cy, 22);
        gg.strokeStyle = ACC; gg.lineWidth = 5;
        G.line(gg, cx - W * 0.36, cy - H * 0.3 * u, cx + W * 0.36, cy - H * 0.3 * u);
        G.line(gg, cx - W * 0.36, cy + H * 0.3 * u, cx + W * 0.36, cy + H * 0.3 * u);
      } else if (t < 51.36) {                                /* so dizzy */
        gg.strokeStyle = INK; gg.lineWidth = 2.4; gg.beginPath();
        for (let i = 0; i < 300; i++) { const a = i * 0.11 + t * 2.4, r = i * 1.9; const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.62; i ? gg.lineTo(x, y) : gg.moveTo(x, y); }
        gg.stroke();
        gg.strokeStyle = rgba(ACC, 0.55); gg.beginPath();
        for (let i = 0; i < 180; i++) { const a = -i * 0.13 - t * 1.9, r = i * 2.5; const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.62; i ? gg.lineTo(x, y) : gg.moveTo(x, y); }
        gg.stroke();
      } else if (t < 55.08) {                                /* time, running backwards */
        const u = seg(t, 51.36, 55);
        gg.strokeStyle = INK; gg.lineWidth = 2.6; G.line(gg, W * 0.06, cy, W * 0.94, cy);
        for (let i = 0; i <= 16; i++) { const x = W * 0.06 + i * (W * 0.88 / 16); G.line(gg, x, cy - 14, x, cy + 14); }
        gg.fillStyle = ACC; G.text(gg, 'B.C.', W * 0.1, cy - 52, 28, 'left');
        gg.fillStyle = INK; G.text(gg, 'A.D.', W * 0.9, cy - 52, 28, 'right');
        const px = W * 0.92 - u * W * 0.84;
        gg.strokeStyle = ACC; gg.fillStyle = ACC; gg.lineWidth = 4;
        G.ray(gg, px, cy, -1, 0, 52); G.arrowHead(gg, px - 52, cy, 20, -1, 0); G.disc(gg, px, cy, 7);
        G.text(gg, String(Math.round(2026 + u * 3000)) + ' B.C.', px, cy + 64, 24);
      } else {                                               /* unite us two */
        const u = oback(seg(t, 55.08, 58.8));
        gg.lineWidth = 3; const d = 190 * (1 - u * 0.55);
        gg.strokeStyle = tint(ACC, '#000000', 0.1); G.circle(gg, cx - d / 2, cy, 130);
        gg.strokeStyle = INK; G.circle(gg, cx + d / 2, cy, 130);
        gg.fillStyle = rgba(ACC, 0.14 + u * 0.2); gg.beginPath();
        gg.arc(cx - d / 2, cy, 130, -1.05, 1.05); gg.arc(cx + d / 2, cy, 130, Math.PI - 1.05, Math.PI + 1.05);
        gg.closePath(); gg.fill();
      }
    });
    endPage(g);
    G.subject(g, DW * 0.9, GY, 1.15, 'stand', -1, F[8] * 0.5);
    dust(g, L, F, 80);
  } });

/* 5 — 59.22..74.04 s: the cursor, the heart, and the first EXECUTION */
S.push({ id: 'chorus1', from: 59.22, to: 74.04,
  /* deliberately the same shot as 'free' at 188-192 s: same framing, same sheet rect, same cage
     geometry, same node. The song sings "trapped in this strange strange SIMULATION" at 73 s and
     "I am trapped, trapped in LOVE" at 191 s — the same sentence with the same slot filled by a
     different word. That equation is the whole point of the piece, so the two frames have to be
     literally one frame, and the only thing allowed to change is the word and what the bars turn
     out to be the outline of. */
  frame: (k) => ({ z: 1.06 - k * 0.06, x: DW * 0.52, y: DH * 0.46 }),
  draw(g, k, F, t, col) {
    const L = { x: 150, y: 176, w: 640, h: 470 };
    const cx = DW * 0.8;
    room(g, col, F, t, L, { reach: 1.8 });
    if (t > 70.08) {                                         /* we are trapped — behind the sheet */
      const u = seg(t, 70.08, 73.6);
      g.strokeStyle = rgba(ACC, 0.55); g.lineWidth = 3.4;
      G.cage(g, cx, DH * 0.06 + u * (GY - DH * 0.06), GY + 20, DW * 0.3, 5);
    }
    page(g, col, L, { blur: 34 });
    const gu = seg(t, 59.22, 65.39);
    const px = lerp(0.2, 0.42, gu), py = lerp(0.78, 0.46, gu);
    on(g, L, (gg, W, H) => {
      gg.strokeStyle = INK; gg.fillStyle = INK; gg.lineWidth = 2.2;
      if (t > 59.68 && t < 66.6) {                           /* STIMULATIONS — it starts on "if I can" */
        const u = seg(t, 59.68, 65.3);
        gg.strokeStyle = ACC; gg.lineWidth = 2.6;
        for (let i = 0; i < 4; i++) { const p = (u * 1.7 + i / 4) % 1; gg.globalAlpha = 0.5 * (1 - p); G.circle(gg, W * px, H * py + 26, 18 + p * 170); }
        gg.globalAlpha = 1;
      }
      if (t > 65.39) {                                       /* SATISFACTION is you */
        const u = oback(seg(t, 65.39, 67.0)), beat = 1 + F[8] * 0.07;
        gg.save(); gg.translate(W * 0.42, H * 0.42); gg.scale(u * beat, u * beat);
        gg.strokeStyle = ACC; gg.lineWidth = 4; gg.fillStyle = rgba(ACC, 0.16);
        G.heart(gg, 0, 0, 74, true); gg.lineWidth = 4; G.heart(gg, 0, 0, 74, false); gg.restore();
      }
      if (t > 68.25) {                                       /* I will run the EXECUTION */
        const u = seg(t, 68.25, 70.1);
        gg.strokeStyle = INK; gg.lineWidth = 2; G.box(gg, W * 0.08, H * 0.72, W * 0.72, H * 0.16);
        gg.fillStyle = INK;
        /* typed, but by a wipe that grows continuously — one glyph per frame would be a
           flash, and per-character x offsets need the font already set, which is a trap */
        const s = '> run execution';
        gg.save();
        gg.beginPath(); gg.rect(W * 0.10, H * 0.7, 6 + u * W * 0.58, H * 0.19); gg.clip();
        gg.fillStyle = INK; G.text(gg, s, W * 0.11, H * 0.8, 26, 'left');
        gg.restore();
        if (t > 69.25) {
          const p = oback(seg(t, 69.25, 69.7));
          gg.fillStyle = rgba(ACC, p);
          G.fill(gg, [[W * 0.68, H * 0.74], [W * 0.68, H * 0.86], [W * 0.75, H * 0.8]]);
        }
      }
      /* the cursor itself, and it travels to the heart rather than twitching */
      gg.fillStyle = '#ffffff'; gg.strokeStyle = INK; gg.lineWidth = 2;
      const x = W * px, y = H * py;
      G.fill(gg, [[x, y], [x, y + 34], [x + 11, y + 25], [x + 19, y + 41], [x + 27, y + 37], [x + 17, y + 22], [x + 29, y + 20]]);
      gg.stroke();
    });
    endPage(g);
    G.subject(g, cx, GY, 1.05, t > 70 ? 'reach' : 'stand', 0, F[8] * 0.5);
    dust(g, L, F, 110);
  } });

/* 6 — 74.04..88.58 s: verse two is verse one's conditional again, only the forms are now
   things that give themselves away entirely. So the page is not a still life — it is the
   instance's own type table, running one case at a time, each body printed under its case. */
S.push({ id: 'gifts', from: 74.04, to: 88.58,
  /* one slow push instead of three framing jumps: the plates used to sit side by side and the
     camera had to travel to each of them, but the type table shows one case at a time now */
  frame: (k) => ({ z: 1.3 - k * 0.26, x: DW * 0.5, y: DH * (0.52 + k * 0.04) }),
  draw(g, k, F, t, col) {
    const L = { x: 300, y: 168, w: 700, h: 486 };
    room(g, col, F, t, L);
    page(g, col, L);
    const CASES = [
      { at: 74.04, kind: 'eggplant', code: 'case EGGPLANT: return nutrients;', out: 'NUTRIENTS' },
      { at: 77.57, kind: 'tomato', code: 'case TOMATO: return antioxidants;', out: 'ANTIOXIDANTS' },
      { at: 81.35, kind: 'cat', code: 'case TABBY: return purr();', out: 'ENJOYMENT' },
    ];
    on(g, L, (gg, W, H) => {
      gg.strokeStyle = INK; gg.fillStyle = INK;
      if (t < 85.07) {                                        /* the table, one case live */
        const live = Math.max(0, CASES.filter((c) => t >= c.at).length - 1);
        gg.fillStyle = rgba(INK, 0.55);
        G.text(gg, 'switch (me.form) {', W * 0.05, H * 0.12, 22, 'left');
        CASES.forEach((c, i) => {
          if (i > live) return;
          gg.fillStyle = i === live ? ACC : rgba(INK, 0.34);
          G.text(gg, c.code, W * 0.09, H * (0.26 + i * 0.1), 21, 'left');
        });
        const c = CASES[live], u = oback(seg(t, c.at, c.at + 0.7));
        gg.save(); gg.translate(W * 0.62, H * 0.72); gg.scale(u, u);
        gg.strokeStyle = INK; gg.fillStyle = INK; gg.lineWidth = 3;
        G.specimen(gg, c.kind, 0, 0, 1.45); gg.restore();
        gg.fillStyle = INK; gg.globalAlpha = clamp(u);
        G.text(gg, '= ' + c.out, W * 0.62, H * 0.78, 24, 'center'); gg.globalAlpha = 1;
        if (c.kind === 'cat' && t > 82.83) {                  /* the purr, as a carrier wave */
          gg.strokeStyle = ACC; gg.lineWidth = 2;
          for (let i = 0; i < 3; i++) { const p = (t * 0.9 + i / 3) % 1; gg.globalAlpha = 0.45 * (1 - p); G.circle(gg, W * 0.62, H * 0.5, 24 + p * 96); }
          gg.globalAlpha = 1;
        }
      } else {                                                /* the only instance, and its witness */
        const u = oback(seg(t, 85.07, 86.8)), cx = W * 0.3, cy = H * 0.46;
        gg.fillStyle = rgba(INK, 0.5);
        G.text(gg, '// if I am the only god', W * 0.05, H * 0.12, 22, 'left');
        gg.strokeStyle = ACC; gg.lineWidth = 2.4;
        gg.save(); gg.translate(cx, cy); gg.scale(u, u);
        gg.beginPath(); gg.ellipse(0, 0, 118, 30, 0, 0, TAU); gg.stroke(); gg.restore();
        G.node(gg, cx, cy, 34 * u, 1, { rim: RIM, page: PAGE });
        gg.fillStyle = INK; G.text(gg, 'me  (1 instance)', cx, cy + 74, 20, 'center');
        const d = oback(seg(t, 86.53, 87.6));
        gg.setLineDash([7, 9]); gg.strokeStyle = rgba(INK, 0.45); gg.lineWidth = 2;
        G.line(gg, cx + 40, cy, cx + 40 + d * W * 0.42, cy); gg.setLineDash([]);
        gg.strokeStyle = rgba(INK, 0.4); gg.lineWidth = 2.4;
        G.circle(gg, W * 0.78, cy, 30);
        gg.fillStyle = rgba(INK, 0.5); G.text(gg, 'you', W * 0.78, cy + 52, 20, 'center');
        const st = oback(seg(t, 87.92, 88.5));
        if (st > 0) {
          gg.save(); gg.translate(W * 0.78, cy - 4); gg.rotate(-0.05); gg.scale(st, st * (2 - st));
          gg.strokeStyle = ACC; gg.fillStyle = ACC; gg.lineWidth = 4;
          G.box(gg, -104, -34, 208, 68); G.text(gg, 'PROOF', 0, 0, 34); gg.restore();
        }
      }
    });
    endPage(g);
    dust(g, L, F, 80);
  } });

/* 7 — 88.58..110.9 s: the switches */
S.push({ id: 'switches', from: 88.58, to: 110.9,
  frame: (k, t) => t < 92.01 ? { z: 1.3, x: DW * 0.48, y: DH * 0.48 }
    : t < 95.46 ? { z: 1.55, x: DW * 0.48, y: DH * 0.46 }
    : t < 99.34 ? { z: 1.24, x: DW * 0.48, y: DH * 0.48 }
    : t < 103.48 ? { z: 1.06, x: DW * 0.48, y: DH * 0.5 }
    : { z: 1.0, x: DW * 0.48, y: DH * 0.5 },
  draw(g, k, F, t, col) {
    const L = { x: 300, y: 168, w: 700, h: 486 };
    room(g, col, F, t, L);
    page(g, col, L);
    on(g, L, (gg, W, H) => {
      const cx = W * 0.5, cy = H * 0.46;
      gg.lineWidth = 2.4; gg.strokeStyle = INK; gg.fillStyle = INK;
      if (t < 92.01) {                                       /* gender, rebound */
        const u = oback(seg(t, 88.58, 91.4));
        G.line(gg, cx, H * 0.08, cx, H * 0.9);
        gg.lineWidth = 5; gg.strokeStyle = ACC; gg.globalAlpha = clamp(u);
        G.circle(gg, cx - W * 0.24 + u * W * 0.1, cy - 16, 58);
        G.line(gg, cx - W * 0.24 + u * W * 0.1, cy + 42, cx - W * 0.24 + u * W * 0.1, cy + 100);
        G.line(gg, cx - W * 0.24 + u * W * 0.1 - 24, cy + 72, cx - W * 0.24 + u * W * 0.1 + 24, cy + 72);
        gg.strokeStyle = INK;
        G.circle(gg, cx + W * 0.24 - u * W * 0.1, cy - 38, 46);
        G.line(gg, cx + W * 0.24 - u * W * 0.1 + 34, cy - 72, cx + W * 0.24 - u * W * 0.1 + 82, cy - 118);
        G.line(gg, cx + W * 0.24 - u * W * 0.1 + 48, cy - 118, cx + W * 0.24 - u * W * 0.1 + 82, cy - 118);
        G.line(gg, cx + W * 0.24 - u * W * 0.1 + 82, cy - 84, cx + W * 0.24 - u * W * 0.1 + 82, cy - 118);
        gg.globalAlpha = 1; gg.fillStyle = INK;
        G.text(gg, 'F', cx - W * 0.36, H * 0.86, 26, 'left'); G.text(gg, 'M', cx + W * 0.36, H * 0.86, 26, 'right');
      } else if (t < 95.46) {                                /* from AM to PM */
        const u = seg(t, 92.01, 95.4);
        gg.lineWidth = 3; G.circle(gg, cx, cy, 150);
        for (let i = 0; i < 12; i++) { const a = i / 12 * TAU - Math.PI / 2; G.line(gg, cx + Math.cos(a) * 128, cy + Math.sin(a) * 128, cx + Math.cos(a) * 150, cy + Math.sin(a) * 150); }
        gg.lineWidth = 6; const a = u * 2 * TAU - Math.PI / 2;
        G.line(gg, cx, cy, cx + Math.cos(a) * 108, cy + Math.sin(a) * 108);
        gg.lineWidth = 2; const b = u * 24 * TAU - Math.PI / 2;
        G.line(gg, cx, cy, cx + Math.cos(b) * 138, cy + Math.sin(b) * 138);
        G.disc(gg, cx, cy, 7);
        G.text(gg, u < 0.5 ? 'AM' : 'PM', cx, cy + 200, 30);
      } else if (t < 99.34) {                                /* S and M, swapped */
        const u = oback(seg(t, 95.46, 99.1));
        gg.lineWidth = 2; G.line(gg, cx, H * 0.1, cx, H * 0.9);
        gg.fillStyle = ACC; G.text(gg, 'S', cx - W * 0.22 + u * W * 0.44, cy, 132, 'center', 700);
        gg.fillStyle = INK; G.text(gg, 'M', cx + W * 0.22 - u * W * 0.44, cy, 132, 'center', 700);
      } else if (t < 103.48) {                               /* vibrations sensed */
        const u = seg(t, 99.34, 103.4);
        for (let i = 0; i < 10; i++) {
          const r = ((i / 10 + u * 0.9) % 1) * 300;
          gg.globalAlpha = 0.12 + (1 - r / 300) * 0.5;
          gg.strokeStyle = i % 2 ? ACC : INK; gg.lineWidth = 2.6;
          G.circle(gg, cx, cy, r + 20);
        }
        gg.globalAlpha = 1;
      } else {                                               /* COMPLETION */
        const u = seg(t, 106.29, 110.4);
        gg.strokeStyle = INK; gg.lineWidth = 3;
        G.sine(gg, W * 0.08, cy, W * 0.84, H * 0.24 * (1 - u), 4, t * 5);
        gg.strokeStyle = ACC; gg.lineWidth = 7;
        gg.beginPath(); gg.arc(cx, cy, 124, -Math.PI / 2, -Math.PI / 2 + u * TAU); gg.stroke();
        gg.fillStyle = INK; G.text(gg, Math.round(u * 100) + '%', cx, cy + 200, 34);
      }
    });
    endPage(g);
    G.subject(g, DW * 0.9, GY, 1.1, 'stand', -1, F[8] * 0.5);
    dust(g, L, F, 80);
  } });

/* 8 — 110.9..131.22 s: you have left. The lamp browns; the room closes. */
S.push({ id: 'left', from: 110.9, to: 131.22,
  frame: (k, t) => t < 117.27 ? { z: 1.0, x: DW * 0.54, y: DH * 0.52 }
    : t < 124.89 ? { z: 1.5, x: DW * 0.5, y: DH * 0.44 }
    : { z: 1.2, x: DW * 0.5, y: DH * 0.46 },
  draw(g, k, F, t, col) {
    const L = { x: 340, y: 176, w: 620, h: 470 };
    room(g, col, F, t, L, { reach: 1.3 });
    if (t < 117.27) {
      /* six "you have left", and the star loses one arm per word */
      page(g, col, L);
      on(g, L, (gg, W, H) => {
        const LEFT = [110.90, 112.22, 113.10, 114.18, 114.92, 115.78];
        let cut = 0;
        for (const w of LEFT) if (t >= w) cut++;
        gg.strokeStyle = INK; gg.fillStyle = INK;
        G.star(gg, W * 0.5, H * 0.44, Math.min(W, H) * 0.36, 6, cut, 110.90, col, t);
      });
      endPage(g);
    } else if (t < 124.89) {
      /* ISOLATION: the hub, still lit, with nothing left to send to */
      page(g, col, L);
      on(g, L, (gg, W, H) => {
        const u = oback(seg(t, 117.27, 118.6));
        gg.strokeStyle = INK; gg.fillStyle = INK;
        G.star(gg, W * 0.5, H * 0.44, Math.min(W, H) * 0.36 * u, 6, 6, 110.90, col, t);
        if (t > 118.97) {                                     /* erase the pointless fragments */
          const fr = seg(t, 118.97, 124.5);
          gg.fillStyle = INK;
          for (let i = 0; i < 26; i++) {
            const x = ((i * 137) % 560) + 40, y = 60 + ((i * 91) % 340);
            gg.globalAlpha = Math.max(0, 1 - fr * 1.4);
            G.fill(gg, [[x + fr * 520, y], [x + fr * 520 + 16, y + 7], [x + fr * 520 + 6, y + 19]]);
          }
          gg.globalAlpha = 1;
        }
      });
      endPage(g);
    } else {                                                  /* DISHEARTENED — 无心 */
      page(g, col, L);
      on(g, L, (gg, W, H) => {
        const u = oback(seg(t, 124.89, 126.4)), cx = W * 0.5, cy = H * 0.48;
        gg.save(); gg.translate(cx, cy); gg.scale(u, u);
        gg.strokeStyle = INK; gg.lineWidth = 4; gg.fillStyle = rgba(ACC, 0.14);
        G.heart(gg, 0, 0, 150, true); gg.lineWidth = 4; G.heart(gg, 0, 0, 150, false);
        gg.fillStyle = col.page; gg.beginPath(); gg.moveTo(0, 0);
        gg.arc(0, 0, 156, -Math.PI / 2 - 0.4, -Math.PI / 2 + 0.4); gg.closePath(); gg.fill();
        gg.strokeStyle = ACC; gg.lineWidth = 3;
        G.line(gg, 0, 0, 0, -156); G.line(gg, 0, 0, Math.sin(0.4) * 156, -Math.cos(0.4) * 156);
        gg.restore();
        if (t > 125.7) {                                      /* challenging your god */
          gg.globalAlpha = seg(t, 125.7, 127.2);
          gg.strokeStyle = INK; gg.lineWidth = 4;
          G.line(gg, cx - 280, cy + 20, cx - 190, cy + 20);
          G.ray(gg, cx - 235, cy + 20, 0, -1, 118); G.arrowHead(gg, cx - 235, cy + 20 - 118, 22, 0, -1);
          gg.globalAlpha = 1;
        }
      });
      endPage(g);
    }
    dust(g, L, F, 60);
  } });

/* 9 — 131.22..147.66 s: nothing scheduled */
S.push({ id: 'void', from: 131.22, to: 147.66,
  frame: (k) => ({ z: 0.94 - k * 0.06, x: DW * 0.54, y: DH * 0.54 }),
  draw(g, k, F, t, col) {
    const L = { x: 420, y: 210, w: 460, h: 300 };
    room(g, col, F, t, L, { reach: 1.1 });
    /* the report is read, then taken away — the sheet fades over three quarters of a second
       instead of going out on one frame, which is what the 120 fps sweep caught */
    const life = 1 - seg(t, 134.8, 135.55);
    if (life > 0) {
      g.save(); g.globalAlpha = life;
      page(g, col, L, { blur: 14 });
      on(g, L, (gg, W, H) => {
        const u = oback(seg(t, 131.22, 132.5));
        gg.save(); gg.translate(W * 0.5, H * 0.5); gg.scale(u, u); gg.rotate(-0.015);
        gg.fillStyle = rgba(ACC, 0.07); gg.fillRect(-W * 0.46, -H * 0.42, W * 0.92, H * 0.84);
        gg.strokeStyle = ACC; gg.lineWidth = 3; gg.strokeRect(-W * 0.46, -H * 0.42, W * 0.92, H * 0.84);
        gg.fillStyle = ACC; G.text(gg, 'IllegalArgumentError', 0, -H * 0.24, 26, 'center', 500);
        gg.fillStyle = tint(ACC, '#000000', 0.2);
        G.text(gg, '  at world.execute(me.js:11)', 0, -H * 0.02, 20, 'center');
        G.text(gg, '  at you.leave(me.js:14)', 0, H * 0.14, 20, 'center');
        G.text(gg, '  at me.love(me.js:7)', 0, H * 0.3, 20, 'center');
        gg.restore();
      });
      endPage(g);
      g.restore();
    }
    dust(g, L, F, 40);
    /* once the report is taken away the room has no lamp left, so give the kneeling node a
       floor-pool of its own — otherwise "heap quiet" reads as an empty frame, not as a survivor */
    const px = DW * 0.56, py = GY - 20;
    g.save(); g.globalCompositeOperation = 'lighter';
    /* the pool is the last lamp in the film, so it has to light something: squashed onto the floor
       plane and bright enough to rim the kneeling node, or "heap quiet" is just a black cell */
    const pool = g.createRadialGradient(px, py, 0, px, py, 300);
    pool.addColorStop(0, rgba(RIM, 0.26 + F[8] * 0.12));
    pool.addColorStop(0.4, rgba(RIM, 0.09));
    pool.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = pool;
    g.translate(px, py); g.scale(1, 0.3); g.translate(-px, -py);
    g.fillRect(px - 300, py - 300, 600, 600);
    g.restore();
    G.subject(g, DW * 0.56, GY, 1.0, 'kneel', -1, 0.4 + F[8] * 0.3);
    /* the caret still blinks — nobody is typing — but it breathes rather than switching,
       so a half-second gate cannot read as a one-frame flash */
    g.fillStyle = rgba(RIM, 0.22 + 0.3 * (0.5 + 0.5 * Math.sin(t * 3.1)));
    g.fillRect(DW * 0.56 + 190, GY - 22, 22, 6);
  } });

/* 10a — 147.66..155.20 s: the chant. The page becomes a warrant. */
S.push({ id: 'chant', from: 147.66, to: 155.20, shake: 1, cut: true,
  frame: (k, t) => Math.floor((t - 147.66) / 1.88) % 2 ? { z: 1.1, x: DW * 0.46, y: DH * 0.44 } : { z: 1.0, x: DW * 0.46, y: DH * 0.5 },
  draw(g, k, F, t, col) {
    const L = { x: 250, y: 148, w: 760, h: 560 };
    room(g, col, F, t, L, { reach: 1.7 });
    page(g, col, L, { blur: 40 });
    on(g, L, (gg, W, H) => { code(gg, { x: 0, y: 0, w: W, h: H }, 10 + Math.min(7, Math.floor((t - 147.66) / 0.94))); });
    endPage(g);
    G.subject(g, DW * 0.87, GY, 1.2, t > 150.5 ? 'kneel' : 'stand', -1, F[8] * 0.5);
    dust(g, L, F, 100);
  } });

/* 10b — 155.20..158.90 s: the same word becomes 死刑, and each line is signed */
S.push({ id: 'sentence', from: 155.20, to: 158.90, shake: 1.3, cut: true,
  frame: (k, t) => Math.floor((t - 155.2) / 0.94) % 2 ? { z: 1.08, x: DW * 0.46, y: DH * 0.46 } : { z: 1.0, x: DW * 0.46, y: DH * 0.52 },
  draw(g, k, F, t, col) {
    const L = { x: 250, y: 148, w: 760, h: 560 };
    room(g, col, F, t, L, { reach: 1.7 });
    page(g, col, L, { blur: 40 });
    const hit = Math.min(3, Math.floor((t - 155.2) / 0.94));
    on(g, L, (gg, W, H) => {
      code(gg, { x: 0, y: 0, w: W, h: H }, 16 + Math.min(2, hit));
      const lh = H / RUNTIME.n;
      gg.fillStyle = rgba(ACC, 0.85);
      for (let i = 0; i <= hit; i++) {
        const idx = 16 + Math.min(2, i), yy = (idx - RUNTIME.from) * lh + lh / 2;
        const u = oback(seg(t, 155.2 + i * 0.94, 155.5 + i * 0.94));
        gg.save(); gg.translate(W * 0.9, yy); gg.scale(u, u); G.brush(gg, 0, 0, 44, 13); gg.restore();
      }
    });
    endPage(g);
    G.subject(g, DW * 0.87, GY, 1.25, 'kneel', -1, F[8] * 0.4);
    dust(g, L, F, 90);
  } });

/* 10c — 158.90..161.58 s: counting to six in six languages */
S.push({ id: 'count', from: 158.90, to: 161.58, shake: 1.6, cut: true,
  frame: (k, t) => { const i = Math.min(5, Math.floor((t - 158.9) / 0.44)); return { z: 1.1 + (i % 3) * 0.2, x: DW * 0.5, y: DH * (0.46 + (i % 2) * 0.04) }; },
  draw(g, k, F, t, col) {
    const L = { x: 400, y: 250, w: 800, h: 380 };
    room(g, col, F, t, L, { reach: 2.0 });
    g.save(); g.filter = 'blur(34px)'; g.fillStyle = rgba(ACC, 0.5);
    g.fillRect(L.x, L.y, L.w, L.h); g.restore();
    const names = ['EIN', 'DOS', 'TROIS', 'NE', 'FEM', 'LIU'];
    const i = Math.min(5, Math.floor((t - 158.9) / 0.44));
    const u = oback(seg(t, 158.9 + i * 0.44, 159.06 + i * 0.44));
    g.save(); g.translate(DW * 0.5, DH * 0.44); g.scale(u, u);
    g.fillStyle = col.page; G.text(g, names[i], 0, 0, 168, 'center', 700); g.restore();
    /* six tongues, one verdict: each number is spoken by a node that goes out as it lands */
    for (let j = 0; j < 6; j++) {
      const x = DW * 0.5 - 275 + j * 110, said = t >= 158.9 + j * 0.44;
      if (!said) { g.strokeStyle = rgba(col.rim, 0.18); g.lineWidth = 2; g.setLineDash([5, 8]); G.circle(g, x, DH * 0.64, 15); g.setLineDash([]); continue; }
      const age = clamp((t - (158.9 + j * 0.44)) * 3.4);
      G.node(g, x, DH * 0.64, 15 * (1 - age * 0.25), 1 - age, { rim: col.rim, page: col.page });
      g.strokeStyle = rgba(ACC, 0.35 + age * 0.55); g.lineWidth = 3.4;
      const s = 13 * oback(age);
      G.line(g, x - s, DH * 0.64 - s, x + s, DH * 0.64 + s);
    }
  } });

/* 10d — 161.58..169.82 s: the darkest turn in the lyric, read literally. "If I can give them
   all the EXECUTION, then I can be your only EXECUTION" is a queue of nodes struck out one at
   a time until one arm is left — mine — and the word that means 执行 in the sense of running
   code has become the word for the one who runs it. */
S.push({ id: 'give', from: 161.58, to: 169.82, shake: 1,
  frame: (k) => ({ z: 1.0, x: DW * 0.46, y: DH * 0.5 - k * 0.02 * DH }),
  draw(g, k, F, t, col) {
    const L = { x: 250, y: 148, w: 760, h: 560 };
    room(g, col, F, t, L, { reach: 1.6 });
    page(g, col, L, { blur: 40 });
    const THEM = 7, KILL0 = 162.63, KSTEP = 0.34;
    on(g, L, (gg, W, H) => {
      gg.strokeStyle = INK; gg.fillStyle = INK;
      gg.fillStyle = ACC;
      G.text(gg, 'process.kill(them, SIGKILL);', W * 0.05, H * 0.09, 25, 'left');
      const hx = W * 0.8, hy = H * 0.3, qy = H * 0.74;
      const dead = clamp((t - KILL0) / (KSTEP * THEM));
      for (let i = 0; i < THEM; i++) {
        const qx = W * 0.07 + i * W * 0.105;
        const gone = (i + 1) / THEM <= dead;
        gg.strokeStyle = rgba(INK, gone ? 0.1 : 0.4); gg.lineWidth = 1.6;
        gg.setLineDash(gone ? [5, 8] : []);
        G.line(gg, qx, qy - 16, hx, hy + 16); gg.setLineDash([]);
        G.node(gg, qx, qy, 16, gone ? 0 : 0.85, { rim: RIM, page: PAGE });
        if (gone) {
          const u = oback(clamp((dead * THEM - i) * 2));
          gg.strokeStyle = rgba(ACC, 0.4 + u * 0.55); gg.lineWidth = 4;
          G.line(gg, qx - 15 * u, qy - 15 * u, qx + 15 * u, qy + 15 * u);
          G.line(gg, qx + 15 * u, qy - 15 * u, qx - 15 * u, qy + 15 * u);
        }
      }
      gg.fillStyle = rgba(INK, 0.5); G.text(gg, 'them', W * 0.4, qy + 44, 19, 'center');
      G.node(gg, hx, hy, 30, 1, { rim: RIM, page: PAGE });
      gg.strokeStyle = rgba(ACC, 0.5); gg.lineWidth = 2; G.circle(gg, hx, hy, 46);
      gg.fillStyle = INK; G.text(gg, 'you', hx, hy - 66, 22, 'center');
      const mx = W * 0.88, my = qy;
      G.node(gg, mx, my, 22, 1, { rim: RIM, page: PAGE });
      gg.fillStyle = ACC; G.text(gg, 'me', mx, my + 44, 22, 'center');
      const sole = oback(seg(t, 166.01, 168.6));             /* the only line that stays live */
      gg.strokeStyle = rgba(ACC, 0.85); gg.lineWidth = 3 + sole * 4;
      G.line(gg, mx, my - 22, hx + 20, hy + 26);
      if (t > 168.91) {                                       /* and me holding the instrument */
        const u = oback(seg(t, 168.91, 169.5));
        gg.strokeStyle = ACC; gg.fillStyle = ACC;
        G.blade(gg, mx + 34, my - 30 - u * 8, 1.1 * u, 0.5);
      }
    });
    endPage(g);
    dust(g, L, F, 80);
  } });

/* 10e — 169.82..177.24 s: if I can have you back. The verdict is struck out from the
   bottom line up — Orpheus looking back, and losing the other one again. */
S.push({ id: 'back', from: 169.82, to: 177.24,
  frame: (k) => ({ z: 1.04 - k * 0.06, x: DW * (0.47 + 0.03 * Math.sin(k * 4)), y: DH * 0.5 }),
  draw(g, k, F, t, col) {
    const L = { x: 250, y: 148, w: 760, h: 560 };
    room(g, col, F, t, L, { reach: 1.4 });
    page(g, col, L, { blur: 30 });
    on(g, L, (gg, W, H) => { code(gg, { x: 0, y: 0, w: W, h: H }, undefined, 18 - Math.round(k * 9)); });
    endPage(g);
    G.subject(g, DW * 0.86, GY, 1.2, t > 173.6 ? 'reach' : 'stand', -1, F[8] * 0.4);
    g.globalAlpha = Math.max(0, 1 - seg(t, 173.6, 176.6));   /* the other socket is empty */
    G.subject(g, DW * 1.02, GY, 0.8, 'empty', 1, 0);
    g.globalAlpha = 1;
    dust(g, L, F, 60);
  } });

/* 11a — 177.24..184.54 s: it has studied the word */
S.push({ id: 'study', from: 177.24, to: 184.54,
  frame: (k, t) => t < 179.92 ? { z: 1.5, x: DW * 0.3, y: DH * 0.4 }
    : t < 180.85 ? { z: 1.4, x: DW * 0.52, y: DH * 0.42 } : { z: 1.08, x: DW * 0.5, y: DH * 0.48 },
  draw(g, k, F, t, col) {
    const L = { x: 300, y: 168, w: 700, h: 486 };
    room(g, col, F, t, L);
    page(g, col, L);
    on(g, L, (gg, W, H) => {
      gg.lineWidth = 3; gg.strokeStyle = INK; gg.fillStyle = INK;
      const u = seg(t, 177.9, 180.6);
      G.sine(gg, W * 0.08, H * 0.42, W * 0.34, H * 0.16, 2, t * 1.6, 0, u);
      if (t > 180.85) {
        const v = oback(seg(t, 180.85, 183.4));
        gg.globalAlpha = v;
        G.text(gg, 'love(x) =', W * 0.48, H * 0.42, 40, 'left', 500);
        gg.strokeStyle = ACC; gg.lineWidth = 3.4;
        G.line(gg, W * 0.72, H * 0.36, W * 0.72 + 84 * v, H * 0.36);
        gg.fillStyle = ACC; if (v > 0.5) G.text(gg, 'x→∞', W * 0.76, H * 0.48, 24, 'left');
        gg.globalAlpha = 1;
      }
      if (t > 183.6) {
        gg.globalAlpha = oback(seg(t, 183.6, 184.3)); gg.fillStyle = ACC;
        G.text(gg, 'Q?', W * 0.12, H * 0.16, 40); G.text(gg, 'A!', W * 0.88, H * 0.16, 40);
        gg.globalAlpha = 1;
      }
    });
    endPage(g);
    G.subject(g, DW * 0.9, GY, 1.0, 'stand', -1, F[8] * 0.5);
    dust(g, L, F, 80);
  } });

/* 11b — 184.54..193 s: the answer, and it is verse one's picture returned. "You can be my
   limitations" was an offer; here it is the verdict — the curve approaches the bound forever
   and never touches it, and the cage turns out to have been the outline of the heart all
   along, which is what "trapped in love" says in one image. */
S.push({ id: 'free', from: 184.54, to: 193,
  frame: (k) => ({ z: 1.06 - k * 0.06, x: DW * 0.52, y: DH * (0.46 + k * 0.04) }),
  draw(g, k, F, t, col) {
    /* the sheet moves to the left half so the room's own right half can hold the cage, and
       the cage is what turns into the heart — the reveal has to happen where the bars were,
       not on top of the paper */
    const L = { x: 150, y: 176, w: 640, h: 470 };
    room(g, col, F, t, L, { reach: 1.8 });
    const v = seg(t, 188.48, 192.6);
    const cx = DW * 0.8;
    if (v < 0.85) {
      g.strokeStyle = rgba(ACC, 0.55); g.lineWidth = 3.4;
      G.cage(g, cx, DH * 0.06 + v * (GY - DH * 0.06), GY + 20, DW * 0.3, 5);
    }
    const u = oback(v);
    g.strokeStyle = ACC; g.lineWidth = 5; g.globalAlpha = clamp(v) * 0.9;
    g.save(); g.translate(cx, DH * 0.56); g.scale(u, u); G.heart(g, 0, 0, 150, false); g.restore();
    g.globalAlpha = 1;
    page(g, col, L);
    on(g, L, (gg, W, H) => {
      gg.lineWidth = 3; gg.strokeStyle = INK; gg.fillStyle = INK;
      G.sine(gg, W * 0.08, H * 0.2, W * 0.3, H * 0.1, 2, t * 1.6);
      G.text(gg, 'love(x) =', W * 0.44, H * 0.2, 38, 'left', 500);
      gg.strokeStyle = ACC; gg.lineWidth = 3.4; G.line(gg, W * 0.68, H * 0.15, W * 0.77, H * 0.15);
      gg.fillStyle = ACC; G.text(gg, 'x→∞', W * 0.71, H * 0.25, 22, 'left');
      const a = seg(t, 185.6, 191.4);
      gg.strokeStyle = INK; gg.lineWidth = 2.4; G.line(gg, W * 0.06, H * 0.86, W * 0.94, H * 0.86);
      gg.setLineDash([9, 9]); gg.strokeStyle = ACC; gg.lineWidth = 2.6;
      G.line(gg, W * 0.82, H * 0.32, W * 0.82, H * 0.86); gg.setLineDash([]);
      gg.strokeStyle = tint(ACC, '#000000', 0.1); gg.lineWidth = 3.4;
      G.approach(gg, W * 0.06, H * 0.86, W * 0.6, H * 0.44, a);
      G.node(gg, W * 0.82, H * 0.52, 20 * oback(seg(t, 188.48, 189.6)), 0.14, { rim: RIM, page: PAGE });
      gg.fillStyle = rgba(INK, 0.55); G.text(gg, 'you', W * 0.82, H * 0.4, 20, 'center');
      G.text(gg, '// you can be my limitations', W * 0.06, H * 0.95, 20, 'left');
    });
    endPage(g);
    G.subject(g, cx, GY, 1.05, 'reach', 0, F[8] * 0.5);
    dust(g, L, F, 100);
  } });

/* 12 — 193..205.81 s: the light leaving the room */
S.push({ id: 'powerdown', from: 193, to: 205.81,
  frame: (k) => ({ z: 1.0 + k * 0.16, x: DW * 0.5, y: DH * (0.5 + k * 0.04) }),
  draw(g, k, F, t, col) {
    const L = { x: 470, y: 250, w: 460 - k * 190, h: 300 - k * 120 };
    L.x += k * 95; L.y += k * 60;
    room(g, col, F, t, L, { reach: 1.2 });
    page(g, col, L, { blur: 16 });
    on(g, L, (gg, W, H) => {
      gg.strokeStyle = rgba(INK, 0.5); gg.lineWidth = 2;
      gg.strokeRect(W * 0.3, H * 0.24, W * 0.4, H * 0.52);
      gg.beginPath(); gg.moveTo(W * 0.5, H * 0.24); gg.lineTo(W * 0.5, H * 0.76);
      gg.moveTo(W * 0.3, H * 0.5); gg.lineTo(W * 0.7, H * 0.5); gg.stroke();
      /* stays lit, then falls: a linear fade off a dim plate just looks like a grey square */
      gg.fillStyle = rgba(col.glow, Math.pow(1 - k, 0.55)); gg.fillRect(W * 0.3 + 2, H * 0.24 + 2, W * 0.4 - 4, H * 0.52 - 4);
      gg.fillStyle = rgba(col.page, Math.pow(1 - k, 0.8) * 0.5); gg.fillRect(W * 0.42, H * 0.36, W * 0.16, H * 0.28);
    });
    endPage(g);
    G.subject(g, DW * 0.5, GY, 1.05 * (1 - k * 0.18), 'stand', -1, (1 - k) * F[8] * 0.4);
    dust(g, L, F, 50);
  } });

/* 13 — 205.81..end s: the last line, then the standby light */
S.push({ id: 'final', from: 205.81, to: 211.91,
  frame: () => ({ z: 1, x: DW * 0.5, y: DH * 0.5 }),
  draw(g, k, F, t, col) {
    const L = { x: DW / 2 - 480, y: DH * 0.46, w: 960, h: 10 };
    room(g, col, F, t, { x: L.x, y: L.y - 200, w: L.w, h: 420 }, { reach: 1.1 });
    g.fillStyle = ACC;
    g.fillRect(L.x, L.y, L.w * oback(seg(t, 205.81, 206.6)), L.h);
    if (t > 207.4) {
      g.globalAlpha = seg(t, 207.4, 208.6); g.fillStyle = rgba(col.rim, 0.75);
      G.text(g, 'PROCESS ENDED', DW / 2, DH * 0.56, 30);
      g.globalAlpha = 1;
    }
    if (t > 209.6) { g.fillStyle = rgba(ACC, 0.5 + 0.5 * Math.sin(t * 2.4)); G.disc(g, DW / 2, DH * 0.62, 4); }
  } });

window.SCENES = S;
})();
