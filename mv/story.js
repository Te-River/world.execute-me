/* mv/story.js — act map, palettes and the runtime console text.
 *
 * Act boundaries start from the structure detected by analysis/analyze.html
 * (novelty peaks at 0 / 15 / 31 / 44 / 60 / 74 / 88 / 104 / 119 / 134 / 147 / 163 / 175 / 193 s)
 * and are snapped to the lyric sheet where the two disagreed by more than ~1.5 s
 * (e.g. the detected 31 s is the verse that the LRC puts at 29.70 s). Where they
 * agreed, the detected number stands: 60 / 74 / 88 / 147 / 193 s.
 *
 * Colour is the point, not a garnish: each act owns a flat, saturated sky and ground,
 * and the film walks them from a warm daytime down to the black-and-red of the chant
 * and back up again. `lum` tells the scene art how light the page still is, so the ink
 * reverses continuously instead of flipping at a cut.
 *
 * Console lines are an original machine log written for this video — the lyric text
 * lives in mv/lyrics.js and is the song's own.
 */
window.STORY = {
  /* bg0/bg1 = the coloured sky, cool = the ground, hot = the sun and accents,
     ink = line art and text, rim = the highlight on the silhouette */
  palette: {
    boot:      { bg0: '#f0dfa8', bg1: '#fff3d2', ink: '#33261a', hot: '#ff7a45', cool: '#4f8f7c', warm: '#f2b134', rim: '#ffffff', lum: 0.9, glitch: 0.1, rain: 0.2 },
    interlude: { bg0: '#a9d5f0', bg1: '#eaf7ff', ink: '#1c3550', hot: '#ff8fa3', cool: '#4d7fa8', warm: '#ffd08a', rim: '#ffffff', lum: 0.88, glitch: 0.12, rain: 0.3 },
    verse:     { bg0: '#bfe6c8', bg1: '#f3fff2', ink: '#1d3a2c', hot: '#ff9f1c', cool: '#3f8f63', warm: '#e9c46a', rim: '#ffffff', lum: 0.9, glitch: 0.14, rain: 0.35 },
    chorus:    { bg0: '#ffb3c8', bg1: '#fff0e6', ink: '#4a1226', hot: '#ff3d6b', cool: '#3fb0a0', warm: '#ffd166', rim: '#ffffff', lum: 0.88, glitch: 0.2, rain: 0.5 },
    collapse:  { bg0: '#c9a26b', bg1: '#e8d3a8', ink: '#3a2412', hot: '#d1462f', cool: '#6b6142', warm: '#8a5a2a', rim: '#fdf1dc', lum: 0.78, glitch: 0.2, rain: 0.3 },
    dusk:      { bg0: '#5d6b8f', bg1: '#93a3c0', ink: '#161c2b', hot: '#e0605f', cool: '#394a63', warm: '#f0c98a', rim: '#dfe6f5', lum: 0.55, glitch: 0.24, rain: 0.28 },
    execution: { bg0: '#2a0710', bg1: '#57101f', ink: '#ffe8ec', hot: '#ff2d55', cool: '#7a1a2e', warm: '#ffd166', rim: '#ffe8ec', lum: 0.16, glitch: 0.4, rain: 0.7 },
    reveal:    { bg0: '#c9b6f2', bg1: '#fff2e0', ink: '#2a1b46', hot: '#ff4d8d', cool: '#6a5acd', warm: '#ffbf3f', rim: '#ffffff', lum: 0.9, glitch: 0.16, rain: 0.45 },
    outro:     { bg0: '#7fa8ad', bg1: '#cfe2e4', ink: '#1b2b30', hot: '#ff8f5c', cool: '#3e6a72', warm: '#e8e0cf', rim: '#ffffff', lum: 0.72, glitch: 0.08, rain: 0.18 }
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
            { level: 'warn', msg: 'heart: used before defined' }] },

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
            { level: 'error', msg: 'ILLEGAL ARGUMENTS from caller' }] },

    { from: 131.22, to: 147.66, tag: 'dusk',
      cards: [{ at: 0.2, en: 'heap quiet. nothing scheduled.' }],
      log: [{ level: 'info', msg: 'the sun goes out of the page' },
            { level: 'info', msg: 'one cursor, blinking, unanswered' }] },

    { from: 147.66, to: 177.24, tag: 'execution',
      cards: [{ at: 0.2, en: 'EXECUTION x12 — the program reads itself line by line' }],
      log: [{ level: 'error', msg: 'syscall: execution (death)' },
            { level: 'info', msg: 'ein dos trois ne fem liu' },
            { level: 'warn', msg: 'give them all the execution' },
            { level: 'info', msg: 'be your only executioner' }] },

    { from: 177.24, to: 193, tag: 'reveal',
      cards: [{ at: 0.2, en: 'study complete: algebraic expression of LOVE' }],
      log: [{ level: 'info', msg: 'question me — answer all' },
            { level: 'warn', msg: 'you are free / I am trapped' }] },

    { from: 193, to: 211.91, tag: 'outro',
      cards: [{ at: 0.2, en: 'exit: the last EXECUTION' }],
      log: [{ level: 'info', msg: 'power line still on' },
            { level: 'info', msg: 'process ended, object retained' }] }
  ]
};
