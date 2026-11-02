# Build report: Has a leap second ever been taken away?

test-fixture / decision:most-discussed-claims, 2026-11-02T03:07:01.523Z. `npm run video -- qa test-fixture decision:most-discussed-claims`

**Segment.** 3 of 2 storyboard scenes (sc01 to end), 2 sentences. Kinds: sc01 stat-tiles, sc02 title, end close-card.

**Output.** topics/test-fixture/scripts/decision-most-discussed-claims/video/segment.mp4: 32.17s, 1920x1080 @ 30 fps, h264 + aac, 965 frames, rendered in 0s ($0 (local CPU)).

**Narration.** edge / en-US-AndrewMultilingualNeural (rate +0%), mp3, 14.52s of speech at about 153 wpm, $0 (edge-tts, no key). Licence: draft only: unofficial Microsoft Edge read-aloud API, no terms for published media. **Draft only, not publishable.**

| Sentence | Seconds | Boundaries | Audio sha |
|---|---|---|---|
| s01 | 8.784 | 18 | 486ae08c02 |
| s02 | 5.736 | 17 | e6877057de |

**Architecture.** Remotion (React, frame-based) rendered scene by scene into cached chunks through @remotion/renderer; chunks concatenated and the narration track laid down with the ffmpeg in the Remotion compositor (loudnorm to -16 LUFS).

**Soundtrack.** Undertow (strudel-bench f63f2c5 (songs/undertow.strudel not yet committed), songs/undertow.strudel c7fbeafb07, 84 bpm D:minor; cleared; no samples). Mix a9eda4a5fd: music -17.2 dB under the voice while it speaks, peak -2.6 dB.

| Cue | Asset | From | To | Gain | Level |
|---|---|---|---|---|---|
| ending | undertow/pulse | 0.0s | 32.2s | -11 dB | -35.9 dB |

**Clearance.** **Not cleared for public release:** narration is draft only: unofficial Microsoft Edge read-aloud API, no terms for published media; when the draft is accepted, "npm run video -- final test-fixture decision:most-discussed-claims --approved-by "your name"" re-narrates it for release. A passing build is technical completion only; a person approves the release.

**Fingerprints.** script 863fc4b5a5, storyboard 3dc8e97569, narration c935493d9c, config 129a2f5a9b, look bf7e3cb00f, music a9eda4a5fd.

## QA: passed (37 of 37)

| Check | Result | Detail |
|---|---|---|
| mp4 decodable | ok | 32.170s |
| video stream | ok | h264 1920x1080 @ 30 |
| resolution | ok | 1920x1080 |
| frame rate | ok | 30 |
| h264 | ok | h264 |
| frame count | ok | 965 frames, timeline 965 |
| duration in range | ok | 32.17s in [31.2,33.2] |
| duration matches timeline | ok | 32.170s vs 32.167s (965 frames) |
| runtime | ok | 14.6s spoken against a 15 s target |
| audio stream | ok | aac 48000 Hz x2 |
| aac | ok | aac |
| audio length matches video | ok | 0.003s apart |
| no clipping | ok | peak -2.6 dB, mean -23 dB |
| no long silence | ok | none >= 3s before the end scene |
| narration not truncated | ok | 2 sentences fit their slots |
| scene order | ok | sc01 to sc02 (2) |
| scenes contiguous in storyboard | ok | from sc01 |
| every storyboard scene rendered | ok | 2 scenes |
| every script sentence narrated | ok | 2 sentences in script order |
| sentences in script order | ok | 2 sentences |
| narration matches script | ok | every sentence verbatim |
| fingerprints | ok | script 863fc4b5a5, storyboard 3dc8e97569 (locked) |
| citations present | ok | 2 on-screen citations resolved |
| chart data matches storyboard | ok | 1 charts |
| excerpts resolve | ok | 0 excerpts with their highlights |
| assets and kinds supported | ok | 3 kinds |
| music cues resolve | ok | 1 cues over 1 compositions |
| soundtrack mixed | ok | 1 cues, 2026-11-02T03:06:34.759Z |
| mix is of this cue sheet | ok | mix a9eda4a5fd, cue sheet a9eda4a5fd |
| every cue sounded | ok | 1 cues audible where placed |
| music under the voice | ok | -17.2 dB relative to speech (want -40 to -10) |
| mix under the ceiling | ok | peak -2.6 dB, ceiling -1 dB |
| scene boundaries follow measured audio | ok | 3 scenes, 2 sentences |
| cues inside their sentences | ok | 0 cues |
| final scene complete | ok | ends 32.17s |
| no blank sections | ok | none |
| every scene has content | ok | mid-scene luma varies in every scene |

Inspection frames: 7 in video/frames/; contact sheet topics/test-fixture/scripts/decision-most-discussed-claims/video/contact-sheet.png.

## Known limitations

- NOT FOR PUBLICATION: narration is draft only: unofficial Microsoft Edge read-aloud API, no terms for published media; once the draft is accepted, "npm run video -- final <topic> <story-id> --approved-by "your name"" re-narrates it with Azure for release
- word boundaries from edge-tts group a numeral with the word before it; the span is split by letters, so a numeral cue can be a few frames early
- system fonts (Georgia, Segoe UI): renders on another machine may set type differently
- scene transitions are a short fade over the field; no cross-dissolve between scenes
- automated QA checks integrity and consistency, not editorial quality: a person reviews the contact sheet and the video before any publication decision
- music levels are measured, not heard: a person judges the balance and the continuity in the review pass
