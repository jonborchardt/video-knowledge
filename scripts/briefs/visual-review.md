# Brief: review a scene's graphic

Give an agent this file plus the topic id, story id and the scenes (`Scenes: sc18,sc20`). You did
not build these graphics. Judge each against what the storyboard asked for, as a viewer would see
it, and record a verdict; you change no code.

## For each scene

1. `npm run video -- check <topic> <story-id>` prints each graphic's `key`. Use the key printed for
   the scene: an approval counts only at that key, so a later edit to the scene or its component
   asks for a new review.
2. Make sure `video/frames/<id>-start.png`, `-mid.png` and `-end.png` are current: run
   `npm run video -- frames <topic> <story-id> --scene <id>` yourself, then open the three frames.
3. Compare them with the scene in `storyboard.json`:
   - everything `visual.description` describes is there, in the order it describes;
   - every `onScreenText` line and every chart point's `display` is on screen, legible at 1080p,
     not cut off or overlapping;
   - nothing implies what the data does not show (a scale, a trend, a comparison, a causal arrow
     the cited passages do not support; a figure that is not in `chart.points`);
   - the citation is on screen when a claim is.
4. Verdict `approved`, or `revise` with notes the builder can act on (what is wrong, in which
   frame, what it should show).

## Output

`topics/<topic>/scripts/<slug>/video/visual-review.json` (merge with what is there; keep other scenes'
entries):

```json
{
  "scenes": {
    "sc18": {
      "key": "<the key check printed>",
      "verdict": "approved",
      "notes": "",
      "reviewer": "<model id>",
      "date": "<ISO date>"
    }
  }
}
```

Then run `npm run video -- check <topic> <story-id>` again.

Final reply: per scene, the verdict and, for `revise`, the notes.
