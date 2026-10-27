# Build report: Is AI-Written Code Harder to Maintain?

ai-coding / decision:quality-and-understanding, 2026-10-27T01:26:54.524Z. `npm run video -- spike ai-coding decision:quality-and-understanding`

**Segment.** 32 of 31 storyboard scenes (sc01 to end), 36 sentences. Kinds: sc01 question, sc02 title, sc03 excerpt, sc04 quote, sc05 question, sc06 excerpt, sc07 title, sc08 excerpt, sc09 excerpt, sc10 quote, sc11 question, sc12 list, sc13 stat-tiles, sc14 title, sc15 excerpt, sc16 excerpt, sc17 stat-tiles, sc29 stat-tiles, sc30 list, sc18 stat-tiles, sc19 excerpt, sc20 title, sc21 title, sc22 stat-tiles, sc23 stat-tiles, sc24 title, sc25 title, sc31 title, sc26 title, sc27 quote, sc28 list, end close-card.

**Output.** topics/ai-coding/scripts/decision-quality-and-understanding/video/segment.mp4: 362.35s, 1920x1080 @ 30 fps, h264 + aac, 10870 frames, rendered in 1534.3s ($0 (local CPU)).

**Narration.** edge / en-US-AndrewMultilingualNeural (rate +0%), mp3, 335.21s of speech at about 163 wpm, $0 (edge-tts, no key). Licence: draft only: unofficial Microsoft Edge read-aloud API, no terms for published media. **Draft only, not publishable.**

| Sentence | Seconds | Boundaries | Audio sha |
|---|---|---|---|
| s01 | 5.544 | 19 | 9fcc140354 |
| s02 | 8.592 | 20 | e5fcff80fa |
| s03 | 12.24 | 31 | 957e798268 |
| s04 | 12.048 | 24 | d798c4d7d4 |
| s05 | 5.04 | 17 | ce9ec11d95 |
| s06 | 5.832 | 14 | ab42426a77 |
| s07 | 8.952 | 27 | 4f3cc255fe |
| s08 | 8.328 | 20 | 7e2773fb89 |
| s09 | 9.792 | 26 | 98efbe6723 |
| s10 | 7.368 | 23 | de051caa35 |
| s11 | 2.256 | 9 | 49f552532e |
| s12 | 11.832 | 27 | f7cb8fd74b |
| s13 | 5.64 | 17 | ed68f6fe2b |
| s14 | 8.352 | 19 | 4b62406c53 |
| s15 | 4.992 | 16 | 621ec10935 |
| s16 | 10.032 | 32 | ba1e5416c5 |
| s17 | 11.688 | 28 | 4309574710 |
| s18 | 9.816 | 28 | e76e8067ec |
| s30 | 12 | 23 | 95d1fd86a6 |
| s34 | 13.968 | 33 | eae55a6115 |
| s31 | 8.712 | 26 | 6c0e74c808 |
| s35 | 18.792 | 45 | fd57ce90ae |
| s19 | 9.312 | 27 | 3e4fffb7d0 |
| s20 | 9.456 | 23 | a75a71c599 |
| s21 | 5.496 | 19 | da503ad13d |
| s32 | 12.408 | 35 | 52af6a3855 |
| s33 | 8.256 | 22 | 8120d19507 |
| s22 | 11.136 | 25 | 06c859d077 |
| s23 | 7.632 | 24 | cd7b383a1a |
| s24 | 13.944 | 41 | de8363522d |
| s25 | 8.064 | 20 | 740a1153fe |
| s36 | 12.168 | 35 | d8e0534075 |
| s26 | 14.496 | 47 | 7b4413bd41 |
| s27 | 8.688 | 28 | 80e9b2e7c7 |
| s28 | 9.24 | 28 | 3a24966c38 |
| s29 | 3.096 | 8 | eaf49c629f |

**Architecture.** Remotion (React, frame-based) rendered scene by scene into cached chunks through @remotion/renderer; chunks concatenated and the narration track laid down with the ffmpeg in the Remotion compositor (loudnorm to -16 LUFS).

