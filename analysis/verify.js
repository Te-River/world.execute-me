/* analysis/verify.js — frame-exact verification harness for the film.
 *
 * Why this exists: the MV is driven by an audio clock, and a media seek has to round-trip
 * before track.currentTime moves, so you cannot check the picture one frame at a time by
 * scrubbing. mv/mv.js exposes window.MV {pin, step, cam} for exactly that; this file walks
 * every frame of the song at 60 fps, measures the rendered pixels, and reports.
 *
 * What it measures, per frame:
 *   lum  mean of the max channel  — catches black frames and blown-out flashes
 *   sat  mean HSV saturation      — catches passages that drained to grey
 *   dif  mean |delta| vs the previous frame — the symptom of motion, including any motion
 *        nobody asked for. This is how "去掉无意义的抖动" gets checked instead of argued.
 *   pan  |camera x delta| + |camera y delta| — the cause-level readout of the same thing
 *   det  mean absolute gradient of luma inside the frame — how busy the picture is. Added
 *        for "整个画面太乱了": clutter stopped being an opinion once it had a number.
 *
 * Note on resolution: the analysis data is 21.3 ms per frame (46.9 fps), so at 60 fps some
 * frames differ only by interpolation. 60 fps is still the right sampling rate — it is the
 * rate the picture is *displayed* at, and a one-frame flicker is invisible at 47 fps.
 *
 * Use it from the console on index.html served over http (it needs to POST the sheets):
 *   document.head.appendChild(Object.assign(document.createElement('script'),
 *     { src: '/analysis/verify.js' }))
 *   VERIFY.start()            // returns immediately, sweeps in the background
 *   VERIFY.status()           // {n, N, done}
 *   await VERIFY.report()     // writes verify-60fps.png + sheet-a/b.jpg via POST /save-*
 */
