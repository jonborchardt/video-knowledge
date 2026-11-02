---
name: produce
description: Drive one story from ready to a private review package (the board's packaged stage) in one run, or send a packaged story back with editor notes. Use when the user pastes "/produce <topic> <story-id>" with an "Approver:" line (copied from the production board's What next? popover), or asks to produce, finish, resume or send back a story's video.
---

# Produce

The runner is the executor of this loop: `npm run run -- story <topic> <story-id>` (`src/orchestration/run/`) runs the
same board steps unattended, under per-role agent containment, then carries the packaged story through the release
loop (the draft by policy, the Shorts, the private uploads, the approval request). It is authoritative for halts,
caps, budgets, retries and the notes pass; the runbook is `docs/OPERATIONS.md`. This skill is the interactive
fallback for a session: the same loop with a person watching, its agents under the session's permissions rather than
the runner's. Prefer the runner (`--until packaged` stops before any upload; `--notes-file <path>` is the notes pass;
`--no-commit` on a feature branch) and use this skill when a person wants to watch each step in a session.

**The lock check.** Before starting, read `topics/<topic>/scripts/<slug>/run/lock.json`: a lock whose pid is alive
means a runner holds the story; refuse, and say so. Publishing stays the runner's or a person's.

The board is the state machine; you are the loop. `npm run board -- next <topic> <story> --json`
says where the story is and what moves it on; you do that and ask again. All judgment lives in the
briefs (`src/modules/<module>/briefs/`) and the fresh agents you hand them to; all bookkeeping lives in the CLIs.
A run interrupted halfway resumes by pasting the same prompt.

## Arguments

```
/produce <topic> <story-id>
Approver: <name>
Notes:
- <optional editor notes, one per line>
```

- **The approver rule.** Refuse to start when `Approver:` is missing, blank, or a placeholder (`<your name>`,
  `<name>`, anything in angle brackets). Starting the run is that person's sign-off for the lock; the release
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

The board's halt kinds and what each asks for are the runner's (`src/orchestration/production.ts` `HALT_KINDS`, the
Objects tab's vocabulary on `/admin`): follow the steps the board names for each; `needs-graphics` is one fresh
`graphics.md` agent per listed scene, `graphics-review` a fresh `visual-review.md` agent that built none of them,
`render-check` and `qa-failed` a fresh `video-fix.md` agent then the command, `look-stale` at `packaged` is a person's
`video final` (finish, and say so). The caps are the runner's too (`automation.json` `runs`: 60 loop iterations, 3
graphics revisions per scene, 3 QA fixes, the same `next` three times with nothing changed): each one hit is a Stop
naming the cap.

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

**The stop list.** Never edit a review file, a validation or any derived file to get past a check, never soften a
sentence because evidence is missing when evidence could be gathered, never pass `--replace-cited` or `--force` to
get unstuck, never publish, post, push or hold a secret, never write under `src/` except where the graphics brief
says, and never run while a runner's lock on the story is alive.

## Notes pass (send-back)

A reviewer's change request on the review page (`changes-requested` in `publish.json`) puts its notes in the board's
send-back prompt, each `[m:ss scene sentence]` placed. The runner's notes pass (`npm run run -- story ... --notes-file
<path>`, or the request's own notes) routes them: wording, cuts and order to the script (`npm run script -- send-back`
sets `passStartRevision`, then a fresh writer with `agent: src/modules/script/briefs/script.md (notes)`), a graphic to a
fresh `graphics.md` agent for that scene then `visual-review.md`, music or pacing to `video/music.json` (cues over
scene anchors, never seconds) or `video/render.json` (cues, options). In a session do the same by hand, then run the
Loop. Notes never touch derived files. The lock is redone through the board's lock step.

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
