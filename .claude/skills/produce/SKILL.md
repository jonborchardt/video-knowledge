---
name: produce
description: Drive one story from ready to a private review package (the board's packaged stage) in one run, or send a packaged story back with editor notes. Use when the user pastes "/produce <topic> <story-id>" with an "Approver:" line (copied from the production board's What next? popover), or asks to produce, finish, resume or send back a story's video.
---

# Produce

The board is the state machine; you are the loop. `npm run board -- next <topic> <story> --json`
says where the story is and what moves it on; you do that and ask again. All judgment lives in the
briefs (`scripts/briefs/`) and the fresh agents you hand them to; all bookkeeping lives in the CLIs.
A run interrupted halfway resumes by pasting the same prompt.

## Arguments

```
/produce <topic> <story-id>
Approver: <name>
Notes:
- <optional editor notes, one per line>
```

- Refuse to start when `Approver:` is missing, blank, or a placeholder (`<your name>`, `<name>`,
  anything in angle brackets). Starting the run is that person's sign-off for the lock; the release
  records it as `automated: /produce run started by <name>`.
- No notes: a fresh run or a resume. Notes: a send-back pass (below).

## Setup

- Work on branch `produce/<topic>-<story slug>` (`storySlug`: the story id with every run of
  non-alphanumerics turned into `-`, e.g. `decision:when-does-it-pay-for-itself` ->
  `decision-when-does-it-pay-for-itself`). Create it from the current branch, or check it out if it
  exists. Never push.
- A Short's story id is `<story-id>/shorts/<slug>` (a ready candidate in the parent's `shorts.json`); the loop
  is the same, the briefs' short-format sections apply, and the branch slug comes from the whole id.
- Note the start time; the report gives the wall-clock.

## Loop

Repeat, at most 60 times:

1. `npm run board -- next <topic> <story> --json`. If `done`, go to Finish.
2. If `next` starts with `stop:`, or `halt.kind` is `revision-limit` or `story-left`, go to Stop.
3. Take `steps` in order:
   - `run`: run the command from the repo root. Replace `<approver>` in a lock command (script or article) with
     `automated: /produce run started by <name>`. Read the exit code, not the log: 0 is done, 2 is
     a refusal or a failed check (the last line says why; `RESULT: FAILED (...)` for render and QA).
     A non-zero exit ends this pass of the steps; ask the board again.
   - `prompt`: give the text to a **fresh** agent (Agent tool, a new agent every time), adding the
     notes for a notes pass. Never reuse an agent across briefs: the script writer and the script
     reviewer, the graphics builder and the visual reviewer, the writer and the evidence agent are
     always different agents, and so are the article writer and the article reviewer. A reviewer sees only the artifacts, never the writer's reasoning.
     Run it in the foreground (`run_in_background: false`) and wait for its result before the next step. A background
     helper's completion notice goes to whoever owns the session, not to you, and this run would sit idle with no halt.
   - a step after `packaged` (the board names `npm run publish -- upload ...` or a hand upload): publishing is a
     person's, never this run's. Go to Finish.
4. Go to 1.

What each halt kind means for you:

| `halt.kind` | do |
|---|---|
| `missing`, `stale`, `review-pending`, `review-findings`, `storyboard-blocked`, `blocking-findings`, `lock` | follow the steps (`review-findings`: the reviewer holds sentences on warnings; the writer revises them, then the steps ask for a re-review) |
| `needs-evidence` | the steps hand `src/modules/evidence/briefs/evidence.md` to a fresh agent; if it records nothing for a gap, Stop |
| `needs-graphics` | one fresh `graphics.md` agent per listed scene (`Scenes: <id>`), then the check |
| `graphics-review` | a fresh `visual-review.md` agent that built none of them; a `revise` verdict goes back to a graphics agent with the notes |
| `render-check`, `qa-failed` | a fresh `video-fix.md` agent, then the command |
| `revision-limit`, `story-left` | Stop |
| `look-stale` | only at `packaged`, where `done` is true: the build's kit or theme is older and a person re-renders it with `video final`, never this run. Finish, and say so in the report |

