# world.execute-me

基于 Qwen 的 HTML 仓库，用于表现 Mili —《world.execute (me) ;》这首乐曲的视觉效果。
An HTML music video whose pictures are driven by a measured analysis of the MP3 itself.

## Run it

```
open index.html          # double-click works: everything is local, no build, no CDN
```

The folder must keep this layout, because the player loads the audio and the score by relative path:

```
index.html                      the video
Mili - world.execute (me) ;.mp3 the track (not committed; drop it next to index.html)
mv/mv.js                        player: audio clock, camera, film treatment, captions
mv/scenes.js                    the storyboard — 14 vector scenes keyed to the lyrics
mv/lyrics.js                    English lyric + timestamps, with rewritten Chinese
mv/story.js                     act map, palettes, runtime-console fiction
mv/score.data.js                generated analysis (window.SCORE) — do not hand-edit
analysis/analyze.html           the analysis pipeline, runnable and inspectable in a browser
```

Controls: `SPACE` play/pause · `←/→` seek 5 s · `[ ]` previous/next act · `C` captions · `M` mute · `F` fullscreen · click the loudness strip to seek.

## What the analysis measured

Everything below came out of `analysis/analyze.html`, which decodes the file with the
browser's own MP3 decoder and runs a plain-JS DSP chain (no libraries, no ffmpeg):

| measured | value |
| --- | --- |
| length | 211.907 s (3:31.91) |
| container | MPEG-1 Layer III, 320 kbps, 44.1 kHz stereo, encoder `Lavf58.76.100` |
| tags | Mili — *world.execute (me) ;*, album *Miracle Milk*, track 11 |
| decode domain | 48 kHz float PCM (browser resample), 9 932 analysis frames @ 21.33 ms |
| spectrum | 8 log bands, 25 Hz … 16 kHz, Hann window, 4 096-point FFT, 75 % overlap |
| loudness | peak 1.0397, RMS 0.3361, 3 062 clipped samples — a hot master |
| silence | lead-in 0.107 s, tail 0.021 s |
| key | A minor (Krumhansl–Schmuckler r = 0.479), then F major 0.323, G major 0.275 |
| tempo | 128.3 BPM, confidence 0.15; competing 88.5 / 66 BPM |
| structure | 14 novelty boundaries → 0/15/31/44/60/74/88/104/119/134/147/163/175/193 s |
| melody | FFT autocorrelation f0, 65–1 200 Hz, with a correlation gate |
| stereo | side/mid energy ratio (the visual spreads with it) |

The tempo is reported, not trusted: the detected phrase boundaries miss that bar grid by
556 ms on average, which is what a random offset would give (bar/4 = 468 ms). So the video
does not ride a metronome — it rides onsets peak-picked off the stored flux envelope, which
are in phase with the recording by construction.

## What is on screen

The video is a storyboard, not a spectrum readout. Fourteen scenes are keyed to the lyric
lines that motivate them — the power line and the fuse, the chess board, an object being
created, the points that grow axes, the circle whose circumference is handed over, the sine
wave you can sit on its tangents, the curve approaching its limit, AC straightening into DC,
the lids closing, the timeline scrubbed back before A.D., the overlapping circles, the
eggplant, the tomato, the tabby cat, the halo and the PROOF stamp, Venus morphing into Mars,
the clock from AM to PM, the S/M swap, the trance rings, the progress bar that finally
reaches COMPLETION, the door that closes on the fifth "you have left", the node with every
link cut, the shards swept away, the ILLEGAL ARGUMENTS dialog, twelve red stamps stacking
into a wall while she counts to six in six languages, the equation she mistakes for love,
the grid retracting, and one last red line over a blinking prompt.

The analysis is what the scenes are painted *on*. The song is brisk — 128 BPM, staccato, a
music-box timbre — so the picture moves with it rather than floating: the camera drifts
faster while the mix is dense, the girl bobs on the loudness envelope, props land with an
overshoot, and confetti density rides the high bands. Nothing flashes on the beat (no
slice-glitch, no strobe): the only per-onset motion is a 2 % camera lean, and brightness
changes only through a bloom that swells over about a second.

Concretely:

- **paper** — the whole film is drawn on light paper with ink line art; `sheet()` reverses
  to red ink on black paper for the EXECUTION act, and the outro drains the light out;
- **exposure** rides the log-mapped RMS curve, so a quiet bar is literally dimmer;
- **colour** is per act, cross-fading with a 0.45 s time constant, and the caption ink,
  its halo and the vignette strength all follow the palette's luminance;
- **onsets** are peak-picked off the stored flux envelope (~500 in this song) and drive the
  console lines, the chant's framing cuts and the camera lean — in phase with the recording;
- **transitions** are a real cross-dissolve through an offscreen buffer, shortened from 1.1 s
  to 0.3 s as the loudness rises, so the chorus cuts harder than the intro;
- every feature is re-calibrated to its own 3rd/97th percentile of this song, because the
  stored global min/max squashes spiky features such as spectral flux.

## About the Chinese

The English is the song's own. The Chinese is rewritten rather than copied from the LRC,
because several lines only work if the pun survives the crossing: `OBJECT CREATION` becomes
创建对象 (对象 is both an instance and a lover), `EXECUTION` stays 执行 through the first
chant and only then turns into 处决 (执行代码 and 执行死刑 share the verb), `To AC to DC`
becomes 由交流，换成直流 (交流 is alternating current and also company), `DISHEARTENED`
becomes 无心 (heartless, and: the heart component deleted), `Set up our new world` becomes
捏一个给我们的世界, which is meant to recall 女娲抟土造人 — she is made, and she is made of
data. The Zhuangzi butterfly is not in the captions; a machine would log it, so it sits in
the runtime console as `butterfly_check: who is dreaming whom`.

## Rebuilding the score

Serve the folder (`python -m http.server 8137 --bind 127.0.0.1`), open
`http://127.0.0.1:8137/analysis/analyze.html`, then run `run()` from the console. It takes
about 35 s and prints the structure table, the waveform with its onset comb, and the novelty
track with the chosen boundaries. Export with
`'window.SCORE=' + JSON.stringify(window.__score)` into `mv/score.data.js`.
