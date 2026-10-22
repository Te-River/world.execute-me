/* mv/line.js — the two things that come from the recording rather than from the lyric.

   1. the melody stroke: one continuous line, always on screen, whose height is the pitch the
      singer is actually holding. Where the lyric names a shape — a circle, a sine, a limit that
      never arrives, a heart, a network — the newest seconds of that same stroke curl into it and
      carry on. The film therefore has one graphic idea that transforms, not eighteen diagrams.
   2. the display word: the hook word being sung (the ALL-CAPS lines of the lyric) set as a
      typographic mass in the room, revealed across the note that carries it, with print
      misregistration. In this genre the text belongs to the picture, not under it.

   Plus the beat clock the camera is locked to: bar phase, downbeat, measured onset weight.
   window.MUSIC comes from analysis/music.html; the chord decode is deliberately unused — its
   bar-by-bar results (a B-flat-heavy loop for an A-minor song) did not survive checking. */
(() => {
'use strict';
const M = window.MUSIC, META = M.meta, HOP = META.hop / META.sr;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const LOOK = 7.2;                                   /* seconds of contour visible behind the head */
const HEAD = 0.86;                                  /* the head sits here, so shapes have room */
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
  const q = ((a + (b - a) * f) + (a + b) * 0.25) / 2.5 / 255 * HI;
  return q > LO ? q : 0;
}
function beatAt(t) {
  const B = M.beat;
  let i = 0, lo = 0, hi = B.length - 1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (B[m] <= t) { i = m; lo = m + 1; } else hi = m - 1; }
  const next = B[i + 1] === undefined ? B[i] + 60 / META.bpm : B[i + 1];
  return { i, t0: B[i], next, phase: clamp((t - B[i]) / (next - B[i]), 0, 1),
           w: (M.beatOn[i] || 0) / 255, bar: Math.floor((i - META.root) / 4),
           barT0: B[Math.max(0, i - (((i - META.root) % 4 + 4) % 4))],
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

/* ---------------- the shapes the line takes ---------------- */
/* Deliberately NOT the things the page diagrams. The sheet already draws the circle, the sine,
   the limit, the heart and the network, labelled — that is the proof. If the stroke took the
   same shapes the film would have two of everything, which is the clutter this line replaced.
   So the line only ever forms the three figures the page cannot: the dome of PROTECTION, the
   picket of the EXECUTION chant, and the flat horizon the held LO-O-OVE keeps reaching for. */
const SHAPES = [
  { at: 13.89, d: 2.4, kind: 'loop', note: 'let us begin the SIMULATION' },
  { at: 147.66, d: 7.4, kind: 'bars', note: 'EXECUTION x 12' },
  { at: 187.66, d: 3.2, kind: 'flat', note: 'LO-O-OVE, held' },
];
function shapePath(kind, s) {
  if (kind === 'loop') { const a = -Math.PI / 2 + s * Math.PI * 2; return [Math.cos(a), Math.sin(a) * 0.82]; }
  if (kind === 'bars') return [s * 2 - 1, (Math.floor(s * 9) % 2 ? -0.82 : 0.82)];
  if (kind === 'flat') return [s * 2 - 1, -0.5];             /* the asymptote, at last */
  return [0, 0];
}
/* how deep into a shape a *point* is, given when the line was drawn there. The blend is a
   property of the point, not of the playhead: the stroke draws the figure once and then carries
   it leftwards, unwinding back into pitch as it nears the edge of the frame. Gating on the
   playhead instead made the whole figure snap back to the line in one frame. */
function shapeBlend(u) {
  for (const sh of SHAPES) {
    const s = (u - sh.at) / sh.d;
    if (s < 0 || s > 1) continue;
    return { kind: sh.kind, s };
  }
  return null;
}

/* ---------------- the melody stroke ---------------- */
function melody(g, t, W, H, pal, camZ) {
  const rail = H * 0.665, span = H * 0.215;
  const xOf = (u) => (u - (t - LOOK)) / LOOK * W * HEAD;
  const yOf = (hz) => rail - clamp(Math.log2(Math.max(LO, hz) / LO) / Math.log2(HI / LO), 0, 1) * span;
  const step = LOOK / 900;
  let shown = null;
  const pts = [];
  for (let u = t - LOOK; u <= t + 1e-6; u += step) {
    const hz = pitch(u);
    /* quantised to the semitone it is singing, so a held note is one flat run instead of a
       scatter of near-equal samples — the raw contour reads as a barcode at this compression */
    let x = xOf(u), y = hz ? yOf(55 * Math.pow(2, Math.round(12 * Math.log2(hz / 55)) / 12)) : rail, live = hz > 0;
    const sh = shapeBlend(u);
    if (sh) {
      /* park the figure in the dark band to the right of the sheet. The page already carries the
         labelled diagram — the proof — so the stroke's shape must not compete with it; the line
         is the performance, and it takes the shape it is singing about out in the room. */
      const rad = Math.min(span * 0.5, W * 0.075);
      const wide = sh.kind === 'bars' || sh.kind === 'flat';
      const ax = rad * (wide ? 2.2 : 1), ay = rad * (wide ? 0.7 : 1);
      const sx = W * 0.875, cy = rail - span * 0.52;
      const q = shapePath(sh.kind, sh.s);
      const unwind = clamp((t - u - (LOOK - 2.4)) / 1.5, 0, 1);
      const k = clamp(sh.s / 0.06, 0, 1) * (1 - unwind);
      x = lerp(x, sx + q[0] * ax, k);
      y = lerp(y, cy + q[1] * ay, k);
      live = true;
      if (k > 0.25) shown = sh.kind;
    }
    pts.push({ x, y, live, u });
  }
  /* fade each run in and out over 0.12 s at its ends, so a note starting or stopping cannot
     register as a one-frame flash — the sweep caught exactly that at 50.16 s */
  const RAMP = 0.12;
  for (let i = 0; i < pts.length; i++) {
    if (!pts[i].live) { pts[i].a = 0; continue; }
    let d = 0;
    while (d < 8 && pts[i - d - 1] && pts[i - d - 1].live) d++;
    const back = d * step;
    let e = 0;
    while (e < 8 && pts[i + e + 1] && pts[i + e + 1].live) e++;
    pts[i].a = clamp(Math.min(back, e) / RAMP, 0, 1);
  }
  const stroke = (mirror, base, dash) => {
    g.save();
    g.strokeStyle = rgba(mirror ? pal.glow : pal.rim, base);
    g.lineWidth = mirror ? 1.2 : 2.3; g.lineJoin = 'round'; g.lineCap = 'round';
    if (dash) g.setLineDash([7, 9]);
    let run = [];
    const flush = () => {
      if (run.length > 1) {
        let a = 0;
        for (const p of run) a = Math.max(a, p.a);
        if (a > 0.02) {
          g.globalAlpha = a;
          g.beginPath();
          run.forEach((p, i) => { const y = mirror ? rail + (rail - p.y) * 0.62 : p.y;
            i ? g.lineTo(p.x, y) : g.moveTo(p.x, y); });
          g.stroke();
        }
      }
      run = [];
    };
    for (const p of pts) {
      if (!p.live) { flush(); continue; }
      /* a leap bigger than a fourth is not a slide, it is two notes: end the run, leave the gap */
      if (run.length && (Math.abs(p.a - run[run.length - 1].a) > 0.12 ||
          Math.abs(p.y - run[run.length - 1].y) > H * 0.03)) flush();
      run.push(p);
    }
    flush(); g.restore();
  };
  stroke(false, 0.62, false);                                 /* the sung line: one solid stroke */
  stroke(true, 0.2, true);                                    /* its reflection: dashed, faint */
  g.strokeStyle = rgba(pal.rim, 0.1); g.lineWidth = 1;
  g.beginPath(); g.moveTo(0, rail); g.lineTo(W, rail); g.stroke();
  const last = pts[pts.length - 1], hy = last.y;
  g.save(); g.globalCompositeOperation = 'lighter';
  const halo = g.createRadialGradient(last.x, hy, 0, last.x, hy, 46);
  halo.addColorStop(0, rgba(pal.page, last.live ? 0.5 : 0.1)); halo.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = halo; g.fillRect(last.x - 48, hy - 48, 96, 96);
  g.restore();
  g.fillStyle = rgba(last.live ? pal.page : pal.rim, last.live ? 0.9 : 0.25);
  g.beginPath(); g.arc(last.x, hy, last.live ? 3.4 : 2.2, 0, Math.PI * 2); g.fill();
  return { rail, hy, live: last.live, shape: shown };
}

/* ---------------- the display word ---------------- */
let HOOKS = null;
function hooks(LYRICS) {
  if (HOOKS) return HOOKS;
  HOOKS = [];
  LYRICS.forEach((l, i) => {
    /* the ALL-CAPS hooks, plus the title line: sung at 16 s over the only shot that has no
       diagram of its own, which is exactly where a display line belongs */
    const title = l.en.indexOf('world.execute') >= 0;
    if (!title && (!/^[A-Z0-9 .!?-]+$/.test(l.en) || l.en.length < 4)) return;
    const nxt = LYRICS[i + 1];
    HOOKS.push({ w: l.en, from: l.at, to: nxt ? Math.min(nxt.at, l.at + (title ? 5.4 : 3.4)) : l.at + 3.4, cn: l.cn });
  });
  return HOOKS;
}
function display(g, t, W, H, pal, LYRICS, camZ) {
  const hs = hooks(LYRICS);
  const h = hs.find((x) => t >= x.from && t < x.to);
  if (!h) return;
  const u = clamp((t - h.from) / (h.to - h.from), 0, 1);
  /* the tighter the shot, the smaller the word: at z=1.5 the sheet covers most of the frame and
     a full-size word would be invisible behind the light */
  const fit = clamp(1.06 / (camZ || 1), 0.6, 1.06);
  const size = Math.min(H * 0.15, W * 0.11) * fit;
  /* one fixed corner made every sung word the same caption. The anchor rotates with the hook,
     so the type is a thing placed in the frame per shot — and it is allowed to run off the edge,
     which is how the references get their cropped, larger-than-screen words. */
  const ANCH = [[0.045, 0.16, 'left'], [0.5, 0.9, 'center'], [0.045, 0.76, 'left'],
                [0.5, 0.15, 'center'], [0.045, 0.44, 'left'], [0.5, 0.9, 'center']];
  const a = ANCH[hs.indexOf(h) % ANCH.length];
  const x = W * a[0], y = H * a[1];
  g.save();
  g.font = `300 ${size}px Georgia,"Times New Roman",serif`;
  g.textAlign = a[2]; g.textBaseline = 'middle';
  const tw = g.measureText(h.w).width;
  const left = a[2] === 'left' ? x : a[2] === 'right' ? x - tw : x - tw / 2;
  g.beginPath(); g.rect(0, 0, left + 12 + tw * u + 4, H); g.clip();
  g.globalAlpha = 0.55; g.fillStyle = rgba(pal.accent, 0.6); g.fillText(h.w, x - 5, y + 3);
  g.fillStyle = rgba(pal.glow, 0.55); g.fillText(h.w, x + 5, y - 3);
  g.globalAlpha = 1; g.fillStyle = rgba(pal.rim, 0.95); g.fillText(h.w, x, y);
  g.restore();
  g.save();
  g.globalAlpha = clamp(u * 2); g.fillStyle = rgba(pal.rim, 0.34);
  g.font = `300 ${Math.round(size * 0.16)}px Georgia,serif`;
  g.textAlign = a[2]; g.textBaseline = 'middle';
  g.fillText(h.cn, x + 2, y + size * 0.62);
  g.restore();
}

/* ---------------- the machine's own surface ---------------- */
/* Both reference MVs put a telemetry rail on the frame: the machine reports itself, and the
   report carries the story instead of a drawn emotion. Mine is not authored — every value in
   the right column is measured from the MP3 by analysis/music.html, so what the program says
   about its own distance, texture and pitch is literally true at that frame. */
const NOTE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
function noteName(hz) {
  const p = Math.round(12 * Math.log2(hz / 440)) + 69;
  return NOTE[((p % 12) + 12) % 12] + (Math.floor(p / 12) - 1);
}
function chrome(g, t, W, H, pal, F) {
  const bt = beatAt(t), hz = pitch(t), flat = F ? F[14] : 0, rms = F ? F[8] : 0;   /* calibrated 0..1 */
  const rows = [
    ['state', t < 131.2 ? 'RUNNING' : t < 147.66 ? 'HALTED' : t < 169.82 ? 'SENTENCED' : t < 193 ? 'REWINDING' : 'EXITING'],
    ['heart()', t < 124.89 ? 'uninitialised' : 'null'],
    ['you()', t < 110.9 ? 'present' : 'null'],
    ['pitch()', hz ? Math.round(hz) + ' Hz  ' + noteName(hz) : '— unvoiced'],
    ['texture()', flat > 0.42 ? 'noise-like  ' + flat.toFixed(2) : 'tonal  ' + flat.toFixed(2)],
    ['limit()', t < 184.54 ? 'not reached' : 'you'],
  ];
  /* The panel is the machine narrating itself, but on every frame it turned the film into a
     dashboard — the contact sheet's right third was grey mush in all nine shots. It reports during
     the acts where the machine is the subject and keeps out of the way while she is singing. */
  const RAIL = [[0, 29.7], [110.9, 177.24], [193, 212.4]];
  let vis = 0;
  for (const r of RAIL) vis = Math.max(vis, Math.min(clamp((t - r[0]) / 0.9, 0, 1), clamp((r[1] - t) / 0.9, 0, 1)));
  g.save();
  g.globalAlpha = vis;
  const y0 = H * 0.155, dy = H * 0.041;
  /* the panel sits on a scrim: the sheet is the brightest thing in the room and light-on-light
     text over it is unreadable, so the rail carries its own shadow */
  const sx = W * 0.72;
  const scrim = g.createLinearGradient(sx, 0, W, 0);
  scrim.addColorStop(0, 'rgba(0,0,0,0)'); scrim.addColorStop(0.35, rgba(pal.room0, 0.82));
  scrim.addColorStop(1, rgba(pal.room0, 0.94));
  g.fillStyle = scrim; g.fillRect(sx, y0 - dy, W - sx, rows.length * dy + dy * 1.6);
  g.font = `${Math.max(11, Math.round(H * 0.0147))}px ui-monospace,Consolas,monospace`;
  g.textBaseline = 'middle';
  rows.forEach((r, i) => {
    const yy = y0 + i * dy, a = 0.42 + 0.12 * Math.sin((t * 1.6) + i);
    g.textAlign = 'left'; g.fillStyle = rgba(pal.rim, a * 0.6); g.fillText(r[0], W * 0.775, yy);
    g.textAlign = 'right'; g.fillStyle = r[1] === 'null' ? rgba(pal.accent, 0.85) : rgba(pal.rim, a);
    g.fillText(r[1], W * 0.972, yy);
    g.strokeStyle = rgba(pal.rim, 0.07); g.lineWidth = 1;
    g.beginPath(); g.moveTo(W * 0.775, yy + dy * 0.5); g.lineTo(W * 0.972, yy + dy * 0.5); g.stroke();
  });
  g.globalAlpha = 1;
  /* the beat rail: the next eight bars, printed as ticks, with the playhead in the middle */
  /* the beat rail: mapped by continuous time so it scrolls smoothly under a fixed playhead.
     Indexing it by beat made the whole rail jump one tick sideways on every beat — the sweep
     read that as two unattributed flashes, and the eye reads it as a stutter. */
  const ry = H * 0.062, win = 32 * (60 / META.bpm);
  let first = 0; while (first < M.beat.length - 1 && M.beat[first] < t - win / 2) first++;
  let lastN = first; while (lastN < M.beat.length - 1 && M.beat[lastN] < t + win / 2) lastN++;
  for (let i = first; i <= lastN; i++) {
    const u = (M.beat[i] - t) / win + 0.5;
    if (u < 0 || u > 1) continue;
    const x = W * 0.032 + u * (W * 0.936);
    const inBar = ((i - META.root) % 4 + 4) % 4;
    const near = Math.abs(M.beat[i] - t) < 60 / META.bpm * 0.5;
    const w = (M.beatOn[i] || 0) / 255;
    g.strokeStyle = rgba(near ? pal.accent : pal.rim, near ? 0.95 : inBar === 0 ? 0.42 : 0.2);
    g.lineWidth = near ? 2.4 : inBar === 0 ? 1.8 : 1;
    const h = (inBar === 0 ? 13 : 7) + w * 9;
    g.beginPath(); g.moveTo(x, ry - h / 2); g.lineTo(x, ry + h / 2); g.stroke();
  }
  g.textAlign = 'left'; g.fillStyle = rgba(pal.rim, 0.4);
  g.fillText('bar ' + (bt.bar + 1) + '   ' + META.bpm.toFixed(2) + ' bpm   4/4', W * 0.032, ry - H * 0.03);
  g.textAlign = 'right'; g.fillStyle = rgba(pal.accent, 0.55);
  g.fillText('world.execute(me);', W * 0.968, ry - H * 0.03);
  /* the level meter, driven by measured loudness */
  const mw = W * 0.16, mx = W * 0.032, my = H * 0.93;
  g.fillStyle = rgba(pal.rim, 0.1); g.fillRect(mx, my, mw, 3);
  g.fillStyle = rgba(pal.accent, 0.7); g.fillRect(mx, my, mw * clamp(rms * 1.6, 0, 1), 3);
  g.restore();
}

window.MVL = { melody, display, chrome, pitch, beatAt, onBar, hooks, SHAPES, LOOK, noteName };

})();
