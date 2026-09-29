/* mv/story.js — act map, the light score, and the runtime console text.
 *
 * Art direction (the second one, after the flat-pop version read as clip-art):
 * the whole film happens in a dark room, and the only light in it is the page. So there is
 * no "background" to design — there is a light source, what it falls on, and what is
 * silhouetted against it. Everything the lyric describes is drawn *in ink on that page*,
 * which is why the props stopped being little coloured objects floating in the air.
 *
 * Each act therefore sets a lamp, not a palette:
 *   room0/room1  the dark field, top to bottom
 *   page         the colour of the lit sheet itself
 *   ink          what is drawn on it
 *   accent       the one saturated colour in the frame — crimson, and only where it is earned
 *   rim          the strip of light on the silhouette's screen-facing edge
 *   glow         the colour the page throws into the room
 *   lum          how lit the room is (0..1); drives vignette, grain, and the fade to black
 *
 * Act boundaries still come from analysis/analyze.html (novelty peaks at 0 / 15 / 31 / 44 /
 * 60 / 74 / 88 / 104 / 119 / 134 / 147 / 163 / 175 / 193 s), snapped to the lyric sheet where
 * the two disagreed by more than ~1.5 s. Where they agreed the detected number stands.
 *
 * Console lines are an original machine log written for this video; the lyric text lives in
 * mv/lyrics.js and is the song's own.
 */