(() => {
'use strict';

const RATE = 60, RW = 120, RH = 68;     // default sampling rate; the readout window size
const COLS = 8, CW = 200, CH = 113;     // contact-sheet cell grid, one cell per second
const LIMITS = { dark: 8, blown: 247, motionJump: 70, panJump: 26 };
/* A flicker is not "the picture moved". It is motion that arrives as an isolated spike:
   one or two frames of change, then nothing, again and again — an element appearing,
   vanishing, or being re-driven by a value that only updates at the analysis hop rate.
   Smooth animation produces runs of change, not spikes, so the shape of the signal
   separates them. Sampling has to be finer than the display to see it at all: at 60 fps a
   one-frame pulse is either missed or looks like a cut. */
const FLICKER = { over: 7, under: 3, run: 2 };

let S = null;

function fitRect() {
  const stage = document.getElementById('stage'), SD = window.SCENE_SPACE;
  const fit = Math.min(stage.width / SD.DW, stage.height / SD.DH);
  const dw = SD.DW * fit, dh = SD.DH * fit;
  return [stage, (stage.width - dw) / 2, (stage.height - dh) / 2, dw, dh];
}

function sheet(rows) {
  const c = document.createElement('canvas');
  c.width = COLS * CW; c.height = rows * CH;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
  return c;
}

function start(rate) {
  rate = rate || RATE;
  const track = document.getElementById('track');
  track.pause();
  document.getElementById('start').classList.add('off');
  const DUR = window.SCORE.meta.duration, N = Math.ceil(DUR * rate);
  const [stage, ox, oy, dw, dh] = fitRect();
  const rc = document.createElement('canvas'); rc.width = RW; rc.height = RH;
  const rg = rc.getContext('2d', { willReadFrequently: true });
  const prev = new Float32Array(RW * RH * 3);
  const luma = new Float32Array(RW * RH);
  const secs = Math.ceil(DUR);

  S = {
    N, DUR, rate, n: 0, done: false, t0: performance.now(), flags: [],
    lum: new Uint8Array(N), sat: new Uint8Array(N), dif: new Uint8Array(N), det: new Uint8Array(N),
    pdx: new Uint8Array(N), pdy: new Uint8Array(N), cz: new Float32Array(N),
    sheetA: sheet(Math.min(14, Math.ceil(106 / COLS))), sheetB: sheet(14)
  };
  let camx = 0, camy = 0;

  function cell(canvas, k, t) {
    const g = canvas.getContext('2d'), x0 = (k % COLS) * CW, y0 = Math.floor(k / COLS) * CH;
    g.drawImage(stage, ox, oy, dw, dh, x0, y0, CW, CH);
    g.strokeStyle = 'rgba(255,255,255,.3)'; g.strokeRect(x0 + .5, y0 + .5, CW - 1, CH - 1);
    g.fillStyle = '#fff'; g.font = '11px monospace'; g.textAlign = 'left'; g.textBaseline = 'top';
    g.fillText(t + 's', x0 + 4, y0 + 3);
  }

  function frame(f) {
    const t = f / rate;
    window.MV.pin(t);
    window.MV.step(f * 1000 / rate);
    const c = window.MV.cam(t);
    S.cz[f] = c.z;
    if (f > 0) {
      S.pdx[f] = Math.min(255, Math.round(Math.abs(c.x - camx) * 8));
      S.pdy[f] = Math.min(255, Math.round(Math.abs(c.y - camy) * 8));
    }
    camx = c.x; camy = c.y;
    rg.fillStyle = '#000'; rg.fillRect(0, 0, RW, RH);
    rg.drawImage(stage, ox, oy, dw, dh, 0, 0, RW, RH);
    const im = rg.getImageData(0, 0, RW, RH).data;
    let lum = 0, sat = 0, dif = 0;
    for (let i = 0, p = 0, k = 0; i < im.length; i += 4, p += 3, k++) {
      const r = im[i], g2 = im[i + 1], b = im[i + 2];
      const mx = Math.max(r, g2, b), mn = Math.min(r, g2, b);
      lum += mx;
      sat += mx ? (mx - mn) / mx * 255 : 0;
      dif += Math.abs(r - prev[p]) + Math.abs(g2 - prev[p + 1]) + Math.abs(b - prev[p + 2]);
      prev[p] = r; prev[p + 1] = g2; prev[p + 2] = b;
      luma[k] = r * 0.299 + g2 * 0.587 + b * 0.114;
    }
    let grad = 0, gn = 0;
    for (let y = 0; y < RH; y++) {
      for (let x = 0; x < RW - 1; x++) { grad += Math.abs(luma[y * RW + x + 1] - luma[y * RW + x]); gn++; }
    }
    for (let y = 0; y < RH - 1; y++) {
      for (let x = 0; x < RW; x++) { grad += Math.abs(luma[(y + 1) * RW + x] - luma[y * RW + x]); gn++; }
    }
    const npx = im.length / 4;
    S.lum[f] = Math.round(lum / npx);
    S.sat[f] = Math.round(sat / npx);
    S.dif[f] = Math.min(255, Math.round(dif / npx / 3));
    S.det[f] = Math.min(255, Math.round(grad / gn * 8));
    const k = Math.floor(t);
    if (f % rate === 0 && k < secs) cell(k < 106 ? S.sheetA : S.sheetB, k < 106 ? k : k - 106, k);
  }

  let f = 0;
  const ch = new MessageChannel();
  /* A message port per frame keeps the sweep fast but can starve every other task source:
     once the frames got cheap enough to draw in ~2 ms, the page stopped answering the
     console. Every YIELD frames, hand off through a timer so the tab stays usable. */
  const YIELD = 600;
  ch.port1.onmessage = () => {
    try { frame(f); }
    catch (e) { S.flags.push([f, 'threw', e.message]); }
    f++; S.n = f;
    if (f >= S.N) { S.done = true; return; }
    if (f % YIELD === 0) setTimeout(() => ch.port2.postMessage(0), 0);
    else ch.port2.postMessage(0);
  };
  ch.port2.postMessage(0);
  return { frames: N, fps: rate, seconds: +DUR.toFixed(2) };
}

function status() {
  return S ? { n: S.n, N: S.N, done: S.done, flags: S.flags.length,
               seconds: +((performance.now() - S.t0) / 1000).toFixed(1) } : { started: false };
}

function stats() {
  const ACTS = window.STORY.acts, N = S.N, rate = S.rate;
  const flags = S.flags.slice();
  for (let f = 1; f < N; f++) {
    const pan = S.pdx[f] + S.pdy[f];
    if (S.lum[f] < LIMITS.dark) flags.push([f, 'dark', S.lum[f]]);
    else if (S.lum[f] > LIMITS.blown) flags.push([f, 'blown', S.lum[f]]);
    if (S.dif[f] > LIMITS.motionJump) flags.push([f, 'motion-jump', S.dif[f]]);
    if (pan > LIMITS.panJump) flags.push([f, 'pan-jump', pan]);
  }
  flags.sort((a, b) => a[0] - b[0]);
  const perAct = ACTS.map((a) => {
    const f0 = Math.round(a.from * rate), f1 = Math.min(N, Math.round(a.to * rate));
    let dm = 0, dp = 0, dt = 0, dmax = 0, pmax = 0, n = 0, lmin = 255, smin = 255;
    const ds = [];
    for (let f = f0; f < f1; f++) {
      ds.push(S.dif[f]); dm += S.dif[f]; dp += S.pdx[f] + S.pdy[f]; dt += S.det[f];
      dmax = Math.max(dmax, S.dif[f]); pmax = Math.max(pmax, S.pdx[f] + S.pdy[f]);
      lmin = Math.min(lmin, S.lum[f]); smin = Math.min(smin, S.sat[f]); n++;
    }
    ds.sort((x, y) => x - y);
    return { act: a.tag, from: a.from, frames: n,
             motion: +(dm / n).toFixed(1), motionP95: ds[Math.floor(n * 0.95)], motionMax: dmax,
             detail: +(dt / n).toFixed(1),
             pan: +(dp / n).toFixed(1), panMax: pmax, minLum: lmin, minSat: smin };
  });
  return { flags, perAct, fl: flickers() };
}

/* Isolated spikes: one or two frames of change with silence on both sides. That is what a
   flicker looks like in the signal, but a spike on its own is not yet a bug — a cut is also a
   spike — so each one is attributed before it is counted:
     dissolve   within 1.5 s of a scene join, i.e. inside the cross-fade window (max 1.15 s)
     hard-cut   inside a scene that declares cut:true, which is the chant's editing grammar
     FLASH      anywhere else: an element that appears, disappears or is re-driven mid-shot
   Only FLASH counts against the film. The run-length test already rejects ordinary animation,
   which changes for many consecutive frames. */
function flickers() {
  const N = S.N, rate = S.rate, SCENES = window.SCENES, out = [];
  for (let f = 1; f < N - 2; f++) {
    if (S.dif[f] <= FLICKER.over) continue;
    let a = f, b = f;
    while (a > 1 && S.dif[a - 1] > FLICKER.over) a--;
    while (b < N - 3 && S.dif[b + 1] > FLICKER.over) b++;
    if (b - a + 1 > FLICKER.run) { f = b; continue; }
    if (S.dif[a - 1] > FLICKER.under || S.dif[b + 1] > FLICKER.under) { f = b; continue; }
    const t = a / rate;
    const sc = SCENES.find((s) => t >= s.from && t < s.to);
    /* A beat-cut is a deliberate edit, not a bug, and the gate has to be able to tell them apart
       without taking my word for it. Two things must both hold: the spike coincides (within 2
       frames) with an entry in the published cut list - which is itself derived only from measured
       beats - AND the camera moved discontinuously at that frame, which is what a cut is. An
       element popping without the camera moving stays a FLASH. */
    const bc = (window.CUTS || []).find((c) => Math.abs(c.at - t) < 2 / rate);
    const camJump = (S.pdx[a] || 0) + (S.pdy[a] || 0) > 40;
    const cause = sc && sc.cut ? 'hard-cut'
      : SCENES.some((s) => Math.abs(t - s.from) < 1.5) ? 'dissolve'
      : (bc && camJump) ? 'beat-cut' : 'FLASH';
    out.push({ f: a, t: +t.toFixed(3), run: b - a + 1, peak: S.dif[a],
               scene: sc ? sc.id : '-', cause: cause });
    f = b + 1;
  }
  return out;
}

/* A frame at print resolution. The in-app viewport is only 638 px wide, so the stage's
   backing store has to be asked for explicitly: set the CSS box, let mv.js's resize()
   recompute it from devicePixelRatio, and the 16:9 design space then fills 2400x1350. */
async function shot(t, name) {
  const cv = document.getElementById('stage'), prevStyle = cv.getAttribute('style') || '';
  cv.style.cssText = 'position:fixed;left:0;top:0;width:1920px;height:1080px';
  dispatchEvent(new Event('resize'));
  window.MV.pin(t);
  window.MV.step(t * 1000);
  const px = [cv.width, cv.height];
  const jpg = /\.jpe?g$/i.test(name);
  const blob = await new Promise((r) => cv.toBlob(r, jpg ? 'image/jpeg' : 'image/png', 0.94));
  await fetch('/save-' + name, { method: 'POST', body: blob });
  cv.setAttribute('style', prevStyle);
  dispatchEvent(new Event('resize'));
  return { name: name, px: px, bytes: blob.size };
}

function chart(W, H) {
  const N = S.N, DUR = S.dur || S.DUR, ACTS = window.STORY.acts;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#0d0f14'; g.fillRect(0, 0, W, H);
  const strips = [
    ['luminance  0-255', (f) => S.lum[f], '#8ab4f8'],
    ['saturation  0-255', (f) => S.sat[f], '#f38ba8'],
    ['frame-to-frame motion', (f) => S.dif[f], '#a6e3a1'],
    ['camera pan rate', (f) => Math.min(255, S.pdx[f] + S.pdy[f]), '#ffd166'],
    ['detail  (how busy the frame is)', (f) => S.det[f], '#cdd6f4']
  ];
  const PW = W - 70, HH = 128;
  strips.forEach((s, si) => {
    const y0 = 40 + si * 148;
    g.fillStyle = '#cdd6f4'; g.font = '12px monospace'; g.fillText(s[0], 8, y0 - 8);
    g.strokeStyle = '#313244'; g.strokeRect(60.5, y0 + .5, PW - .5, HH);
    const px = g.createImageData(PW, HH);
    const col = [parseInt(s[2].slice(1, 3), 16), parseInt(s[2].slice(3, 5), 16), parseInt(s[2].slice(5, 7), 16)];
    for (let x = 0; x < PW; x++) {
      const f0 = Math.floor(x / PW * N), f1 = Math.max(f0 + 1, Math.floor((x + 1) / PW * N));
      let mn = 1e9, mx = -1e9, sum = 0;
      for (let f = f0; f < f1; f++) { const v = s[1](f); if (v < mn) mn = v; if (v > mx) mx = v; sum += v; }
      for (let y = 0; y < HH; y++) {
        const hi = 255 - y * 255 / HH, lo = 255 - (y + 1) * 255 / HH;
        if (mx >= lo && mn <= hi) {
          const i = (y * PW + x) * 4;
          px.data[i] = col[0]; px.data[i + 1] = col[1]; px.data[i + 2] = col[2]; px.data[i + 3] = 150;
        }
      }
      const my = HH - 1 - Math.round(sum / (f1 - f0) / 255 * (HH - 1));
      const i = (my * PW + x) * 4;
      px.data[i] = col[0]; px.data[i + 1] = col[1]; px.data[i + 2] = col[2]; px.data[i + 3] = 255;
    }
    g.putImageData(px, 61, y0);
  });
  g.font = '10px monospace';
  for (const a of ACTS) {
    const x = 61 + Math.floor(a.from / DUR * PW);
    g.strokeStyle = 'rgba(205,214,244,.22)';
    g.beginPath(); g.moveTo(x, 36); g.lineTo(x, H - 14); g.stroke();
    g.save(); g.translate(x + 4, H - 18); g.fillStyle = '#6c7086'; g.fillText(a.tag, 0, 0); g.restore();
  }
  g.fillStyle = '#cdd6f4'; g.font = '11px monospace';
  for (let t = 0; t <= DUR; t += 20) g.fillText(t + 's', 61 + Math.floor(t / DUR * PW) - 8, H - 3);
  return c;
}

async function post(name, canvas, type, q) {
  const blob = await new Promise((r) => canvas.toBlob(r, type, q));
  await fetch('/save-' + name, { method: 'POST', body: blob });
  return blob.size;
}

async function report() {
  const { flags, perAct, fl } = stats();
  const chartName = 'verify-' + S.rate + 'fps.png';
  const sizes = {
    [chartName]: await post(chartName, chart(1600, 800), 'image/png'),
    'sheet-a.jpg': await post('sheet-a.jpg', S.sheetA, 'image/jpeg', 0.86),
    'sheet-b.jpg': await post('sheet-b.jpg', S.sheetB, 'image/jpeg', 0.86)
  };
  return JSON.stringify({ frames: S.N, fps: S.rate, seconds: +S.DUR.toFixed(2),
    flags: flags.length, spikes: fl.length,
    byCause: fl.reduce((m, x) => { const c = (m[x.cause] = m[x.cause] || { n: 0, max: 0 });
      c.n++; c.max = Math.max(c.max, x.peak); return m; }, {}),
    flashes: fl.filter((x) => x.cause === 'FLASH'),
    perAct, sizes });
}

/* What the recording is actually made of, per 10 s: the share of energy above ~2 kHz
   (attack noise: the kit, the consonants, the chiptune edge), the median spectral flatness
   (tonal vs noisy), the median centroid, and how much of the span carries a pitch at all.
   Asked because the band's own description — electronica, classical, game music, YMO —
   predicts two contrasting textures, and the picture should not pretend it is one thing. */function timbre(step) {
  const S = window.SCORE, M = S.meta, HOP = M.hopMs / 1000;
  const dec = (s) => { const x = atob(s), u = new Uint8Array(x.length); for (let i = 0; i < x.length; i++) u[i] = x.charCodeAt(i); return u; };
  const B = [];
  for (let k = 0; k < 8; k++) B.push(dec(S.frames['b' + k]));
  const cen = dec(S.frames.centroid), flt = dec(S.frames.flat), voi = dec(S.frames.voiced);
  const n = B[0].length, out = [];
  const med = (a) => { const x = a.slice().sort((p, q) => p - q); return x[Math.floor(x.length / 2)]; };
  for (let t = 0; t < M.duration; t += step) {
    const f0 = Math.floor(t / HOP), f1 = Math.min(n, Math.floor((t + step) / HOP));
    const hi = [], fl = [], cn = [];
    let voiced = 0, c = 0;
    for (let f = f0; f < f1; f++) {
      let tot = 0;
      for (let k = 0; k < 8; k++) tot += B[k][f];
      hi.push((B[6][f] + B[7][f]) / (tot || 1) * 100);
      fl.push(flt[f]); cn.push(cen[f]);
      if (voi[f] > 145) voiced++;
      c++;
    }
    if (!c) continue;
    out.push({ t: t, hiShare: Math.round(med(hi)), flat: Math.round(med(fl)),
               cen: Math.round(med(cn)), voicedPct: Math.round(voiced / c * 100) });
  }
  return out;
}

/* Eight frames, one per kind of moment, stepped and checked for a throw. Cheap enough to run
   before the 250-second sweep and worth it: a ReferenceError in the camera maths made every
   frame of one sweep throw, and this catches that in a second instead of at the end. */
function smoke() {
  const ts = [0.5, 4, 33, 50.2, 118, 150, 189, 210], errs = [];
  for (const t of ts) { try { window.MV.pin(t); window.MV.step(t * 1000); } catch (e) { errs.push(t + ': ' + e.message); } }
  return errs.length ? errs : ['ok'];
}

/* ---------------- looking, at the frame level ---------------- */
/* Everything else in this file reduces a frame to a handful of scalars, and scalars hide the
   specific thing that ruins a picture: a layer that strobes in one corner contributes almost
   nothing to a whole-frame mean. These two functions stop summarising. Both render the stage at
   1080P and step the clock at 360 fps, so adjacent frames are 2.8 ms apart - closer than any
   display will ever show the film. */
function stage1080() {
  const cv = document.getElementById('stage');
  cv.style.cssText = 'position:fixed;left:0;top:0;width:1920px;height:1080px';
  dispatchEvent(new Event('resize'));
  return cv;
}
function grab(cv, scratch) {
  const q = scratch.getContext('2d');
  q.clearRect(0, 0, scratch.width, scratch.height);
  q.drawImage(cv, 0, 0);
  return q.getImageData(0, 0, scratch.width, scratch.height).data;
}

/* For every pixel, the largest change it showed between any two adjacent frames of the burst. */
async function burst(t0, n, name, rate) {
  rate = rate || 360;
  const cv = stage1080(), W = cv.width, H = cv.height, N = W * H;
  const scratch = document.createElement('canvas'); scratch.width = W; scratch.height = H;
  const acc = new Float32Array(N);
  let prev = null;
  for (let i = 0; i < n; i++) {
    const t = t0 + i / rate;
    window.MV.pin(t); window.MV.step(t * 1000);
    const d = grab(cv, scratch);
    if (prev) for (let p = 0, q = 0; p < N; p++, q += 4) {
      const v = Math.abs(d[q] - prev[q]) + Math.abs(d[q + 1] - prev[q + 1]) + Math.abs(d[q + 2] - prev[q + 2]);
      if (v > acc[p]) acc[p] = v;
    }
    prev = d.slice();
  }
  /* the heat map, plus a grid so the answer is also a number and not only a picture */
  const out = document.createElement('canvas'); out.width = W; out.height = H;
  const g = out.getContext('2d'), im = g.createImageData(W, H);
  let sum = 0, peak = 0, hist = new Float32Array(40), gx = 8, gy = 5;
  const cell = new Float32Array(gx * gy), cellN = new Float32Array(gx * gy);
  for (let p = 0; p < N; p++) {
    const v = acc[p]; sum += v; if (v > peak) peak = v;
    hist[Math.min(39, v >> 2)]++;
    const x = p % W, y = (p / W) | 0;
    const ci = ((y * gy / H) | 0) * gx + ((x * gx / W) | 0);
    cell[ci] += v; cellN[ci]++;
    const c = Math.min(255, v * 5);
    const o = p * 4;
    im.data[o] = c; im.data[o + 1] = Math.min(255, c * 0.45); im.data[o + 2] = 0; im.data[o + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  const blobs = [];
  for (let i = 0; i < cell.length; i++) if (cellN[i]) {
    blobs.push({ cell: (i % gx) + ',' + ((i / gx) | 0), mean: +(cell[i] / cellN[i]).toFixed(1) });
  }
  blobs.sort((a, b) => b.mean - a.mean);
  const blob = await new Promise((r) => out.toBlob(r, 'image/jpeg', 0.93));
  await fetch('/save-' + name, { method: 'POST', body: blob });
  return { t0: t0, n: n, rate: rate, px: W + 'x' + H, mean: +(sum / N).toFixed(1), peak: peak | 0,
           hotCells: blobs.slice(0, 5), quietPct: +(hist[0] / N * 100).toFixed(1) };
}

/* The consecutive frames themselves, tiled, so the sequence can actually be read. */
async function strip(t0, n, name, rate, cols) {
  rate = rate || 360; cols = cols || 3;
  const cv = stage1080(), W = cv.width, H = cv.height;
  const scratch = document.createElement('canvas'); scratch.width = W; scratch.height = H;
  const cw = 640, ch = 360, rows = Math.ceil(n / cols);
  const out = document.createElement('canvas'); out.width = cols * cw; out.height = rows * ch;
  const g = out.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, out.width, out.height);
  for (let i = 0; i < n; i++) {
    const t = t0 + i / rate;
    window.MV.pin(t); window.MV.step(t * 1000);
    g.drawImage(cv, (i % cols) * cw, ((i / cols) | 0) * ch, cw, ch);
    g.strokeStyle = '#2a2a2a'; g.strokeRect((i % cols) * cw, ((i / cols) | 0) * ch, cw, ch);
    g.fillStyle = '#fff'; g.font = '18px ui-monospace,monospace';
    g.fillText('+' + (i / rate * 1000).toFixed(1) + 'ms', (i % cols) * cw + 8, ((i / cols) | 0) * ch + 24);
  }
  const blob = await new Promise((r) => out.toBlob(r, 'image/jpeg', 0.93));
  await fetch('/save-' + name, { method: 'POST', body: blob });
  return { t0: t0, n: n, ms: (n / rate * 1000).toFixed(1), sheet: out.width + 'x' + out.height };
}

/* Is the subject actually in the picture? Reading the study shot back as frames showed the sheet
   pinned against the left edge with its first word cut off - the scene authors a camera target and
   a sheet rectangle separately, and when they disagree the page walks out of frame. This measures
   the disagreement for every scene, in design pixels, using the same projection the renderer uses.
   DW/DH mirror the constants at the top of mv/scenes.js. */
async function framing(step) {
  step = step || 0.25;
  const DW = 1600, DH = 900;
  const cv = document.getElementById('stage');
  cv.style.cssText = 'position:fixed;left:0;top:0;width:1920px;height:1080px';
  dispatchEvent(new Event('resize'));
  const rows = [];
  for (const sc of window.SCENES) {
    let n = 0, cut = 0, worst = 0, worstAt = 0, worstLate = 0, lateAt = 0, offSum = 0, overWorst = 0, overAt = 0;
    for (let t = sc.from + 0.12; t < sc.to - 0.05; t += step) {
      window.SHEET_T = -1;
      window.MV.pin(t); window.MV.step(t * 1000);
      const S = window.SHEET, c = window.MV.cam();
      if (!S || Math.abs(window.SHEET_T - t) > 1e-6 || !c || !c.z) continue;
      const scale = Math.min(cv.width / DW, cv.height / DH) * 1.1 * c.z;
      const halfView = (cv.width / 2) / scale;            /* design px from camera x to the frame edge */
      const half = S.w * 0.38;                            /* page() turns the sheet to 0.76 wide */
      const off = Math.abs(c.x - (S.x + S.w / 2));
      const out = off + half - halfView;
      /* The camera is allowed to let an eighth of the sheet bleed past the frame - that is what an
         extreme close-up looks like - so "outside" alone is not a fault. What is a fault is sitting
         outside the window the bound was told to enforce, which is what `over` measures. */
      const over = Math.max(0, off - Math.min(Math.max(0, halfView - half * 0.88), halfView * 0.16)) / half;
      n++; offSum += over;
      if (out > 0) { cut++; if (out / half > worst) { worst = out / half; worstAt = { t: +t.toFixed(2), z: +c.z.toFixed(2), sw: S.w, reach: +(halfView - half).toFixed(0) }; } }
      if (over > overWorst) { overWorst = over; overAt = { t: +t.toFixed(2), z: +c.z.toFixed(2), sw: S.w, off: +off.toFixed(0), reach: +Math.min(Math.max(0, halfView - half * 0.88), halfView * 0.16).toFixed(0) }; }
      /* the first two thirds of a second belongs to the camera easing onto the new subject, which
         is a move, not a mistake; a shot still cut after that is framed wrong while it stands still */
      if (t > sc.from + 0.7 && out / half > worstLate) { worstLate = out / half; lateAt = { t: +t.toFixed(2), z: +c.z.toFixed(2), sw: S.w, reach: +(halfView - half).toFixed(0) }; }
    }
    if (n) rows.push({ id: sc.id, from: +sc.from.toFixed(1), n: n,
      cutPct: +(cut / n * 100).toFixed(0), worstCutPct: +(worst * 100).toFixed(0), worstAt: worstAt,
      lateCutPct: +(worstLate * 100).toFixed(0), lateAt: lateAt,
      overPct: +(offSum / n * 100).toFixed(0), worstOverPct: +(overWorst * 100).toFixed(0), overAt: overAt });
  }
  window.MV.unpin();
  rows.sort((a, b) => b.worstOverPct - a.worstOverPct || b.lateCutPct - a.lateCutPct);
  return rows;
}

window.VERIFY = { start, status, stats, report, timbre, flickers, shot, smoke, burst, strip, framing };
return 'VERIFY ready';
})();
