# Build report: Does AI Help Junior or Senior Developers More?

ai-coding / decision:who-benefits, 2026-10-27T08:37:31.639Z. `npm run video -- spike ai-coding decision:who-benefits`

**Segment.** 28 of 27 storyboard scenes (sc01 to end), 38 sentences. Kinds: sc01 title, sc02 question, sc03 title, sc04 quote, sc05 quote, sc06 question, sc07 stat-tiles, sc08 excerpt, sc09 list, sc10 list, sc11 stat-tiles, sc12 excerpt, sc13 quote, sc14 list, sc15 question, sc16 stat-tiles, sc17 list, sc18 excerpt, sc19 list, sc20 question, sc21 stat-tiles, sc22 bar, sc23 quote, sc24 stat-tiles, sc25 list, sc26 quote, sc27 list, end close-card.

**Output.** topics/ai-coding/scripts/decision-who-benefits/video/segment.mp4: 440.15s, 1920x1080 @ 30 fps, h264 + aac, 13204 frames, rendered in 1738.9s ($0 (local CPU)).

**Narration.** edge / en-US-AndrewMultilingualNeural (rate +0%), mp3, 414.1s of speech at about 165 wpm, $0 (edge-tts, no key). Licence: draft only: unofficial Microsoft Edge read-aloud API, no terms for published media. **Draft only, not publishable.**

| Sentence | Seconds | Boundaries | Audio sha |
|---|---|---|---|
| s01 | 9.072 | 24 | 49456cee7a |
| s02 | 1.872 | 8 | ec471a4c3e |
| s03 | 6.192 | 20 | a190da2d3b |
| s04 | 11.184 | 32 | 76e5aa9f46 |
| s05 | 8.208 | 28 | 845719a1ee |
| s06 | 14.64 | 43 | 684cb98f40 |
| s07 | 12.576 | 26 | ed1afdc20c |
| s08 | 8.568 | 23 | 46e74b24b9 |
| s09 | 14.232 | 37 | 8676663cfd |
| s10 | 10.296 | 28 | 2c03894e2e |
| s11 | 11.784 | 30 | 6c8f22cc7d |
| s12 | 14.256 | 36 | c277e86285 |
| s13 | 9.408 | 24 | 8678269774 |
| s14 | 9.696 | 24 | ecc143fd5e |
| s15 | 18.288 | 48 | d2ab52f160 |
| s16 | 9.432 | 30 | a3dca7836f |
| s17 | 11.256 | 30 | d54304344e |
| s18 | 6.576 | 19 | 2796d174b9 |
| s19 | 7.608 | 24 | 0911633ce9 |
| s20 | 10.896 | 27 | 1ebc977145 |
| s21 | 12.864 | 30 | c2eb161408 |
| s22 | 21.888 | 60 | e547b451b9 |
| s23 | 15.336 | 45 | 9da0c573e7 |
| s24 | 19.152 | 47 | 3d76a00727 |
| s25 | 12.288 | 37 | 616599cf2d |
| s26 | 4.632 | 19 | c5818d7fa8 |
| s27 | 9.312 | 24 | 92664af1fb |
| s28 | 10.104 | 25 | 740b7567db |
| s29 | 10.896 | 28 | c4c0c62d1f |
| s30 | 9.936 | 28 | a83e71bf2e |
| s31 | 10.56 | 33 | 39a0026e2d |
| s32 | 16.032 | 38 | c109d00f3c |
| s33 | 13.368 | 32 | 80d3b255dc |
| s34 | 7.968 | 20 | f1de8c2efc |
| s35 | 14.784 | 33 | 5ac890db24 |
| s36 | 3.312 | 10 | 9b3a6ef6d7 |
| s37 | 7.512 | 26 | adb13cf1de |
| s38 | 8.112 | 33 | 32be7501a9 |

**Architecture.** Remotion (React, frame-based) rendered scene by scene into cached chunks through @remotion/renderer; chunks concatenated and the narration track laid down with the ffmpeg in the Remotion compositor (loudnorm to -16 LUFS).