window.STORY = {
  palette: {
    /* waking up: a cold, slightly blue start-up light */
    boot:      { room0: '#070a0e', room1: '#111820', page: '#eef2f6', ink: '#1d2833', accent: '#b3263a', rim: '#cfe0f0', glow: '#9fc0e2', lum: 0.62 },
    /* the title card inside the globe: warmer, softer, the lamp has settled */
    interlude: { room0: '#080b10', room1: '#151d27', page: '#f2f1ea', ink: '#20272f', accent: '#b3263a', rim: '#d8e4ef', glow: '#a8c2da', lum: 0.68 },
    /* she is writing: the brightest, most neutral reading light of the film */
    verse:     { room0: '#0a0d11', room1: '#18202a', page: '#f6f7f4', ink: '#1b242c', accent: '#a81f38', rim: '#e2ecf5', glow: '#b8cfe4', lum: 0.74 },
    /* the chorus: over-exposed, the light spills, the halo widens */
    chorus:    { room0: '#0c0e12', room1: '#1d232b', page: '#fbf6ee', ink: '#22262c', accent: '#d81b43', rim: '#f0e6df', glow: '#d8b8ac', lum: 0.86 },
    /* you have left: the lamp browns and drops */
    collapse:  { room0: '#08070a', room1: '#141114', page: '#ddd0b8', ink: '#2b2419', accent: '#a8402c', rim: '#b9a98d', glow: '#8c7a5e', lum: 0.40 },
    /* nothing scheduled: barely lit, the page is almost out of the room */
    dusk:      { room0: '#050608', room1: '#0b0e12', page: '#9fa4a6', ink: '#171a1c', accent: '#7c2a38', rim: '#7e8a96', glow: '#5f6f7e', lum: 0.20 },
    /* EXECUTION: the room turns the colour of the verdict, and the page is the warrant */
    execution: { room0: '#0b0305', room1: '#210810', page: '#f3ece0', ink: '#2a0d14', accent: '#ff2d55', rim: '#e8b8c0', glow: '#b3263a', lum: 0.30 },
    /* the answer: cold clean light again, and gentler than the verses */
    reveal:    { room0: '#080a0f', room1: '#161c26', page: '#f1f2f5', ink: '#1e242e', accent: '#c02a44', rim: '#dbe6f2', glow: '#a6bed6', lum: 0.70 },
    /* the light going out of the room */
    outro:     { room0: '#030406', room1: '#080b0f', page: '#7d8790', ink: '#12161a', accent: '#7a2230', rim: '#5d6a76', glow: '#46525e', lum: 0.12 }
  },

  /* the LRC as an independent witness for the tempo estimate */
  corroboration: 'the EXECUTION chant (12 lines, 147.66-158.00 s) is 0.94 s apart = 127.5 BPM against 128.3 detected',

  /* 查证到的外部事实，只出现在开场的事实表里，不进入影片叙事。
     参考的是背景，不是别人的画面：本片没有一个镜头是从任何现成 MV 复制来的。 */
  context: {
    released: 'Miracle Milk — 2016-10-12 (Japan)',
    band: 'Cassie Wei (voice) · Yamato Kasai (g) · Yukihito Mitomo (b) · Shoto Yoshida (dr) · Ao Fujimori (illustration)',
    lineage: 'electronica / classical / game music — the band cites YMO as a root',
    reception: 'June 2016: Polish osu! player "Exile-" generated 594,285 lines of Java to build this song\u2019s storyboard',
    texture: 'measured: flatness 18-25 under the verses vs 43-73 at the chorus entries — a tonal body and a noise-bright layer, alternating'
  },

  acts: [
    { from: 0, to: 15, tag: 'boot',
      cards: [{ at: 0.2, en: 'cold boot — no runtime, no name' }, { at: 0.4, en: 'credits: music & lyrics by Mili / momocashew' }],
      log: [{ level: 'info', msg: 'mount /world (read-only)' },
            { level: 'info', msg: 'object created: self' },
            { level: 'info', msg: 'parameters filled by you' }] },

    { from: 15, to: 29.7, tag: 'interlude',
      cards: [{ at: 0.2, en: 'exec: world.execute(me) ;' }],
      log: [{ level: 'info', msg: 'entry point reached' },
            { level: 'info', msg: 'stdin: waiting for a voice' }] },

    { from: 29.7, to: 59.22, tag: 'verse',
      cards: [{ at: 0.2, en: 'type check: points, circle, sine wave' }],
      log: [{ level: 'info', msg: 'geometry module loaded' },
            { level: 'warn', msg: 'current switched AC -> DC' },
            { level: 'info', msg: 'clock: A.D. <-> B.C.' },
            { level: 'info', msg: 'unite() called with depth=infinity' }] },

    { from: 59.22, to: 74.04, tag: 'chorus',
      cards: [{ at: 0.2, en: 'run: EXECUTION (1 of many)' }],
      log: [{ level: 'info', msg: 'stimulations: queued' },
            { level: 'info', msg: 'satisfaction target = you' },
            { level: 'warn', msg: 'we are trapped (known issue)' }] },

    { from: 74.04, to: 88.58, tag: 'verse',
      cards: [{ at: 0.2, en: 'rebind: eggplant, tomato, tabby cat' }],
      log: [{ level: 'info', msg: 'nutrients exported' },
            { level: 'info', msg: 'purr() -> enjoyment' },
            { level: 'warn', msg: 'if (only_god) need proof_of_existence' }] },

    { from: 88.58, to: 110.9, tag: 'chorus',
      cards: [{ at: 0.2, en: 'switch gender=F|M role=S|M' }],
      log: [{ level: 'info', msg: 'roles swapped, both directions' },
            { level: 'info', msg: 'butterfly_check: who is dreaming whom' },
            { level: 'info', msg: 'vibrations sensed' },
            { level: 'info', msg: 'COMPLETION: 1 of 1 conditions met' }] },

    { from: 110.9, to: 131.22, tag: 'collapse',
      cards: [{ at: 0.2, en: 'you have left (x5) -> ISOLATION' }],
      log: [{ level: 'warn', msg: 'peer disconnected' },
            { level: 'info', msg: 'erase pointless fragments...' },
            { level: 'error', msg: 'ILLEGAL ARGUMENTS from caller' },
            { level: 'info', msg: 'heap quiet. nothing scheduled.' }] },

    { from: 131.22, to: 147.66, tag: 'dusk',
      cards: [{ at: 0.2, en: 'nothing scheduled' }],
      log: [{ level: 'info', msg: 'heap quiet. nothing scheduled.' },
            { level: 'warn', msg: 'stdin: no voice' }] },

    { from: 147.66, to: 177.24, tag: 'execution',
      cards: [{ at: 0.2, en: 'EXECUTION x12 — counting in six languages' }],
      log: [{ level: 'error', msg: 'syscall: execution (death)' },
            { level: 'info', msg: 'ein dos trois ne fem liu' },
            { level: 'warn', msg: 'give them all the execution' },
            { level: 'info', msg: 'be your only executioner' }] },

    { from: 177.24, to: 193, tag: 'reveal',
      cards: [{ at: 0.2, en: 'study complete: algebraic expression of LOVE' }],
      log: [{ level: 'info', msg: 'question me — answer all' },
            { level: 'warn', msg: 'you are free / I am trapped' }] },

    { from: 193, to: 211.91, tag: 'outro',
      cards: [{ at: 0.2, en: 'exit: the light goes out' }],
      log: [{ level: 'info', msg: 'power line still on' },
            { level: 'info', msg: 'process ended, object retained' }] }
  ]
};
