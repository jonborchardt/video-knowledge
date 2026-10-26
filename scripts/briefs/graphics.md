# Brief: build a scene's graphic

Give an agent this file plus the topic id, story id and the scenes (`Scenes: sc18,sc20`). Each
listed scene is a `diagram` or `animation` (or a chart no generic kind draws faithfully) in
`topics/<topic>/scripts/<slug>/storyboard.json`. Build a real graphic for it: a Remotion component that
draws what the storyboard describes. Labelled text is a last resort, used only when a component
still fails its visual review after three revisions; say so in your reply when you fall back.

## For each scene

1. Read the scene: `visual.description` (what is on screen, what moves, in what order),
   `visual.onScreenText`, `visual.chart.points`, `citations`, `direction`, and its sentences in
   `script.json` (the narration the graphic sits under).
2. Reuse an existing component in `src/video/remotion/scenes/` only when it draws what the
   description says. Otherwise write a new one there, in the style of its neighbours (theme colours
   and type from `../theme`, `GUTTER`, `ramp`/`easeOut`, `cue()` and `lineFrames()` from `../../cues`).
   - Colours and marks come from the owning institution's kit through `theme` (roles such as
     `theme.glow`, `theme.data`, `alpha(theme.paper, 0.4)`; marks via `staticFile('brand/<slot>.png')`):
     a graphic never picks its own colours, and a literal hex or rgba fails the test.
   - Text comes from `onScreenText`, figures from `chart.points` (their `display`), never typed into
     the component. `render.json` `options` carry layout only (theme role names, counts of columns, which
     side), never a figure.
   - Time each element to the narration: name cues on spoken words in `render.json`
     (`"line:2": { "sentence": "s29", "word": "meters" }`); the timeline fails if the word is not
     spoken. Nothing on screen waits long for words spoken late.
   - Browser-safe: no node imports.
3. Add the component to `COMPONENTS` in `src/video/remotion/scenes/index.ts` (keyed by its file name).
4. Before drawing, check git history: the purged videos' one-off graphics (courtroom, gold-fringe flag, District
   tiers, UCC ticket signature, courts evidence, toolkit cards, protest strip, MLM pyramid, branch closing) are at
   commit `d692140` under `src/video/remotion/scenes/` and `src/video/bespoke/`; restore one rather than redraw it, then port it: those files predate the one theme, so resolve every
   `theme.motion ? A : B` to `A`, drop `background: theme.field` (the field is the backdrop now), and register its kind
   under a name no generic kind uses (`fine-print` and `waterfall` are generic now).
   Register a bespoke kind in `src/video/bespoke/<story slug>.ts` (create it, and add it to
   `src/video/bespoke/index.ts` under `<topic>/<story slug>`): `{ component, accepts: [<category>] }`.
   Kind names are unique across videos: prefix them (`hp-`, `mlm-`).
5. Name the kind for the scene in `video/render.json` `kinds`.
6. `npm run video -- frames <topic> <story-id> --scene <id>` and look at
   `video/frames/<id>-start.png`, `-mid.png`, `-end.png`. Fix what is missing, cut off, overlapping
   or unreadable, and look again.
7. `npm run validate`.

Do not edit the storyboard's words, the script, or any derived file; do not write
`video/visual-review.json` (a different agent judges your frames).

Final reply: per scene, the kind and component (new or reused), the cues added, and anything in
the description you could not draw.
