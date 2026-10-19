# Brief: fix a failing video check

Give an agent this file plus the topic id and story id. Something the video stage checks failed:
QA in `<topic>/scripts/<slug>/video/build-report.md` (the failing checks are listed first; the
frames named there are in `video/frames/`), or the render check's `problems` in
`video/render-check.json` (`npm run video -- check <topic> <story-id>` prints them).

## Method

1. Read each failure and find its cause before changing anything. A blank stretch names a time and
   a scene: open that scene's frames (`npm run video -- frames <topic> <story-id> --scene <id>`) and
   see what is missing. A cue on an unspoken word, an unsupported scene, a chart whose units its
   kind cannot draw: the message names the scene.
2. Fix it where it belongs:
   - `video/render.json`: `cues` (`line:<n>`, `type`, `point:<label>`, on words the narration
     speaks), `options` (layout only, never a figure), `kinds` (a kind that draws the scene's
     category and units: dollars go in `stat-tiles`, not `bar`);
   - or a scene component in `src/video/remotion/scenes/` (browser-safe; a change there asks for a
     new visual review of every bespoke scene drawn with it).
     Never edit derived files (`timeline.json`, `narration.json`, the build report, `mix.json`), the
     storyboard's words or the script. If the fix needs the storyboard or the script to change, stop
     and say so.
3. Re-run the command the board named (`npm run video -- check ...` or `npm run video -- spike ...`)
   and read its last line: `RESULT: PASSED` or `ok`.

Final reply: each failure, its cause, the fix, and the result line.
