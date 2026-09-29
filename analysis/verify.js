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

const FPS = 60, RW = 120, RH = 68;      // the readout window: the frame, downsampled
const COLS = 8, CW = 200, CH = 113;     // contact-sheet cell grid, one cell per second
const LIMITS = { dark: 8, blown: 247, motionJump: 70, panJump: 26 };

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

function start() {
  const track = document.getElementById('track');
  track.pause();
  document.getElementById('start').classList.add('off');
  const DUR = window.SCORE.meta.duration, N = Math.ceil(DUR * FPS);
  const [stage, ox, oy, dw, dh] = fitRect();
  const rc = document.createElement('canvas'); rc.width = RW; rc.height = RH;
  const rg = rc.getContext('2d', { willReadFrequently: true });
  const prev = new Float32Array(RW * RH * 3);
  const luma = new Float32Array(RW * RH);
  const secs = Math.ceil(DUR);

  S = {
    N, DUR, n: 0, done: false, t0: performance.now(), flags: [],
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
    const t = f / FPS;
    window.MV.pin(t);
    window.MV.step(f * 1000 / FPS);
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
    if (f % FPS === 0 && k < secs) cell(k < 106 ? S.sheetA : S.sheetB, k < 106 ? k : k - 106, k);
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
  return { frames: N, fps: FPS, seconds: +DUR.toFixed(2) };
}

function status() {
  return S ? { n: S.n, N: S.N, done: S.done, flags: S.flags.length,
               seconds: +((performance.now() - S.t0) / 1000).toFixed(1) } : { started: false };
}

function stats() {
  const ACTS = window.STORY.acts, N = S.N;
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
    const f0 = Math.round(a.from * FPS), f1 = Math.min(N, Math.round(a.to * FPS));
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
  return { flags, perAct };
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
  const { flags, perAct } = stats();
  const sizes = {
    'verify-60fps.png': await post('verify-60fps.png', chart(1600, 800), 'image/png'),
    'sheet-a.jpg': await post('sheet-a.jpg', S.sheetA, 'image/jpeg', 0.86),
    'sheet-b.jpg': await post('sheet-b.jpg', S.sheetB, 'image/jpeg', 0.86)
  };
  return JSON.stringify({ frames: S.N, fps: FPS, seconds: +S.DUR.toFixed(2),
                          flags: flags.length, flagSample: flags.slice(0, 30), perAct, sizes });
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

window.VERIFY = { start, status, stats, report, timbre };
return 'VERIFY ready';
})();
