/* mv/story.js — act map, palettes and the runtime console text.
 *
 * Act boundaries start from the structure detected by analysis/analyze.html
 * (novelty peaks at 0 / 15 / 31 / 44 / 60 / 74 / 88 / 104 / 119 / 134 / 147 / 163 / 175 / 193 s)
 * and are snapped to the lyric sheet where the two disagreed by more than ~1.5 s
 * (e.g. the detected 31 s is the verse that the LRC puts at 29.70 s). Where they
 * agreed, the detected number stands: 60 / 74 / 88 / 147 / 193 s.
 *
 * Console lines are an original machine log written for this video — the lyric text
 * lives in mv/lyrics.js and is the song's own.
 */
window.STORY = {
  /* bg0/bg1 = the paper, ink = line art and text, hot/cool/warm = flat pop colours,
     rim = the highlight on the silhouette, lum = how light the sheet is (drives the reversal) */
  palette: {
    boot:      { bg0: '#f4eede', bg1: '#fffdf5', ink: '#2a333d', hot: '#ff8a5c', cool: '#a8c6b6', warm: '#e9a13c', rim: '#ffffff', lum: 0.94, glitch: 0.1, rain: 0.2 },
    interlude: { bg0: '#e4f0fb', bg1: '#ffffff', ink: '#22303f', hot: '#4aa8f0', cool: '#a9cfe8', warm: '#ffd8a8', rim: '#ffffff', lum: 0.95, glitch: 0.12, rain: 0.3 },
    verse:     { bg0: '#eef6ee', bg1: '#ffffff', ink: '#1f2d2a', hot: '#28a07c', cool: '#b8d8c8', warm: '#e9a13c', rim: '#ffffff', lum: 0.95, glitch: 0.14, rain: 0.35 },
    chorus:    { bg0: '#ffe9ef', bg1: '#fffaf5', ink: '#3a1f2a', hot: '#e8446a', cool: '#ffc2d1', warm: '#e9a13c', rim: '#ffffff', lum: 0.95, glitch: 0.2, rain: 0.5 },
    collapse:  { bg0: '#d9cdb8', bg1: '#efe5d4', ink: '#33291f', hot: '#c25a3a', cool: '#a89478', warm: '#8a6a4a', rim: '#fdf6e8', lum: 0.82, glitch: 0.2, rain: 0.3 },
    execution: { bg0: '#14060a', bg1: '#2c0a13', ink: '#ffe8ec', hot: '#ff2d55', cool: '#7a1a2e', warm: '#ffd166', rim: '#ffe8ec', lum: 0.12, glitch: 0.4, rain: 0.7 },
    reveal:    { bg0: '#f1ecff', bg1: '#ffffff', ink: '#2a2140', hot: '#e8446a', cool: '#c0b0e8', warm: '#e9a13c', rim: '#ffffff', lum: 0.95, glitch: 0.14, rain: 0.4 },
    outro:     { bg0: '#c4d3d8', bg1: '#eef4f5', ink: '#26333a', hot: '#79b2bb', cool: '#a8c0c6', warm: '#e8e0cf', rim: '#ffffff', lum: 0.8, glitch: 0.08, rain: 0.18 }
  },

  /* the LRC as an independent witness for the tempo estimate */
  corroboration: 'the EXECUTION chant (12 lines, 147.66-158.00 s) is 0.94 s apart = 127.5 BPM against 128.3 detected',

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

    { from: 110.9, to: 147.66, tag: 'collapse',
      cards: [{ at: 0.2, en: 'you have left (x5) -> ISOLATION' }],
      log: [{ level: 'warn', msg: 'peer disconnected' },
            { level: 'info', msg: 'erase pointless fragments...' },
            { level: 'error', msg: 'ILLEGAL ARGUMENTS from caller' },
            { level: 'info', msg: 'heap quiet. nothing scheduled.' }] },

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
      cards: [{ at: 0.2, en: 'exit: the last EXECUTION' }],
      log: [{ level: 'info', msg: 'power line still on' },
            { level: 'info', msg: 'process ended, object retained' }] }
  ]
};