Caps (each one hit is a Stop, naming the cap): 60 loop iterations; 3 graphics revisions per scene
(after the third, the builder may draw the scene as labelled text, and the report says so); 3
`qa-failed` fixes; the same `next` three times in a row with nothing changed.

A render or QA command whose output has not changed for 90 minutes is hung (a crashed browser never
exits): kill its node and `chrome-headless-shell` processes and run the step again (cached chunks are
kept). A transient narration failure (edge-tts "No audio was received", or a clip the timeline calls
truncated, whose cached mp3 you delete first) is retried the same way. Three hung or failed attempts at
one step is a Stop. Each render leaves a ~1 GB `remotion-webpack-bundle-*` folder in `%TEMP%`; with no render
running, delete those (and `react-motion-render*`) before the next one, or the system drive fills up.
A command that can outlast the Bash tool's 10-minute foreground limit is started with `run_in_background` and waited on
in the same turn by polling the output file the tool names, in one foreground Bash call (timeout 590000), repeated
until it exits: `until grep -q "RESULT:" "<output file>"; do sleep 10; done` (or append `; echo exited=$?` to the
command and grep for `exited=`). The run never ends its turn while a step is running.

Never edit a review file, a validation or any derived file to get past a check, never soften a
sentence because evidence is missing when evidence could be gathered, and never pass
`--replace-cited` or `--force` to get unstuck.

## Notes pass (send-back)

A reviewer's change request on the review page (`changes-requested` in `publish.json`) puts its notes in the board's
send-back prompt, each `[m:ss scene sentence]` placed; treat them like any other notes.

Route each note to the artifact that owns it, then run the Loop:

- wording, cuts, order: set `passStartRevision` in `script.json` to its current `revision` (the pass
  gets its own three revisions), then a fresh writer with `agent: src/modules/script/briefs/script.md (notes)`
  and the notes; the board then asks for the re-review, storyboard, render check and lock again.
- a graphic: a fresh `graphics.md` agent for that scene with the note, then `visual-review.md`. A component edit
  does not change any fingerprint the build is bound to, so after the graphic is approved run
  `npm run video -- spike <topic> <story>`, then `qa` and `package` again (the cached chunks of the other scenes are
  reused).
- music or pacing: edit `video/music.json` (cues over scene anchors, never seconds) or
  `video/render.json` (cues, options) yourself.

Notes never touch derived files. The lock is redone through the board's lock step.

## Several stories at once

1. The person's session that starts several story agents never answers a helper's completion notice itself. When a
   notice names a helper that a story agent started, forward it with `SendMessage` to that story agent and say so.
2. Each story agent runs its own helpers in the foreground (Loop step 3), so this is a safety net, not the mechanism.
3. A story agent with no output for 30 minutes while its board `next` is a `prompt` step is idle, not working. Resume
   it with `SendMessage` and the board's current `next`.

## Finish

1. `npm run validate` (fix code the run added until it passes; if it cannot, Stop).
2. Write `topics/<topic>/scripts/<slug>/video/review/run-report.md`:
   - the mp4 and checklist paths (`video/review/`), wall-clock time;
   - evidence added (documents, verdicts with cites, and why);
   - script revisions and the findings behind each;
   - graphics built (scene, kind, component), and any scene drawn as labelled text instead of its
     described diagram;
   - the music composition and cues;
   - the QA result line;
   - release blockers (draft narration licence, music clearance).
3. Commit on the produce branch (`git add <topic> src music` and anything else the run changed;
   `.gitignore` keeps the media out): the story's JSON and markdown, store, report, stories and
   sources changes, bespoke components and kinds. Never media. End the message with the
   attribution lines the session asks for.
4. Print the run report. If the story was already `packaged` when the run started, say so: nothing
   was re-rendered.

## Stop

Commit nothing; leave the working tree for the person. Print: the stage and halt kind, the open
problem in plain words (the findings, not the categories), what was tried, and what would unblock
it.