**Soundtrack.** Undertow (strudel-bench f63f2c5 (songs/undertow.strudel not yet committed), songs/undertow.strudel c7fbeafb07, 84 bpm D:minor; cleared; no samples). Mix e8f90a18eb: music -20.8 dB under the voice while it speaks, peak -1.3 dB.

| Cue | Asset | From | To | Gain | Level |
|---|---|---|---|---|---|
| opening | undertow/pulse | 0.0s | 18.3s | -11 dB | -37.6 dB |
| evidence | undertow/texture | 18.3s | 407.2s | -13 dB | -40.3 dB |
| ending | undertow/pulse | 407.2s | 440.1s | -11 dB | -35.9 dB |

**Clearance.** **Not cleared for public release:** narration is draft only: unofficial Microsoft Edge read-aloud API, no terms for published media; when the draft is accepted, "npm run video -- final ai-coding decision:who-benefits --approved-by <name>" re-narrates it for release. A passing build is technical completion only; a person approves the release.

**Fingerprints.** script 69c62d9c0e, storyboard 8464572385, narration 6613efe9e6, config 97689a8a89, music e8f90a18eb.

## QA: passed (36 of 36)

| Check | Result | Detail |
|---|---|---|
| mp4 decodable | ok | 440.149s |
| video stream | ok | h264 1920x1080 @ 30 |
| resolution | ok | 1920x1080 |
| frame rate | ok | 30 |
| h264 | ok | h264 |
| frame count | ok | 13204 frames, timeline 13204 |
| duration in range | ok | 440.15s in [439.1,441.1] |
| duration matches timeline | ok | 440.149s vs 440.133s (13204 frames) |
| audio stream | ok | aac 48000 Hz x2 |
| aac | ok | aac |
| audio length matches video | ok | 0.016s apart |
| no clipping | ok | peak -1.4 dB, mean -19.5 dB |
| no long silence | ok | none >= 3s before the end scene |
| narration not truncated | ok | 38 sentences fit their slots |
| scene order | ok | sc01 to sc27 (27) |
| scenes contiguous in storyboard | ok | from sc01 |
| every storyboard scene rendered | ok | 27 scenes |
| every script sentence narrated | ok | 38 sentences in script order |
| sentences in script order | ok | 38 sentences |
| narration matches script | ok | every sentence verbatim |
| fingerprints | ok | script 69c62d9c0e, storyboard 8464572385 (locked) |
| citations present | ok | 24 on-screen citations resolved |
| chart data matches storyboard | ok | 6 charts |
| excerpts resolve | ok | 3 excerpts with their highlights |
| assets and kinds supported | ok | 8 kinds |
| music cues resolve | ok | 3 cues over 1 compositions |
| soundtrack mixed | ok | 3 cues, 2026-10-27T08:35:56.760Z |
| mix is of this cue sheet | ok | mix e8f90a18eb, cue sheet e8f90a18eb |
| every cue sounded | ok | 3 cues audible where placed |
| music under the voice | ok | -20.8 dB relative to speech (want -40 to -10) |
| mix under the ceiling | ok | peak -1.3 dB, ceiling -1 dB |
| scene boundaries follow measured audio | ok | 28 scenes, 38 sentences |
| cues inside their sentences | ok | 4 cues |
| final scene complete | ok | ends 440.13s |
| no blank sections | ok | none |
| every scene has content | ok | mid-scene luma varies in every scene |

Inspection frames: 61 in video/frames/; contact sheet topics/ai-coding/scripts/decision-who-benefits/video/contact-sheet.png.

## Known limitations

- NOT FOR PUBLICATION: narration is draft only: unofficial Microsoft Edge read-aloud API, no terms for published media; once the draft is accepted, "npm run video -- final <topic> <story-id> --approved-by <name>" re-narrates it with Azure for release
- word boundaries from edge-tts group a numeral with the word before it; the span is split by letters, so a numeral cue can be a few frames early
- system fonts (Georgia, Segoe UI): renders on another machine may set type differently
- scene transitions are a short fade over the field; no cross-dissolve between scenes
- automated QA checks integrity and consistency, not editorial quality: a person reviews the contact sheet and the video before any publication decision
- music levels are measured, not heard: a person judges the balance and the continuity in the review pass
