# Build report: Has a leap second ever been taken away?

test-fixture / decision:most-discussed-claims, 2026-11-01T01:21:19.039Z. `npm run video -- qa test-fixture decision:most-discussed-claims`

**Segment.** 3 of 2 storyboard scenes (sc01 to end), 2 sentences. Kinds: sc01 question, sc02 stat-tiles, end close-card.

**Output.** topics/test-fixture/scripts/decision-most-discussed-claims/video/segment.mp4: 33.54s, 1920x1080 @ 30 fps, h264 + aac, 1006 frames, rendered in 0s ($0 (local CPU)).

**Narration.** edge / en-US-AndrewMultilingualNeural (rate +0%), mp3, 16.39s of speech at about 128 wpm, $0 (edge-tts, no key). Licence: draft only: unofficial Microsoft Edge read-aloud API, no terms for published media. **Draft only, not publishable.**

| Sentence | Seconds | Boundaries | Audio sha |
|---|---|---|---|
| s01 | 2.976 | 8 | c2411a8477 |
| s02 | 13.416 | 24 | b2d9081752 |

**Architecture.** Remotion (React, frame-based) rendered scene by scene into cached chunks through @remotion/renderer; chunks concatenated and the narration track laid down with the ffmpeg in the Remotion compositor (loudnorm to -16 LUFS).

**Soundtrack.** Undertow (strudel-bench f63f2c5 (songs/undertow.strudel not yet committed), songs/undertow.strudel c7fbeafb07, 84 bpm D:minor; cleared; no samples). Mix 27ff65bcb2: music -18.4 dB under the voice while it speaks, peak -3.6 dB.

| Cue | Asset | From | To | Gain | Level |
|---|---|---|---|---|---|
| opening | undertow/pulse | 0.0s | 4.1s | -11 dB | -43.1 dB |
| ending | undertow/pulse | 4.1s | 33.5s | -11 dB | -35.9 dB |

**Clearance.** **Not cleared for public release:** narration is draft only: unofficial Microsoft Edge read-aloud API, no terms for published media; when the draft is accepted, "npm run video -- final test-fixture decision:most-discussed-claims --approved-by <name>" re-narrates it for release. A passing build is technical completion only; a person approves the release.

**Fingerprints.** script 9fd59570ce, storyboard 2fbeda10fa, narration 8d3f9ca428, config d16ce6e663, look bf7e3cb00f, music 27ff65bcb2.

## QA: passed (37 of 37)

| Check | Result | Detail |
|---|---|---|
| mp4 decodable | ok | 33.536s |
| video stream | ok | h264 1920x1080 @ 30 |
| resolution | ok | 1920x1080 |
| frame rate | ok | 30 |
| h264 | ok | h264 |
| frame count | ok | 1006 frames, timeline 1006 |
| duration in range | ok | 33.54s in [32.5,34.5] |
| duration matches timeline | ok | 33.536s vs 33.533s (1006 frames) |
| runtime | ok | 17.5s narrated against a 15 s target |
| audio stream | ok | aac 48000 Hz x2 |
| aac | ok | aac |
| audio length matches video | ok | 0.003s apart |
| no clipping | ok | peak -3.6 dB, mean -22.5 dB |
| no long silence | ok | none >= 3s before the end scene |
| narration not truncated | ok | 2 sentences fit their slots |
| scene order | ok | sc01 to sc02 (2) |
| scenes contiguous in storyboard | ok | from sc01 |
| every storyboard scene rendered | ok | 2 scenes |
| every script sentence narrated | ok | 2 sentences in script order |
| sentences in script order | ok | 2 sentences |
| narration matches script | ok | every sentence verbatim |
| fingerprints | ok | script 9fd59570ce, storyboard 2fbeda10fa (locked) |
| citations present | ok | 1 on-screen citations resolved |
| chart data matches storyboard | ok | 1 charts |
| excerpts resolve | ok | 0 excerpts with their highlights |
| assets and kinds supported | ok | 3 kinds |
| music cues resolve | ok | 2 cues over 1 compositions |
| soundtrack mixed | ok | 2 cues, 2026-11-01T01:20:54.662Z |
| mix is of this cue sheet | ok | mix 27ff65bcb2, cue sheet 27ff65bcb2 |
| every cue sounded | ok | 2 cues audible where placed |
| music under the voice | ok | -18.4 dB relative to speech (want -40 to -10) |
| mix under the ceiling | ok | peak -3.6 dB, ceiling -1 dB |
| scene boundaries follow measured audio | ok | 3 scenes, 2 sentences |
| cues inside their sentences | ok | 1 cues |
| final scene complete | ok | ends 33.53s |
| no blank sections | ok | none |
| every scene has content | ok | mid-scene luma varies in every scene |

Inspection frames: 8 in video/frames/; contact sheet topics/test-fixture/scripts/decision-most-discussed-claims/video/contact-sheet.png.

## Known limitations

- NOT FOR PUBLICATION: narration is draft only: unofficial Microsoft Edge read-aloud API, no terms for published media; once the draft is accepted, "npm run video -- final <topic> <story-id> --approved-by <name>" re-narrates it with Azure for release
- word boundaries from edge-tts group a numeral with the word before it; the span is split by letters, so a numeral cue can be a few frames early
- system fonts (Georgia, Segoe UI): renders on another machine may set type differently
- scene transitions are a short fade over the field; no cross-dissolve between scenes
- automated QA checks integrity and consistency, not editorial quality: a person reviews the contact sheet and the video before any publication decision
- music levels are measured, not heard: a person judges the balance and the continuity in the review pass
