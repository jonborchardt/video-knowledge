# Brief: choose a video's calls to action

Give an agent this file plus the topic id and the story id of a packaged video. The agent runs
`npm run links -- cta <topic> <story-id>`, which prints every destination this story can point at (or why
one is unavailable), the related matters as ranked, and the current `cta.json` resolved. It may read the
story (`npm run stories -- show <topic> <story-id>`), the video's `script.md` and the matter page's sources
to judge what each destination adds. It then writes `topics/<topic>/scripts/<slug>/cta.json` and runs the
command again: the run exits 2 on a file problem, and every call to action it lists as `Dropped` failed its
value check and will not be shown.

A call to action is the one next thing that adds something the video could not. It appears in the YouTube
description (a Links block at the top) and on the matter page, never in the narration, the storyboard, the
render or the end screen. Nothing here changes a verdict, adds evidence or edits the script.

## The destinations

| Type         | Points at                                                                | Adds what the video cannot                                     |
| ------------ | ------------------------------------------------------------------------ | -------------------------------------------------------------- |
| `tool`       | the story's calculator (`tool:<id>`)                                     | the viewer's own estimate                                      |
| `evidence`   | the matter page's evidence                                               | every claim and cited line, beyond what the video had time for |
| `article`    | the matter page's released article                                       | the written answer, tables, qualifications in full             |
| `data`       | a dataset the article cites (`data:<topic>/<id>`)                        | the numbers to inspect and download                            |
| `video`      | another story's live video (`<topic>/<story-id>#youtube`)                | the next question (a chain or shared claims)                   |
| `inquiry`    | the topic (`<topic>`)                                                    | the full record on the topic                                   |
| `reference`  | an official outside page (a rebate programme, a regulator), `https` only | where to act; non-commercial                                   |
| `commercial` | an outside commercial page                                               | only as below                                                  |

The checks are code (`src/lib/cta.ts`) and fail closed: `tool` needs a tool for the story; `evidence` needs a
claim the script did not assert (when the video asserted every claim it becomes `article` if one is
released, else it is dropped); `article` needs a released article; `data` needs a dataset the article cites;
`video` needs that video live and in the same chain or sharing claims; `inquiry` needs the story's own
topic. A dropped primary falls back to the default: the matter page, "The evidence and the full answer".

## How to choose

1. **One primary**, the destination that adds the most for a viewer who just watched: a tool when the story
   has one and the question is a decision the viewer's own numbers change; else the article when it carries
   tables and qualifications the video compressed; else the evidence. Use `video` as the primary only when
   the next question is a chain the viewer will want answered.
2. **At most two secondaries**, each adding something different from the primary. None is better than one
   that repeats it.
3. **Copy**: one line, at most 80 characters, that promises no more than the destination carries. Use the
   finding labels honestly ("contested", "unresolved"); "see whether it pays in your state" only with a tool
   that takes a state; no "proven", "the truth about" or "you won't believe". No URL or partner name in the text.
4. **Related matters** (optional): `related.pin` puts story nodes first and `related.exclude` drops them,
   with `related.why` saying why. Use it only when the ranking printed is wrong for a viewer, not to promote.
5. **Commercial links: never**, unless a person has supplied the entry with its `disclosure` text and their
   `approvedBy`. You never write one yourself, never as `automated:`. Even approved, it is never the primary
   while a tool or the evidence is available, and never inside a tool's result.

## The file

```json
{
  "primary": { "type": "tool", "target": "tool:heating-cost", "text": "Run the comparison with your own prices" },
  "secondary": [{ "type": "article", "text": "The written answer, with the tables and their limits" }],
  "related": { "pin": ["heat-pumps/decision:when-does-it-pay-for-itself"], "why": "the chained question" }
}
```

`target` is a node id for `tool`, `video`, `inquiry` and `data` (optional where the story has one); `url` only
for `reference` and `commercial`. Run `npm run links -- cta <topic> <story-id>` until it prints no `PROBLEM`
and no `Dropped` line you did not intend, then stop. Re-packaging the video (`npm run video -- package`)
carries the choice into the description.
