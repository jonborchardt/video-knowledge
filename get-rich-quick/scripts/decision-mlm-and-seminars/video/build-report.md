# Build report: How Much Money Do MLM Participants Actually Make?

get-rich-quick / decision:mlm-and-seminars, 2026-10-18T02:00:26.314Z. `npm run video -- spike get-rich-quick decision:mlm-and-seminars`

**Segment.** Scenes sc01, sc02, sc03, sc04 (sc01: phone, sc02: tree, sc03: quote, sc04: stacked-bar); sentences s01, s02, s03, s04, s05.

**Output.** get-rich-quick/scripts/decision-mlm-and-seminars/video/segment.mp4: 40.70s, 1920x1080 @ 30 fps, h264 + aac, 1221 frames rendered in 53.4s ($0 (local CPU)).

**Narration.** edge / en-US-AndrewMultilingualNeural (rate +0%), mp3, 37.2s of speech, $0 (edge-tts, no key).

| Sentence | Seconds | Boundaries | Audio sha |
|---|---|---|---|
| s01 | 3.48 | 11 | b7725068b4 |
| s02 | 9.144 | 37 | c135cf6ca7 |
| s03 | 10.608 | 32 | 1309465b54 |
| s04 | 9.792 | 22 | 29178f32dd |
| s05 | 4.176 | 9 | 78d584530e |

**Architecture.** Remotion (React, frame-based) rendered through @remotion/renderer; ffmpeg from the Remotion compositor for QA.

**Fingerprints.** script 51e7788c5c, storyboard 0c12e8fcc7, narration 41ed225fd0, config a33704e01a.

## QA: passed (52 of 52)

| Check | Result | Detail |
|---|---|---|
| mp4 decodable | ok | 40.704s |
| video stream | ok | h264 1920x1080 @ 30 |
| resolution | ok | 1920x1080 |
| frame rate | ok | 30 |
| h264 | ok | h264 |
| duration in range | ok | 40.70s in [30,60] |
| duration matches timeline | ok | 40.704s vs 40.700s (1221 frames) |
| audio stream | ok | aac 48000 Hz x2 |
| aac | ok | aac |
| audio length matches video | ok | 0.004s apart |
| no clipping | ok | peak -7.6 dB, mean -25.2 dB |
| no long silence | ok | none >= 2s |
| narration s01 not truncated | ok | audio 3.48s, last word 3.1125s, slot 105 frames |
| narration s02 not truncated | ok | audio 9.144s, last word 8.7625s, slot 275 frames |
| narration s03 not truncated | ok | audio 10.608s, last word 10.15s, slot 319 frames |
| narration s04 not truncated | ok | audio 9.792s, last word 9.4125s, slot 294 frames |
| narration s05 not truncated | ok | audio 4.176s, last word 3.8125s, slot 126 frames |
| scene order | ok | sc01 sc02 sc03 sc04 |
| scenes contiguous in storyboard | ok | from sc01 |
| narration s01 matches script | ok | Somewhere in your messages there is probably a pitch like th |
| narration s02 matches script | ok | A friend you have not heard from in years has started a busi |
| narration s03 matches script | ok | The recruiters have a word for that second part: one trainer |
| narration s04 matches script | ok | In a study published in 2018, AARP asked 601 Americans who h |
| narration s05 matches script | ok | Only 25 percent said they made any profit at all. |
| fingerprints | ok | script 51e7788c5c, storyboard 0c12e8fcc7 |
| sc01 citations | ok | none |
| sc01 assets | ok | phone-ui |
| sc01 rendered as | ok | phone |
| sc02 citations | ok | none |
| sc02 assets | ok | node-tree |
| sc02 rendered as | ok | tree |
| sc03 citations | ok | Network-marketing recruiting video (YouTube) |
| sc03 assets | ok | none |
| sc03 rendered as | ok | quote |
| sc04 citations | ok | AARP, 2018 survey of 601 current and former MLM participants |
| sc04 chart data | ok | lost money=47%, broke even=27%, made a profit=25% |
| sc04 assets | ok | none |
| sc04 rendered as | ok | stacked-bar |
| scene boundaries follow measured audio | ok | sc01 0.00-4.60s, sc02 4.60-13.77s, sc03 13.77-25.40s, sc04 25.40-40.70s |
| sc01 cue notify inside s01 | ok | "messages" at 1.20s, sentence 0.60-4.10s |
| sc02 cue sell inside s02 | ok | "sell" at 10.77s, sentence 4.60-13.77s |
| sc02 cue tier2 inside s02 | ok | "everyone" at 12.07s, sentence 4.60-13.77s |
| sc03 cue emphasis inside s03 | ok | "leverage" at 20.50s, sentence 13.77-24.40s |
| sc04 cue count inside s04 | ok | "601" at 28.47s, sentence 25.40-35.20s |
| sc04 cue point:lost money inside s04 | ok | "47" at 32.10s, sentence 25.40-35.20s |
| sc04 cue point:made a profit inside s05 | ok | "25" at 35.80s, sentence 35.50-39.70s |
| final scene complete | ok | ends 40.70s |
| no blank sections | ok | longest flat run 0.5s ending at 0.0s |
| sc01 rendered | ok | mid-scene luma sd 10.4 |
| sc02 rendered | ok | mid-scene luma sd 5.5 |
| sc03 rendered | ok | mid-scene luma sd 4.7 |
| sc04 rendered | ok | mid-scene luma sd 24.9 |

Inspection frames: 16 in video/frames/.

## Known limitations

- edge-tts is an unofficial API with no stated licence for published media; confirm before release or switch provider
- word boundaries group a numeral with the word before it ("asked 601"), so a numeral cue lands at the start of that pair
- system fonts (Georgia, Segoe UI): renders on another machine may set type differently
- no loudness normalisation; one voice at one rate is consistent enough for the spike
- scene transitions are a short fade over the field; no cross-dissolve between scenes
