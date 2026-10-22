# Build report: Does AI Help Junior or Senior Developers More?

ai-coding / decision:who-benefits, 2026-10-22T02:20:53.706Z. `npm run video -- qa ai-coding decision:who-benefits`

**Segment.** 27 of 27 storyboard scenes (sc01 to sc27), 38 sentences. Kinds: sc01 title, sc02 question, sc03 title, sc04 quote, sc05 quote, sc06 question, sc07 stat-tiles, sc08 excerpt, sc09 list, sc10 list, sc11 stat-tiles, sc12 excerpt, sc13 quote, sc14 list, sc15 question, sc16 stat-tiles, sc17 list, sc18 excerpt, sc19 list, sc20 question, sc21 stat-tiles, sc22 bar, sc23 quote, sc24 stat-tiles, sc25 list, sc26 quote, sc27 list.

**Output.** topics/ai-coding/scripts/decision-who-benefits/video/segment.mp4: 424.15s, 1920x1080 @ 30 fps, h264 + aac, 12724 frames, rendered in 0s ($0 (local CPU)).

**Narration.** edge / en-US-AndrewMultilingualNeural (rate +0%), mp3, 414.1s of speech at about 165 wpm, $0 (edge-tts, no key). Licence: draft only: unofficial Microsoft Edge read-aloud API, no terms for published media. **Draft only, not publishable.**

| Sentence | Seconds | Boundaries | Audio sha |
|---|---|---|---|
| s01 | 9.072 | 24 | d35140a1de |
| s02 | 1.872 | 8 | 7e6782bb66 |
| s03 | 6.192 | 20 | 5e5b3485d3 |
| s04 | 11.184 | 32 | 67d21672c1 |
| s05 | 8.208 | 28 | d5ba2a7cdc |
| s06 | 14.64 | 43 | 6cd3d00a6b |
| s07 | 12.576 | 26 | 177be320f9 |
| s08 | 8.568 | 23 | 1dfe58cda1 |
| s09 | 14.232 | 37 | f23d211910 |
| s10 | 10.296 | 28 | 85b5d29dba |
| s11 | 11.784 | 30 | e662227664 |
| s12 | 14.256 | 36 | 75fa3a9dc8 |
| s13 | 9.408 | 24 | a100960d57 |
| s14 | 9.696 | 24 | 77502bf08e |
| s15 | 18.288 | 48 | 6f917aadd0 |
| s16 | 9.432 | 30 | 73e17a6ea3 |
| s17 | 11.256 | 30 | 3fc2d05080 |
| s18 | 6.576 | 19 | 5a1d930030 |
| s19 | 7.608 | 24 | edaea90a30 |
| s20 | 10.896 | 27 | a1f55a8cd1 |
| s21 | 12.864 | 30 | 6757571e04 |
| s22 | 21.888 | 60 | 242bc685f4 |
| s23 | 15.336 | 45 | bdf8eb995f |
| s24 | 19.152 | 47 | 9395a1ae2e |
| s25 | 12.288 | 37 | 8a6444a88c |
| s26 | 4.632 | 19 | 918e4544fe |
| s27 | 9.312 | 24 | dbd2cc61a8 |
| s28 | 10.104 | 25 | c946d63c43 |
| s29 | 10.896 | 28 | 3350f562bb |
| s30 | 9.936 | 28 | 35b0846b47 |
| s31 | 10.56 | 33 | 22a93fb6e0 |
| s32 | 16.032 | 38 | e83d8b5fbc |
| s33 | 13.368 | 32 | d80f81c15a |
| s34 | 7.968 | 20 | e4befb7d67 |
| s35 | 14.784 | 33 | 5ccf024e72 |
| s36 | 3.312 | 10 | 094d0eeb07 |
| s37 | 7.512 | 26 | 24faf348f9 |
| s38 | 8.112 | 33 | 3d07b9defc |

**Architecture.** Remotion (React, frame-based) rendered scene by scene into cached chunks through @remotion/renderer; chunks concatenated and the narration track laid down with the ffmpeg in the Remotion compositor (loudnorm to -16 LUFS).

**Soundtrack.** Undertow (strudel-bench f63f2c5 (songs/undertow.strudel not yet committed), songs/undertow.strudel c7fbeafb07, 84 bpm D:minor; cleared; no samples). Mix c6ec415bae: music -20.8 dB under the voice while it speaks, peak -1.3 dB.

| Cue | Asset | From | To | Gain | Level |
|---|---|---|---|---|---|
| opening | undertow/pulse | 0.0s | 18.3s | -11 dB | -37.6 dB |
| evidence | undertow/texture | 18.3s | 407.2s | -13 dB | -40.3 dB |
| ending | undertow/pulse | 407.2s | 424.1s | -11 dB | -38.2 dB |

**Clearance.** **Not cleared for public release:** narration is draft only: unofficial Microsoft Edge read-aloud API, no terms for published media. A passing build is technical completion only; a person approves the release.

**Fingerprints.** script 69c62d9c0e, storyboard 8464572385, narration b0c83b3091, config 97689a8a89, music c6ec415bae.

## QA: passed (36 of 36)

| Check | Result | Detail |
|---|---|---|
| mp4 decodable | ok | 424.149s |
| video stream | ok | h264 1920x1080 @ 30 |
| resolution | ok | 1920x1080 |
| frame rate | ok | 30 |
| h264 | ok | h264 |
| frame count | ok | 12724 frames, timeline 12724 |
| duration in range | ok | 424.15s in [423.1,425.1] |
| duration matches timeline | ok | 424.149s vs 424.133s (12724 frames) |
| audio stream | ok | aac 48000 Hz x2 |
| aac | ok | aac |
| audio length matches video | ok | 0.016s apart |
| no clipping | ok | peak -1.4 dB, mean -19.3 dB |
| no long silence | ok | none >= 3s |
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
| assets and kinds supported | ok | 7 kinds |
| music cues resolve | ok | 3 cues over 1 compositions |
| soundtrack mixed | ok | 3 cues, 2026-10-22T02:19:28.627Z |
| mix is of this cue sheet | ok | mix c6ec415bae, cue sheet c6ec415bae |
| every cue sounded | ok | 3 cues audible where placed |
| music under the voice | ok | -20.8 dB relative to speech (want -40 to -10) |
| mix under the ceiling | ok | peak -1.3 dB, ceiling -1 dB |
| scene boundaries follow measured audio | ok | 27 scenes, 38 sentences |
| cues inside their sentences | ok | 4 cues |
| final scene complete | ok | ends 424.13s |
| no blank sections | ok | none |
| every scene has content | ok | mid-scene luma varies in every scene |

Inspection frames: 59 in video/frames/; contact sheet topics/ai-coding/scripts/decision-who-benefits/video/contact-sheet.png.

## Known limitations

- NOT FOR PUBLICATION: narration is draft only: unofficial Microsoft Edge read-aloud API, no terms for published media; re-narrate with a commercial provider (VK_TTS_PROVIDER=openai, OPENAI_API_KEY) before release
- word boundaries from edge-tts group a numeral with the word before it; the span is split by letters, so a numeral cue can be a few frames early
- system fonts (Georgia, Segoe UI): renders on another machine may set type differently
- scene transitions are a short fade over the field; no cross-dissolve between scenes
- automated QA checks integrity and consistency, not editorial quality: a person reviews the contact sheet and the video before any publication decision
- music levels are measured, not heard: a person judges the balance and the continuity in the review pass
