/* mv/line.js — the two things that come from the recording rather than from the lyric.

   1. the melody stroke: one continuous line, always on screen, whose height is the pitch the
      singer is actually holding. It is the film's spine — the picture's motion and this line are
      the same measurement, so the image moves *with* the music instead of illustrating words.
   2. the display word: the hook word being sung (the ALL-CAPS lines of the lyric) rendered as a
      typographic mass in the room, revealed left-to-right across the note that carries it, with
      print misregistration. In this genre the text is part of the picture, not a caption under it.

   Plus the beat clock the camera is locked to: bar phase, downbeat, measured onset weight.
   window.MUSIC comes from analysis/music.html; the chord decode is deliberately unused — its
   bar-by-bar results (a B-flat-heavy loop for an A-minor song) were not trustworthy. */
(() => {
'use strict';
const M = window.MUSIC, META = M.meta, HOP = META.hop / META.sr;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const LOOK = 7.2;                                   /* seconds of contour visible behind the head */
const LO = 55, HI = 1100;                           /* the pitch range the rail spans */

/* pitch in Hz at t; 0 when the tracker found nothing. The exported contour is held for four
   analysis frames (the pitch tracker runs at a quarter of the frame rate — STRIDE in
   analysis/music.html), so it is interpolated back between those holds: a stroke, not a staircase. */
const STRIDE = 4;
function pitch(t) {
  const i = t / HOP;
  if (i < 0 || i >= META.frames - STRIDE) return 0;
  const k = Math.floor(i / STRIDE), f = i / STRIDE - k;
  const a = M.f0[k * STRIDE], b = M.f0[(k + 1) * STRIDE];
  if (!a || !b) return 0;
  const q = ((a + (b - a) * f) + (a + b) * 0.25) / 2.5 / 255 * HI;   /* one light smoothing tap */
  return q > LO ? q : 0;
}
/* onset weight of the beat nearest before t, 0..1 — measured, not assumed */
function beatAt(t) {
  const B = M.beat;
  let i = 0, lo = 0, hi = B.length - 1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (B[m] <= t) { i = m; lo = m + 1; } else hi = m - 1; }
  const next = B[i + 1] === undefined ? B[i] + 60 / META.bpm : B[i + 1];
  return { i, t0: B[i], next, phase: clamp((t - B[i]) / (next - B[i]), 0, 1),
           w: (M.beatOn[i] || 0) / 255, bar: Math.floor((i - META.root) / 4),
           inBar: ((i - META.root) % 4 + 4) % 4 };
}
/* snap a cut to the nearest bar line when it is already within a quarter of a beat of one */
function onBar(t) {
  const sp = 240 / META.bpm, k = Math.round((t - M.beat[0]) / sp);
  const b = M.beat[0] + k * sp;
  return Math.abs(b - t) < 60 / META.bpm * 0.25 ? b : t;
}

function rgba(h, a) {
  return `rgba(${parseInt(h.slice(1, 3), 16)},${parseInt(h.slice(3, 5), 16)},${parseInt(h.slice(5, 7), 16)},${a})`;
}

/* ---------------- the melody stroke ---------------- */
/* y is log-pitch, x is time; the head rides the playhead, the tail is the last LOOK seconds,
   and a dashed mirror falls below the rail the way the page's light falls onto the floor. */
function melody(g, t, W, H, pal) {
  const rail = H * 0.665, span = H * 0.30;
  const xOf = (u) => (u - (t - LOOK)) / LOOK * W;
  const yOf = (hz) => rail - clamp(Math.log2(Math.max(LO, hz) / LO) / Math.log2(HI / LO), 0, 1) * span;
  const step = LOOK / 900;
  const pts = [];
  for (let u = t - LOOK; u <= t + 1e-6; u += step) {
    const hz = pitch(u);
    pts.push({ x: xOf(u), y: hz ? yOf(hz) : rail, live: hz > 0 });
  }
  const stroke = (mirror, alpha, dash) => {
    g.save();
    g.strokeStyle = rgba(mirror ? pal.glow : pal.rim, alpha);
    g.lineWidth = mirror ? 1.2 : 2.3; g.lineJoin = 'round'; g.lineCap = 'round';
    if (dash) g.setLineDash([7, 9]);
    g.beginPath();
    let pen = false;
    for (const p of pts) {
      const y = mirror ? rail + (rail - p.y) * 0.62 : p.y;
      if (!p.live) { pen = false; continue; }
      pen ? g.lineTo(p.x, y) : (g.moveTo(p.x, y), pen = true);
    }
    g.stroke(); g.restore();
  };
  stroke(false, 0.5, false);                                  /* the sung line: one solid stroke */
  stroke(true, 0.17, true);                                   /* its reflection: dashed, faint */
  /* the rail itself: one hairline, so the stroke has something to sit on */
  g.strokeStyle = rgba(pal.rim, 0.1); g.lineWidth = 1;
  g.beginPath(); g.moveTo(0, rail); g.lineTo(W, rail); g.stroke();
  /* the head: where the singer is right now */
  const hz = pitch(t), hy = hz ? yOf(hz) : rail;
  g.save(); g.globalCompositeOperation = 'lighter';
  const halo = g.createRadialGradient(W - 2, hy, 0, W - 2, hy, 46);
  halo.addColorStop(0, rgba(pal.page, hz ? 0.5 : 0.1)); halo.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = halo; g.fillRect(W - 48, hy - 48, 96, 96);
  g.restore();
  g.fillStyle = rgba(hz ? pal.page : pal.rim, hz ? 0.9 : 0.25);
  g.beginPath(); g.arc(W - 2, hy, hz ? 3.4 : 2.2, 0, Math.PI * 2); g.fill();
  return { rail, hy, live: hz > 0 };
}

/* ---------------- the display word ---------------- */
/* Hook words are the ALL-CAPS lines of the lyric — the ones the melody holds a long note on.
   They are revealed across the window the note occupies, in the room, above the rail. */
let HOOKS = null;
function hooks(LYRICS) {
  if (HOOKS) return HOOKS;
  HOOKS = [];
  LYRICS.forEach((l, i) => {
    if (!/^[A-Z0-9 .!?-]+$/.test(l.en) || l.en.length < 4) return;
    const nxt = LYRICS[i + 1];
    HOOKS.push({ w: l.en, from: l.at, to: nxt ? Math.min(nxt.at, l.at + 3.4) : l.at + 3.4, cn: l.cn });
  });
  return HOOKS;
}
function display(g, t, W, H, pal, LYRICS) {
  const hs = hooks(LYRICS);
  const h = hs.find((x) => t >= x.from && t < x.to);
  if (!h) return;
  const u = clamp((t - h.from) / (h.to - h.from), 0, 1);
  const size = Math.min(H * 0.095, W * 0.07);
  const x = W * 0.055, y = H * 0.235;
  g.save();
  g.font = `300 ${size}px Georgia,"Times New Roman",serif`;
  g.textAlign = 'left'; g.textBaseline = 'middle';
  g.beginPath(); g.rect(0, 0, x + 12 + g.measureText(h.w).width * u + 4, H); g.clip();
  /* misregistration: the plate is laid down twice, a couple of pixels apart, in the two inks a
     press would be out of register with */
  g.globalAlpha = 0.55; g.fillStyle = rgba(pal.accent, 0.6); g.fillText(h.w, x - 5, y + 3);
  g.fillStyle = rgba(pal.glow, 0.55); g.fillText(h.w, x + 5, y - 3);
  g.globalAlpha = 1; g.fillStyle = rgba(pal.rim, 0.95); g.fillText(h.w, x, y);
  g.restore();
  g.save();
  g.globalAlpha = clamp(u * 2); g.fillStyle = rgba(pal.rim, 0.34);
  g.font = `300 ${Math.round(size * 0.19)}px Georgia,serif`;
  g.textBaseline = 'middle';
  g.fillText(h.cn, x + 2, y + size * 0.62);
  g.restore();
}

window.MVL = { melody, display, pitch, beatAt, onBar, hooks, LOOK };
})();
