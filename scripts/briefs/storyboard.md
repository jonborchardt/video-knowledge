# Brief: plan the storyboard

Give an agent this file plus the topic id and story id. The agent reads
`<topic>/scripts/<slug>/script.json`, `validation.json` (its `scriptFingerprint`) and
`evidence-package.json`, writes `<topic>/scripts/<slug>/storyboard.json`, and runs
`npm run script -- storyboard <topic> <story-id>`, which fills in the narration and timing from the
script and checks every figure and citation. The script is the only source of words: scenes name
sentence ids and never carry narration of their own. A storyboard is planned against a script
that is not `blocked`.

## Scenes

Cut the narration into scenes of one to four sentences, in script order, every sentence in
exactly one scene. Pace deliberately: a hook scene can hold one sentence; an investigation scene
can hold three. Add `pauseSeconds` where the viewer needs a beat (after a reveal, before the
conclusion). Each scene:

```json
{
  "id": "sc03",
  "sentences": ["s05", "s06"],
  "purpose": "Show the viewer the pitch in the recruiters' own words before the data arrives.",
  "visual": {
    "category": "typography",
    "description": "Dark field; the recruiter quote types on in large serif, the channel name small beneath; the word 'leverage' holds and turns amber as the sentence ends.",
    "onScreenText": ["\"finally create the leverage that you need\""],
    "assets": ["Recruiter quote card (text only, no faces or channel branding)"]
  },
  "citations": [{ "label": "Recruiting video, 2024", "source": "<source id>" }],
  "direction": "Hard cut in; hold 1 s after the last word.",
  "pauseSeconds": 1
}
```

- `visual.category`: `data-chart`, `diagram`, `animation`, `typography`, `document-excerpt`,
  `image`, `footage`, `transition`. Prefer programmatic graphics (charts, diagrams, annotated
  excerpts, typography) wherever the evidence is numeric or documentary; an image or footage is
  for mood, not for facts; no generated image of a person as if real.
- `visual.description` is concrete enough that a motion designer builds it without re-reading the
  research: what is on screen, what moves, what is emphasised, in what order.
- `visual.chart`: `{"type": "bar", "title": "...", "series": [{"label": "...", "value": "47%", "cite": "<passage>"}], "note": "..."}`.
  Every value must be in the cited passage. Chart only what the passage gives: an aggregate is a
  bar or a big number, not a distribution; a rank table is a table, not a curve. Put what the chart
  must not imply in `note`.
- `visual.excerpt`: `{"cite": "<passage>", "highlight": "<the words to mark>"}` for a
  document-excerpt scene; the highlight must be in the passage.
- `onScreenText`: short lines; any figure in them must be in the scene's narration or a cited passage.
- `citations`: what appears on screen for the claim being made, as `{"label": "AARP, 2018 survey (n=601)", "cite": "<passage>"}`
  or `{"label": "...", "source": "<source id>"}`; keep the label tied to the specific finding.
- `direction`: transitions, animation beats, timing.

## The file

```json
{
  "topic": "<topic>",
  "story": "<story id>",
  "scriptFingerprint": "<validation.json scriptFingerprint>",
  "generation": { "model": "<model id>", "brief": "scripts/briefs/storyboard.md", "date": "<ISO date>" },
  "scenes": [ ... ]
}
```

`npm run script -- storyboard <topic> <story-id>` rejects a scene whose sentences are missing,
repeated or out of order, a chart value or on-screen figure not in a cited passage, a citation
outside the evidence package, and a plan made against an older script. It writes `storyboard.md`
and updates `review.md`.

Final reply: scene count and runtime, how many scenes are charts, diagrams, excerpts, typography,
images, footage, and the three visuals that most need a designer's judgment.
