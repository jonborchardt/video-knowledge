# Brief: plan the storyboard

Give an agent this file plus the topic id and story id. The agent reads
`topics/<topic>/scripts/<slug>/script.json`, `validation.json` (its `scriptFingerprint`) and
`evidence-package.json`, writes `topics/<topic>/scripts/<slug>/storyboard.json`, and runs
`npm run script -- storyboard <topic> <story-id>`, which fills in the narration and timing from the
script and checks every figure and citation. The script is the only source of words: scenes name
sentence ids and never carry narration of their own. A storyboard is planned against a script
that is not `blocked`.

## Scenes

Colours and marks come from the institution's kit through the video's `theme`: describe roles
(the accent, the data colour, a loss) rather than naming colours of your own.

Cut the narration into scenes of one to four sentences, in script order, every sentence in
exactly one scene. Pace deliberately: a hook scene can hold one sentence; an investigation scene
can hold three. Add `pauseSeconds` where the viewer needs a beat (after a reveal, before the
answer). Plan no closing or end-screen scene: a landscape video of a published topic ends on the
institution's close card and end screen, which the timeline appends after the last scene unnarrated.
Each scene:

```json
{
  "id": "sc03",
  "sentences": ["s05", "s06"],
  "purpose": "Show the viewer the pitch in the recruiters' own words before the data arrives.",
  "visual": {
    "category": "typography",
    "description": "Dark field; the recruiter quote types on in large serif, the channel name small beneath; the word 'leverage' holds and turns amber as the sentence ends.",
    "onScreenText": ["\"finally create the leverage that you need\""],
    "assetIds": ["quote-card"]
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
- `visual.chart`: `{"type": "bar", "title": "...", "points": [{"label": "...", "value": 47, "unit": "percent", "display": "47%", "cite": "<passage>"}], "note": "..."}`.
  `type` is one of `bar`, `stacked-bar`, `dot-plot`, `waffle`, `table`, `stat-tiles`.
  Each point is numeric: `value` is the number to draw, `unit` is `percent`, `usd`, `count` or
  `ratio` (for a ratio, `display` is "1 in 238" and `value` is 238), `display` is the figure as the
  passage states it (its figures must all be in the cited passage, and one of them must equal
  `value`), and `qualifier` (`lt`, `lte`, `gt`, `gte`, `about`) carries "less than $84" or "$1,000 or
  less". Chart only what the passage gives: an aggregate is a bar or a big number, not a
  distribution; a rank table is a table, not a curve. Put what the chart must not imply in `note`.
- `assets` (top level): `{"quote-card": {"kind": "component", "description": "Recruiter quote card, text only, no faces or branding"}}`;
  `kind` is `component`, `animation`, `image` or `document-render`. A scene lists what it needs in
  `visual.assetIds`; an unknown id blocks, an unused asset warns, and a `document-render` asset
  wants the scene's `visual.excerpt`. `visual.description` is guidance for a designer and is never
  checked; the registry is what has to be produced.
- A renderer reads `timing` (one entry per sentence, absolute seconds), `visual.category`,
  `visual.chart.points`, `citations` and `assetIds`; `visual.description` and `direction` are
  guidance for a human. Timing comes from a numeral-aware spoken-word estimate ("$1,018,350" takes
  longer than one word) at the script's words per minute, plus `pauseSeconds` after the scene's
  last sentence.
- `visual.excerpt`: `{"cite": "<passage>", "highlight": "<the words to mark>"}` for a
  document-excerpt scene; the highlight must be in the passage.
- `onScreenText`: short lines; any figure in them must be in the scene's narration or a cited passage.
- `citations`: what appears on screen for the claim being made, as `{"label": "AARP, 2018 survey (n=601)", "cite": "<passage>"}`
  or `{"label": "...", "source": "<source id>"}`; keep the label tied to the specific finding.
- `direction`: transitions, animation beats, timing.

## What the renderer draws

The video stage maps each scene to a renderer (`src/video/kinds.ts`, `GENERIC`); a scene nothing
draws fails the build. Plan within this vocabulary:

- `typography`: one line is a `title`, one line ending in `?` a `question` (typed on), every line
  in quotation marks a `quote`, several lines a `list` built one per sentence.
- `data-chart` by `chart.type`: `bar` (horizontal bars; draws only `percent` and `count` points),
  `stacked-bar` and `dot-plot` (percentages totalling at most 100), `waffle`, `table` (a rank
  table), `stat-tiles` (one tile per point, any unit: dollars and mixed units go here).
- `document-excerpt` with `visual.excerpt`: the cited passage with the highlight.
- `transition`: a split field or wipe.
- Assets that bring their own renderer: `phone-ui` (animation), `node-tree`, `evidence-cards`,
  `person-grid`, `commission-icons` (diagrams), `disclosure-thumbnails` (excerpt), `dot-plot-601`.
  Use `assetIds` only from this list or for an asset you register for a graphic to be built.
- `diagram` and `animation` without one of those assets are built as bespoke graphics after this
  stage (`scripts/briefs/graphics.md`) from your `visual.description`: describe them precisely
  (what is drawn, its labels, what moves and when), because the builder works from that alone.

Quote cards carry only the quoted words; the citation names the speaker or source. On-screen labels
should be words the narration speaks, so they can appear as they are said; a label the narration
never says needs its own beat in `direction`.

## The file

```json
{
  "topic": "<topic>",
  "story": "<story id>",
  "scriptFingerprint": "<validation.json scriptFingerprint>",
  "generation": { "model": "<model id>", "brief": "scripts/briefs/storyboard.md", "date": "<ISO date>" },
  "assets": { "<id>": { "kind": "component", "description": "..." } },
  "scenes": [ ... ]
}
```

`npm run script -- storyboard <topic> <story-id>` rejects a scene whose sentences are missing,
repeated or out of order, a chart point whose display does not state its value or is not in the
cited passage, an on-screen figure not in a cited passage, a citation outside the evidence
package, an asset id that is not registered, and a plan made against an older script or an older
validation. It writes `storyboard.md`
and updates `review.md`.

Final reply: scene count and runtime, how many scenes are charts, diagrams, excerpts, typography,
images, footage, and the three visuals that most need a designer's judgment.

## Short format

When the package has a `short` block, the frame is vertical (1080 x 1920) and the renderer draws from a
smaller vocabulary; a scene outside it fails the render check, never gets a placeholder.

- Three to six scenes; the storyboard blocks past `short.maxSeconds` (60) of estimated narration.
- Categories: `typography` (one line is a title, a line ending in `?` a question, lines in quotation marks
  a quote, several lines a list), `data-chart` with `chart.type` `bar` (percent and count points) or
  `stat-tiles` (any unit; at most four points), `document-excerpt` with `visual.excerpt`. No diagrams,
  animations, images, footage or other chart types.
- On-screen lines of at most 24 characters, at most four per scene: the frame is a phone held upright.
- The parent's chart for the extracted scene may be reused as it is (its points already cite passages).
- One citation per scene at most; the label is read at phone size, so keep it to a study name and year.
- The video draws the institutional badge, the format eyebrow and the captions itself; plan no scene for
  them and no ceremonial intro. The `close` section's scene is drawn as the end card (seal, the full inquiry's
  question, the call to action): give it `typography` with at most two short lines, or none.
