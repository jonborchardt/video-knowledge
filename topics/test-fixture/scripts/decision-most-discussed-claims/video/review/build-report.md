# Build report: Has a leap second ever been taken away?

test-fixture / decision:most-discussed-claims, 2026-11-01T03:19:26.734Z. `npm run video -- qa test-fixture decision:most-discussed-claims`

**Segment.** 3 of 2 storyboard scenes (sc01 to end), 2 sentences. Kinds: sc01 stat-tiles, sc02 title, end close-card.

**Output.** topics/test-fixture/scripts/decision-most-discussed-claims/video/segment.mp4: 35.35s, 1920x1080 @ 30 fps, h264 + aac, 1060 frames, rendered in 0s ($0 (local CPU)).

**Narration.** edge / en-US-AndrewMultilingualNeural (rate +0%), mp3, 18.7s of speech at about 144 wpm, $0 (edge-tts, no key). Licence: draft only: unofficial Microsoft Edge read-aloud API, no terms for published media. **Draft only, not publishable.**

| Sentence | Seconds | Boundaries | Audio sha |
|---|---|---|---|
| s01 | 12.72 | 23 | 22df59f809 |
| s02 | 5.976 | 18 | bda8d1f7f4 |

**Architecture.** Remotion (React, frame-based) rendered scene by scene into cached chunks through @remotion/renderer; chunks concatenated and the narration track laid down with the ffmpeg in the Remotion compositor (loudnorm to -16 LUFS).

**Soundtrack.** Undertow (strudel-bench f63f2c5 (songs/undertow.strudel not yet committed), songs/undertow.strudel c7fbeafb07, 84 bpm D:minor; cleared; no samples). Mix 2aed1fa7bf: music -17.6 dB under the voice while it speaks, peak -3 dB.

| Cue | Asset | From | To | Gain | Level |
|---|---|---|---|---|---|
| ending | undertow/pulse | 0.0s | 35.3s | -11 dB | -36.0 dB |

**Clearance.** **Not cleared for public release:** narration is draft only: unofficial Microsoft Edge read-aloud API, no terms for published media; when the draft is accepted, "npm run video -- final test-fixture decision:most-discussed-claims --approved-by <name>" re-narrates it for release. A passing build is technical completion only; a person approves the release.

**Fingerprints.** script efcf0861e8, storyboard 620dd93836, narration 4056de1b62, config 129a2f5a9b, look bf7e3cb00f, music 2aed1fa7bf.

## QA: passed (37 of 37)

| Check | Result | Detail |
|---|---|---|
| mp4 decodable | ok | 35.349s |
| video stream | ok | h264 1920x1080 @ 30 |
| resolution | ok | 1920x1080 |
| frame rate | ok | 30 |
| h264 | ok | h264 |
| frame count | ok | 1060 frames, timeline 1060 |
| duration in range | ok | 35.35s in [34.3,36.3] |
| duration matches timeline | ok | 35.349s vs 35.333s (1060 frames) |
| runtime | ok | 19.3s narrated against a 15 s target |
| audio stream | ok | aac 48000 Hz x2 |
| aac | ok | aac |
| audio length matches video | ok | 0.016s apart |
| no clipping | ok | peak -3.1 dB, mean -21.9 dB |
| no long silence | ok | none >= 3s before the end scene |
| narration not truncated | ok | 2 sentences fit their slots |
| scene order | ok | sc01 to sc02 (2) |
| scenes contiguous in storyboard | ok | from sc01 |
| every storyboard scene rendered | ok | 2 scenes |
| every script sentence narrated | ok | 2 sentences in script order |
| sentences in script order | ok | 2 sentences |
| narration matches script | ok | every sentence verbatim |
| fingerprints | ok | script efcf0861e8, storyboard 620dd93836 (locked) |
| citations present | ok | 2 on-screen citations resolved |
| chart data matches storyboard | ok | 1 charts |
| excerpts resolve | ok | 0 excerpts with their highlights |
| assets and kinds supported | ok | 3 kinds |
| music cues resolve | ok | 1 cues over 1 compositions |
| soundtrack mixed | ok | 1 cues, 2026-11-01T03:18:59.418Z |
| mix is of this cue sheet | ok | mix 2aed1fa7bf, cue sheet 2aed1fa7bf |
| every cue sounded | ok | 1 cues audible where placed |
| music under the voice | ok | -17.6 dB relative to speech (want -40 to -10) |
| mix under the ceiling | ok | peak -3 dB, ceiling -1 dB |
| scene boundaries follow measured audio | ok | 3 scenes, 2 sentences |
| cues inside their sentences | ok | 0 cues |
| final scene complete | ok | ends 35.33s |
| no blank sections | ok | none |
| every scene has content | ok | mid-scene luma varies in every scene |

Inspection frames: 7 in video/frames/; contact sheet topics/test-fixture/scripts/decision-most-discussed-claims/video/contact-sheet.png.

## Known limitations

- NOT FOR PUBLICATION: narration is draft only: unofficial Microsoft Edge read-aloud API, no terms for published media; once the draft is accepted, "npm run video -- final <topic> <story-id> --approved-by <name>" re-narrates it with Azure for release
- word boundaries from edge-tts group a numeral with the word before it; the span is split by letters, so a numeral cue can be a few frames early
- system fonts (Georgia, Segoe UI): renders on another machine may set type differently
- scene transitions are a short fade over the field; no cross-dissolve between scenes
- automated QA checks integrity and consistency, not editorial quality: a person reviews the contact sheet and the video before any publication decision
- music levels are measured, not heard: a person judges the balance and the continuity in the review pass