**Soundtrack.** Undertow (strudel-bench f63f2c5 (songs/undertow.strudel not yet committed), songs/undertow.strudel c7fbeafb07, 84 bpm D:minor; cleared; no samples). Mix 386db46166: music -19.7 dB under the voice while it speaks, peak -1.3 dB.

| Cue | Asset | From | To | Gain | Level |
|---|---|---|---|---|---|
| opening | undertow/pulse | 0.0s | 15.3s | -11 dB | -37.9 dB |
| setup | undertow/active | 15.3s | 40.1s | -13 dB | -38.0 dB |
| evidence | undertow/texture | 40.1s | 272.7s | -13 dB | -40.3 dB |
| ending | undertow/pulse | 272.7s | 362.3s | -11 dB | -36.4 dB |

**Clearance.** **Not cleared for public release:** narration is draft only: unofficial Microsoft Edge read-aloud API, no terms for published media; when the draft is accepted, "npm run video -- final ai-coding decision:quality-and-understanding --approved-by <name>" re-narrates it for release. A passing build is technical completion only; a person approves the release.

**Fingerprints.** script cfd7e3449b, storyboard 8b8372dc42, narration 78250d6a47, config 3249740624, music 386db46166.

## QA: passed (36 of 36)

| Check | Result | Detail |
|---|---|---|
| mp4 decodable | ok | 362.346s |
| video stream | ok | h264 1920x1080 @ 30 |
| resolution | ok | 1920x1080 |
| frame rate | ok | 30 |
| h264 | ok | h264 |
| frame count | ok | 10870 frames, timeline 10870 |
| duration in range | ok | 362.35s in [361.3,363.3] |
| duration matches timeline | ok | 362.346s vs 362.333s (10870 frames) |
| audio stream | ok | aac 48000 Hz x2 |
| aac | ok | aac |
| audio length matches video | ok | 0.013s apart |
| no clipping | ok | peak -1.3 dB, mean -19.6 dB |
| no long silence | ok | none >= 3s before the end scene |
| narration not truncated | ok | 36 sentences fit their slots |
| scene order | ok | sc01 to sc28 (31) |
| scenes contiguous in storyboard | ok | from sc01 |
| every storyboard scene rendered | ok | 31 scenes |
| every script sentence narrated | ok | 36 sentences in script order |
| sentences in script order | ok | 36 sentences |
| narration matches script | ok | every sentence verbatim |
| fingerprints | ok | script cfd7e3449b, storyboard 8b8372dc42 (locked) |
| citations present | ok | 26 on-screen citations resolved |
| chart data matches storyboard | ok | 6 charts |
| excerpts resolve | ok | 7 excerpts with their highlights |
| assets and kinds supported | ok | 7 kinds |
| music cues resolve | ok | 4 cues over 1 compositions |
| soundtrack mixed | ok | 4 cues, 2026-10-27T01:25:27.291Z |
| mix is of this cue sheet | ok | mix 386db46166, cue sheet 386db46166 |
| every cue sounded | ok | 4 cues audible where placed |
| music under the voice | ok | -19.7 dB relative to speech (want -40 to -10) |
| mix under the ceiling | ok | peak -1.3 dB, ceiling -1 dB |
| scene boundaries follow measured audio | ok | 32 scenes, 36 sentences |
| cues inside their sentences | ok | 3 cues |
| final scene complete | ok | ends 362.33s |
| no blank sections | ok | none |
| every scene has content | ok | mid-scene luma varies in every scene |

Inspection frames: 68 in video/frames/; contact sheet topics/ai-coding/scripts/decision-quality-and-understanding/video/contact-sheet.png.

## Known limitations

- NOT FOR PUBLICATION: narration is draft only: unofficial Microsoft Edge read-aloud API, no terms for published media; once the draft is accepted, "npm run video -- final <topic> <story-id> --approved-by <name>" re-narrates it with Azure for release
- word boundaries from edge-tts group a numeral with the word before it; the span is split by letters, so a numeral cue can be a few frames early
- system fonts (Georgia, Segoe UI): renders on another machine may set type differently
- scene transitions are a short fade over the field; no cross-dissolve between scenes
- automated QA checks integrity and consistency, not editorial quality: a person reviews the contact sheet and the video before any publication decision
- music levels are measured, not heard: a person judges the balance and the continuity in the review pass
