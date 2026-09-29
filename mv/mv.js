/* world.execute(me); — music video player.
 *
 * Back to front: a palette sky, the storyboard scene (mv/scenes.js) in a 1600x900 design
 * space with its own camera move, drifting motes, then the film treatment — soft bloom,
 * grain, a light vignette, letterbox. Scenes dissolve into each other through an offscreen
 * buffer, so a cut is never a jump.
 *
 * Deliberately absent: beat-synced flashing and slice glitching. The picture breathes with
 * the loudness envelope, the camera holds its framing, and the only shake left is the
 * chant's — asked for by scene name, and gated on the onsets that were measured.
 *
 * All numbers come from mv/score.data.js, produced by analysis/analyze.html from the MP3.
 */
(() => {
'use strict';

const S = window.SCORE, STORY = window.STORY, LYRICS = window.LYRICS, META = S.meta;
const { DW, DH } = window.SCENE_SPACE;
const cv = document.getElementById('stage');
const cx = cv.getContext('2d', { alpha: false });
const buf = document.createElement('canvas'), bx = buf.getContext('2d');
const fade = document.createElement('canvas'), fx = fade.getContext('2d');
const glow = document.createElement('canvas'), gx = glow.getContext('2d');
const track = document.getElementById('track');
const el = (id) => document.getElementById(id);
const ui = {
  act: el('hud-act'), tc: el('hud-tc'), bpm: el('hud-bpm'), key: el('hud-key'),
  meter: el('hud-meter'), bands: el('hud-bands'), log: el('console'),
  title: el('title'), sub: el('subtitle'), start: el('start'), end: el('end'),
  wave: el('wave'), warn: el('warn'), facts: el('facts'), meta: el('meta-line')
};

/* ---------------- analysis data access ---------------- */
const HOP = META.hopMs / 1000;
const KEYS = ['b0','b1','b2','b3','b4','b5','b6','b7','rms','centroid','flux','width','f0','voiced','flat'];
const BMIN = S.ranges.bands.map(r => r[0]), BMAX = S.ranges.bands.map(r => r[1]);
const R_RMS = S.ranges.rms, R_F0 = S.ranges.f0;
const D = {};
function b64bytes(s) { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
for (const k of KEYS) D[k] = b64bytes(S.frames[k]);
/* the decoded length, not the base64 string's length — those differ by 4/3, and using the
   string's length let the last half-second of the film read past the end of every array */
const NF = D.b0.length;

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => v < 0 ? 0 : v > 1 ? 1 : v;
const nz = (v, mn, mx) => clamp01((v - mn) / (mx - mn || 1));

/* The analysis stores each feature against its global min/max, which squashes spiky
   ones (spectral flux peaks at 44654 but sits under 60 most of the time). Re-scaling to
   this song's own 3rd/97th percentile puts the useful range back over 0..1. */
const V = {};
function calibrate(k, toValue, lo, hi) {
  const u = D[k], n = u.length, a = new Float32Array(n), s = new Float32Array(n);
  for (let i = 0; i < n; i++) a[i] = s[i] = toValue(u[i]);
  s.sort();
  const p0 = s[Math.floor(n * lo)], p1 = s[Math.min(n - 1, Math.floor(n * hi))], sp = p1 - p0 || 1;
  for (let i = 0; i < n; i++) a[i] = clamp01((a[i] - p0) / sp);
  V[k] = a;
}
const byte01 = (v) => v / 255;
for (let b = 0; b < 8; b++) calibrate('b' + b, byte01, 0.03, 0.97);
calibrate('rms', byte01, 0.05, 0.985);
calibrate('centroid', byte01, 0.03, 0.97);
calibrate('flux', byte01, 0.05, 0.965);
calibrate('width', byte01, 0.02, 0.97);
calibrate('flat', byte01, 0.02, 0.97);
V.f0 = (() => {   /* the autocorrelation picker saturates at its shortest lag */
  const n = D.f0.length, a = new Float32Array(n);
  for (let i = 0; i < n; i++) a[i] = (D.f0[i] >= 250 || D.voiced[i] < 145) ? 0 : D.f0[i] / 255 * R_F0[1];
  return a;
})();

const raw = new Float32Array(16);
const at2 = (arr, i, j, f) => lerp(arr[i], arr[j], f);
/* B0..B7 bands, RMS, CENTROID, FLUX, WIDTH, F0(Hz), VOICED, FLAT */
function sample(t) {
  const p = t / HOP, i = Math.max(0, Math.min(NF - 2, Math.floor(p))), f = clamp01(p - i), j = i + 1;
  for (let b = 0; b < 8; b++) raw[b] = at2(V['b' + b], i, j, f);
  raw[8] = at2(V.rms, i, j, f);
  raw[9] = at2(V.centroid, i, j, f);
  raw[10] = at2(V.flux, i, j, f);
  raw[11] = at2(V.width, i, j, f);
  raw[12] = V.f0[i];
  raw[13] = D.voiced[i] / 255;
  raw[14] = at2(V.flat, i, j, f);
  return raw;
}

/* ---------------- clock ----------------
 * Onsets are peak-picked off the stored flux envelope, so anything that needs to land
 * with the music (the console, the count of red ribbons) is in phase by construction.
 * They no longer drive brightness: that is the slow envelope's job. */
const fps = 1000 / META.hopMs;
const ONSETS = (() => {
  const fl = V.flux, pre = new Float64Array(NF + 1);
  for (let i = 0; i < NF; i++) pre[i + 1] = pre[i] + fl[i];
  const W = Math.round(fps * 0.4), refr = Math.round(fps * 0.1), out = [];
  for (let i = 2; i < NF - 2; i++) {
    const v = fl[i];
    if (v < 0.05) continue;
    const a = Math.max(0, i - W), b = Math.min(NF, i + W + 1);
    if (v < ((pre[b] - pre[a]) / (b - a)) * 1.4 + 0.06) continue;
    if (!(v >= fl[i - 1] && v > fl[i - 2] && v >= fl[i + 1] && v > fl[i + 2])) continue;
    if (out.length && i - out[out.length - 1].i < refr) { if (v > out[out.length - 1].v) out[out.length - 1] = { i, v }; continue; }
    out.push({ i, v });
  }
  return out;
})();
let oi = 0, env = 0, punch = 0;    /* slow envelopes; punch only nudges the camera */
function advanceClock(t, dt) {
  while (oi < ONSETS.length && ONSETS[oi].i * HOP <= t) {
    const o = ONSETS[oi];
    if (o.v > 0.6) punch = Math.min(1, punch + o.v * 0.5);
    if (t - lastLogT > 3.4) pushLog(t);
    oi++;
  }
  punch = Math.max(0, punch - dt * 3.2);
  const F = raw;
  env += (F[8] - env) * (1 - Math.exp(-dt / (F[8] > env ? 0.35 : 1.1)));
}

/* ---------------- canvas + camera ---------------- */
let W = 0, HH = 0, DPR = 1;
function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  /* a hidden or zero-box host (automation, background tab) still gets a stage */
  const w = Math.round((cv.clientWidth || 1280) * DPR), h = Math.round((cv.clientHeight || 720) * DPR);
  W = cv.width = buf.width = fade.width = w;
  HH = cv.height = buf.height = fade.height = h;
  glow.width = Math.max(1, Math.round(w / 5)); glow.height = Math.max(1, Math.round(h / 5));
  grainPat = null;
}
addEventListener('resize', resize);

/* the camera is per-scene and per-moment: scenes return {z,x,y} in design units.
   It no longer wanders. There used to be a two-term sine drift on both axes, scaled by
   loudness — it read as a picture that could not hold still, and it cropped the code
   listing at the framing cuts. The only movement left is each scene's own deliberate
   frame(k,t) push, plus a onset-gated shake that a scene has to ask for by name.

   The design space is fitted with min(), not max(): a tall or narrow window used to crop
   the sides of the 16:9 page, which is how the listing lost its left-hand columns. Now the
   whole sheet is always on screen and the surplus becomes letterbox. */
function fitScale() { return Math.min(W / DW, HH / DH); }
function applyCamera(g, fr, t) {
  const scale = fitScale() * fr.z * (1 + (fr.shake || 0) * punch * 0.012);
  let sx = 0, sy = 0;
  if (fr.shake) { const a = fr.shake * punch * 13; sx = Math.sin(t * 33.7) * a; sy = Math.cos(t * 27.1) * a; }
  g.setTransform(scale, 0, 0, scale, W / 2 - fr.x * scale + sx, HH / 2 - fr.y * scale + sy);
}
const WIDE = { z: 1.05, x: DW / 2, y: DH / 2 };
function frameOf(sc, k, t) {
  if (!sc) return WIDE;
  const f = sc.frame ? sc.frame(k, t) : null;
  return f && isFinite(f.z) ? f : WIDE;
}

/* ---------------- acts and palettes ---------------- */
const ACTS = STORY.acts, SCENES = window.SCENES;
function actAt(t) {
  for (let i = 0; i < ACTS.length; i++) if (t >= ACTS[i].from && t < ACTS[i].to) return i;
  return t < ACTS[0].from ? 0 : ACTS.length - 1;
}
const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
function mixColor(x, y, t) {
  const A = hex(x), B = hex(y);
  return '#' + A.map((v, i) => Math.round(lerp(v, B[i], clamp01(t))).toString(16).padStart(2, '0')).join('');
}
const CKEYS = ['room0', 'room1', 'page', 'ink', 'accent', 'rim', 'glow'];
function mixPal(a, b, t) {
  const o = {};
  for (const k of CKEYS) o[k] = mixColor(a[k], b[k], t);
  o.lum = lerp(a.lum, b.lum, t);
  o.glitch = lerp(a.glitch, b.glitch, t); o.rain = lerp(a.rain, b.rain, t);
  return o;
}
let pal = STORY.palette[ACTS[0].tag];
function updatePalette(t, dt) {
  const i = actAt(t), act = ACTS[i], nxt = ACTS[Math.min(i + 1, ACTS.length - 1)];
  const a = STORY.palette[act.tag], b = STORY.palette[nxt.tag];
  const fadeT = clamp01((t - act.to + 4) / 4);
  pal = mixPal(pal, fadeT > 0 ? mixPal(a, b, fadeT) : a, 1 - Math.exp(-dt / 0.45));
  /* the room is dark, so the captions are light-on-dark everywhere and the halo that
     separates them from the page is a shadow, not a glow */
  document.body.style.setProperty('--rim', pal.rim);
  document.body.style.setProperty('--hot', mixColor(pal.accent, '#ff728c', 0.5));
  document.body.style.setProperty('--ink', pal.rim);
  document.body.style.setProperty('--halo', 'rgba(0,0,0,.78)');
}

/* ---------------- layers ---------------- */
/* The room. mv.js paints only what the light cannot reach — a near-black vertical gradient —
   and each scene adds its own lamp, because the lamp is wherever that scene's page is. */
function drawRoom(t) {
  const g = bx.createLinearGradient(0, 0, 0, HH);
  g.addColorStop(0, pal.room0);
  g.addColorStop(0.7, mixColor(pal.room0, pal.room1, 0.24 + env * 0.5));
  g.addColorStop(1, pal.room1);
  bx.setTransform(1, 0, 0, 1, 0, 0);
  bx.fillStyle = g; bx.fillRect(0, 0, W, HH);
}

/* One camera for the whole film. Each scene proposes a framing; at a cut the camera
   holds the outgoing shot's last framing and settles into the incoming one over SETTLE
   seconds. Blending on both sides of the cut (an earlier mistake) made the camera snap
   back at the boundary, which is exactly the "不流畅衔接" the joins showed. */
const SETTLE = 0.8;
function cameraAt(t) {
  const i = SCENES.findIndex(s => t >= s.from && t < s.to);
  const cur = SCENES[i < 0 ? SCENES.length - 1 : i];
  const k = clamp01((t - cur.from) / (cur.to - cur.from));
  const f0 = frameOf(cur, k, t);
  let f = { z: f0.z, x: f0.x, y: f0.y, shake: cur.shake || 0 };
  const prev = i > 0 ? SCENES[i - 1] : null;
  if (prev) {
    const since = t - cur.from;
    if (since < SETTLE) {
      const u = since / SETTLE, pf = frameOf(prev, 1, t);
      f = { z: lerp(pf.z, f.z, u), x: lerp(pf.x, f.x, u), y: lerp(pf.y, f.y, u),
            shake: Math.max(prev.shake || 0, f.shake) };
    }
  }
  return f;
}

/* Framing switches inside one scene used to teleport the picture: wide for frame N, tight
   for frame N+1, with nothing in between. The 60 fps sweep showed them as single-frame
   motion spikes at 4.8 / 47.7 / 49.5 / 51.4 / 55.1 / 77.6 / 81.4 / 85.1 / 92.0 / 95.5 /
   99.3 / 103.5 / 117.3 / 124.9 / 179.9 / 180.9 s. Everywhere except the chant — where the
   cut is the editing device and lands on the beat — the camera now slews to the new
   framing, so the move reads as a move. */
const SLEW = 0.2;
let camState = null, camStateT = -1, lastCam = null;
function cameraFor(t) {
  const f = cameraAt(t);
  const sc = SCENES.find(s => t >= s.from && t < s.to);
  const hard = !!(sc && sc.cut);
  const dt = Math.min(0.25, Math.max(0, t - camStateT));
  if (!camState || hard || t < camStateT || t - camStateT > 0.5) camState = { z: f.z, x: f.x, y: f.y };
  else {
    const a = 1 - Math.exp(-dt / SLEW);
    camState.z += (f.z - camState.z) * a;
    camState.x += (f.x - camState.x) * a;
    camState.y += (f.y - camState.y) * a;
  }
  camStateT = t;
  lastCam = { z: camState.z, x: camState.x, y: camState.y, shake: f.shake };
  return lastCam;
}

function renderScene(g, idx, t, cam) {
  const sc = SCENES[idx];
  if (!sc) return;
  const k = clamp01((t - sc.from) / (sc.to - sc.from));
  g.save();
  g.globalAlpha = 1;
  applyCamera(g, cam, t);
  g.strokeStyle = g.fillStyle = pal.ink;
  g.lineWidth = 2; g.lineJoin = 'round'; g.lineCap = 'round';
  try { sc.draw(g, k, raw, t, pal); }
  catch (e) { if (!window.__sceneErr) window.__sceneErr = sc.id + ': ' + e.message; }
  g.restore();
  g.setTransform(1, 0, 0, 1, 0, 0);
}

/* the film's own random source — the grain texture and its jitter */
const rnd = ((s) => () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)(7);
/* There used to be a global mote layer drifting over every shot. Dust now belongs in the
   beam, so scenes.js draws it next to the page that lights it and the rest of the room
   stays empty. */

const grain = (() => {
  const n = document.createElement('canvas'); n.width = n.height = 128;
  const c = n.getContext('2d'), im = c.createImageData(128, 128);
  for (let i = 0; i < im.data.length; i += 4) {
    const v = 195 + Math.floor(rnd() * 55);
    im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 16;
  }
  c.putImageData(im, 0, 0); return n;
})();
let grainPat = null;

function composite(t, reduced) {
  const fit = fitScale(), dw = DW * fit, dh = DH * fit, ox = (W - dw) / 2, oy = (HH - dh) / 2;
  cx.setTransform(1, 0, 0, 1, 0, 0);
  cx.imageSmoothingEnabled = true;
  cx.fillStyle = '#000'; cx.fillRect(0, 0, W, HH);
  cx.save();
  cx.beginPath(); cx.rect(ox, oy, dw, dh); cx.clip();
  cx.drawImage(buf, 0, 0);
  /* bloom instead of flash: downscale, then add it back softly. It swells over ~1 s,
     so the picture breathes with the phrase instead of twitching on every kick. */
  if (!reduced) {
    gx.clearRect(0, 0, glow.width, glow.height);
    gx.drawImage(buf, 0, 0, glow.width, glow.height);
    cx.globalCompositeOperation = 'lighter';
    cx.globalAlpha = 0.07 + env * 0.13;
    cx.drawImage(glow, 0, 0, W, HH);
    cx.globalAlpha = 1;
    cx.globalCompositeOperation = 'source-over';
  }
  if (!grainPat) grainPat = cx.createPattern(grain, 'repeat');
  cx.save();
  /* the grain follows the measured noisiness of the recording, not its brightness: the
     analysis says this song alternates between a pitched, low-flatness body and bright,
     noise-like passages (flatness 18-25 under the verses, 43-73 at the chorus entries and
     the outro's chip arpeggio), so the film's own grain swells with the noise floor. */
  cx.globalAlpha = 0.04 + raw[14] * 0.1;
  cx.translate(Math.floor(rnd() * 128) - 64, Math.floor(rnd() * 128) - 64);
  cx.fillStyle = grainPat; cx.fillRect(-64, -64, W + 128, HH + 128);
  cx.restore();
  const vg = cx.createRadialGradient(W / 2, HH / 2, Math.min(dw, dh) * 0.3, W / 2, HH / 2, Math.max(dw, dh) * 0.72);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(0,0,0,${((0.62 - env * 0.16) * (1 - pal.lum * 0.74)).toFixed(3)})`);
  cx.fillStyle = vg; cx.fillRect(ox, oy, dw, dh);
  const bar = Math.round(dh * 0.05);
  cx.fillStyle = '#000'; cx.fillRect(ox, oy, dw, bar); cx.fillRect(ox, oy + dh - bar, dw, bar);
  cx.restore();
}

/* ---------------- captions (the song's own words) ---------------- */
const PUNCH = /^[A-Z0-9 .,;:'"()!-]{2,}$/;
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
for (const l of LYRICS) l.punch = PUNCH.test(l.en);
let capI = 0;
function captionAt(t) {
  if (capI >= LYRICS.length || t < LYRICS[capI].at) capI = 0;
  while (capI + 1 < LYRICS.length && LYRICS[capI + 1].at <= t) capI++;
  const l = LYRICS[capI];
  const next = capI + 1 < LYRICS.length ? LYRICS[capI + 1].at : META.duration;
  return (t - l.at) < Math.min(5.6, Math.max(1.4, next - l.at)) ? l : null;
}
function fmt(t) { const m = Math.floor(t / 60), s = t - m * 60; return `${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`; }

let curAct = -1, capKey = '';
function updateText(t) {
  const i = actAt(t), act = ACTS[i];
  if (i !== curAct) {
    curAct = i;
    ui.act.textContent = `${String(i + 1).padStart(2, '0')} / ${act.tag.toUpperCase()}`;
    document.body.dataset.act = act.tag;
    /* the printed frame belongs to the still acts; the chant needs the page bare */
    document.body.classList.toggle('framed', act.tag !== 'execution' && act.tag !== 'collapse');
    el('act-mark').textContent = ROMAN[i] || '';
    for (const c of act.cards || []) logLine(act.from + c.at, 'exec', c.en, true);
  }
  const line = captionAt(t);
  const key = line ? line.at + line.en : '';
  if (key === capKey) return;
  capKey = key;
  if (line) {
    ui.title.textContent = line.en; ui.sub.textContent = line.cn;
    ui.title.classList.toggle('punch', !!line.punch);
    ui.title.classList.remove('on'); ui.sub.classList.remove('on');
    void ui.title.offsetWidth;
    ui.title.classList.add('on'); ui.sub.classList.add('on');
  } else {
    ui.title.classList.remove('on'); ui.sub.classList.remove('on');
  }
}

/* ---------------- runtime console ---------------- */
function logLine(at, level, msg, big) {
  const row = document.createElement('div');
  row.className = 'entry' + (big ? ' big' : '');
  const ts = document.createElement('span'); ts.className = 'ts'; ts.textContent = `[${fmt(at)}]`;
  const lv = document.createElement('span'); lv.className = 'lv'; lv.textContent = ' ' + level + ' ';
  row.append(ts, lv, document.createTextNode(' ' + msg));
  ui.log.prepend(row);
  while (ui.log.children.length > 3) ui.log.lastChild.remove();
  requestAnimationFrame(() => row.classList.add('on'));
}
let lastLogT = -1e9, lastSlot = -1;
function pushLog(t) {
  lastLogT = t;
  const act = ACTS[actAt(t)], lines = act.log || [];
  if (!lines.length) return;
  const slot = Math.floor((t - act.from) / 7);
  if (slot === lastSlot) return;
  lastSlot = slot;
  const pick = lines[slot % lines.length];
  logLine(t, pick.level || 'info', pick.msg);
}

/* ---------------- HUD (hidden by default: it is a film, not a dashboard) -------- */
let bandBars = [];
function buildHUD() {
  bandBars = S.bands.map((n) => {
    const d = document.createElement('div'); d.className = 'band'; d.title = n;
    const f = document.createElement('i'); d.appendChild(f); ui.bands.appendChild(d);
    return f;
  });
  ui.bpm.textContent = `${S.tempo.bpm} BPM · conf ${S.tempo.confidence} · alt ${S.tempo.candidates.slice(1, 3).map(c => c.bpm).join(' / ')}`;
  ui.key.textContent = `${S.key[0].key} · r=${S.key[0].r} · ${ONSETS.length} onsets`;
  const facts = [
    ['file', META.file], ['length', fmt(META.duration)],
    ['format', `${META.container.mp3} · ${META.container.bitrate} · ${META.container.sourceRate} Hz · ${META.container.encoder}`],
    ['detected tempo', `${S.tempo.bpm} BPM (confidence ${S.tempo.confidence}; also ${S.tempo.candidates.slice(1, 3).map(c => c.bpm).join(' / ')})`],
    ['tempo cross-check', STORY.corroboration],
    ['detected key', S.key.slice(0, 2).map(k => `${k.key} (r=${k.r})`).join('  ·  ')],
    ['structure', `${ACTS.length} acts from ${S.sections.length} novelty boundaries`],
    ['loudness', `peak ${META.loudness.peak.toFixed(3)}, RMS ${META.loudness.rms.toFixed(3)}, ${META.loudness.clippedSamples} clipped samples`],
    ['analysis', `${META.frames} frames @ ${META.hopMs.toFixed(1)} ms · ${S.bands.length} bands · melody + stereo width`]
  ];
  const ctx = STORY.context || {};
  for (const k of ['released', 'band', 'lineage', 'reception', 'texture']) if (ctx[k]) facts.push([k, ctx[k]]);
  for (const [k, v] of facts) {
    const dt = document.createElement('dt'); dt.textContent = k;
    const dd = document.createElement('dd'); dd.textContent = v;
    ui.facts.append(dt, dd);
  }
  ui.meta.textContent = `${META.artist} — ${META.title} · ${META.album} · ${fmt(META.duration)} · ${S.tempo.bpm} BPM · ${S.key[0].key} · press H for the analysis overlay`;
}
function updateHUD(t) {
  ui.tc.textContent = `${fmt(t)} / ${fmt(META.duration)}`;
  ui.meter.style.setProperty('--v', env.toFixed(3));
  const i = Math.min(NF - 1, Math.round(t / HOP));
  for (let b = 0; b < 8; b++) bandBars[b].style.setProperty('--v', V['b' + b][i].toFixed(3));
}

/* ---------------- seek bar (the song's own loudness curve) ---------------- */
let waveCv = null;
function buildWave() {
  const n = 1400;
  waveCv = document.createElement('canvas'); waveCv.width = n; waveCv.height = 34;
  const c = waveCv.getContext('2d');
  c.fillStyle = '#4b5168';
  for (let i = 0; i < n; i++) {
    const v = D.rms[Math.floor(i / n * NF)] / 255;
    const h = Math.max(1, Math.sqrt(v) * 32);
    c.fillRect(i, 34 - h, 1, h);
  }
  c.fillStyle = '#f38ba8';
  for (const a of ACTS) c.fillRect(Math.floor(a.from / META.duration * n), 0, 1, 34);
}
function drawPlayhead(t) {
  const c = ui.wave.getContext('2d'), w = ui.wave.width, h = ui.wave.height;
  c.clearRect(0, 0, w, h);
  c.drawImage(waveCv, 0, 0, w, h);
  const x = t / META.duration * w;
  c.globalAlpha = 0.2; c.fillStyle = pal.rim; c.fillRect(0, 0, x, h); c.globalAlpha = 1;
  c.fillStyle = '#ffffff'; c.fillRect(x - 1, 0, 2, h);
}

/* ---------------- main loop ---------------- */
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let playing = false, lastTs = 0;
/* The film normally runs off the audio clock. The clock can be pinned to a time so a
   single frame can be stepped exactly — a media seek has to round-trip before
   track.currentTime moves, which makes frame-by-frame checking impossible. */
let clock = () => track.currentTime;
window.MV = {
  pin(t) { clock = () => t; },
  unpin() { clock = () => track.currentTime; },
  step(ts) { render(ts); },
  cam() { return lastCam; },
  get time() { return clock(); }
};
const schedule = () => document.hidden
  ? setTimeout(() => frame(performance.now()), 33)
  : requestAnimationFrame(frame);
function frame(ts) {
  /* one bad frame must not leave the viewer with a black screen and no explanation */
  try { render(ts); } catch (e) { warn('render halted: ' + (e && e.message || e)); return; }
  if (playing || !track.paused) schedule();
}
function render(ts) {
  const wall = lastTs ? (ts - lastTs) / 1000 : 0.016;
  const dt = Math.min(0.05, wall); lastTs = ts;
  if (!W) resize();
  const t = clock();
  sample(t);
  updatePalette(t, Math.min(0.5, wall));
  advanceClock(t, dt);
  drawRoom(t);
  let idx = SCENES.findIndex(s => t >= s.from && t < s.to);
  if (idx < 0) idx = SCENES.length - 1;
  const cam = cameraFor(t);
  const nxt = SCENES[idx + 1];
  const dis = lerp(1.15, 0.45, clamp01(env * 1.25));      /* the chorus joins tighter than the intro */
  if (nxt && nxt.from - t < dis) {
    const a = clamp01((t - (nxt.from - dis)) / dis);
    renderScene(bx, idx, t, cam);
    fx.setTransform(1, 0, 0, 1, 0, 0);
    fx.clearRect(0, 0, W, HH);
    renderScene(fx, idx + 1, t, cam);
    bx.setTransform(1, 0, 0, 1, 0, 0);
    bx.globalAlpha = a; bx.drawImage(fade, 0, 0); bx.globalAlpha = 1;
  } else {
    renderScene(bx, idx, t, cam);
  }
  composite(t, reduced);
  updateText(t); updateHUD(t); drawPlayhead(t);
  /* a scene that throws is caught inside renderScene, so say so on screen —
     a silently missing motif is indistinguishable from an unfinished one */
  if (window.__sceneErr) warn('scene threw: ' + window.__sceneErr);
}

/* ---------------- transport ---------------- */
function warn(msg) { ui.warn.textContent = msg; ui.warn.style.opacity = 1; }
function play() {
  ui.start.classList.add('off'); ui.end.classList.remove('on');
  track.play().then(() => { playing = true; lastTs = 0; schedule(); })
    .catch(e => warn('playback blocked: ' + e.message));
}
function toggle() { if (track.paused) play(); else { track.pause(); playing = false; } }
function seek(t) {
  track.currentTime = Math.max(0, Math.min(META.duration - 0.05, t));
  oi = 0; while (oi < ONSETS.length && ONSETS[oi].i * HOP < track.currentTime) oi++;
  ui.log.innerHTML = ''; curAct = -1; capKey = 'reset'; lastLogT = -1e9; lastSlot = -1; capI = 0;
  schedule();
}
ui.start.querySelector('.go').addEventListener('click', play);
ui.end.querySelector('.go').addEventListener('click', () => { seek(0); play(); });
ui.wave.addEventListener('click', (e) => {
  const r = e.currentTarget.getBoundingClientRect();
  if (r.width) seek(((e.clientX - r.left) / r.width) * META.duration);
});
track.addEventListener('ended', () => { playing = false; ui.end.classList.add('on'); });
track.addEventListener('error', () => warn(`audio not found next to index.html: ${META.file}`));
addEventListener('keydown', (e) => {
  if (e.code === 'Space') { e.preventDefault(); toggle(); }
  else if (e.key === 'ArrowRight') seek(track.currentTime + 5);
  else if (e.key === 'ArrowLeft') seek(track.currentTime - 5);
  else if (e.key === ']') { const a = ACTS[actAt(track.currentTime) + 1]; if (a) seek(a.from + 0.02); }
  else if (e.key === '[') seek(ACTS[Math.max(0, actAt(track.currentTime) - 1)].from + 0.02);
  else if (e.key === 'm') track.muted = !track.muted;
  else if (e.key === 'c') document.body.classList.toggle('nocaps');
  else if (e.key === 'h') document.body.classList.toggle('hud');
  else if (e.key === 'f') document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
});

buildHUD(); resize(); buildWave();
ui.tc.textContent = `00:00.00 / ${fmt(META.duration)}`;
schedule();
})();
