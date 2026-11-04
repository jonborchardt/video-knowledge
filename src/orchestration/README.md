# orchestration

Owns derived state: every topic's, story's and script's stage, computed from the committed artifacts alone (`production.ts`).
Owns routing: for each story the stage, the next step (a command or a brief), the halt kind (`HALT_KINDS`) and the board column (`COLUMNS`, `columnOf`); publishing answers a structured next step (`OutputStep`: verb, actor, args, retryable); the board renders it (`renderStep`) and the runner dispatches on it.
`npm run board -- next <topic> <story-id> [--json]` (`board.ts`) prints that answer; `/produce` (`.claude/skills/produce/SKILL.md`) is the executor of its steps.
It reads each module through its `index.ts` (an `inspect()` where the module has one) and module files through `src/shared/` io.
The website reads it only through `index.ts`.
It never writes a module's artifact, never judges content, and schedules nothing in Milestone 1.
Milestone 2 adds the executor here (scheduling, execution of the board's steps as child processes and `claude -p` agents, retries, budgets, notifications, the approval mail adapter); those are coordination, and the two rules above still hold for them: a write is the owning module's CLI, and judgment is a brief handed to an agent.
The runner (`run/`, `npm run run -- story | status`) is phase 0 of that: `runner.ts` is the loop over `boardNext`, `steps.ts` runs one step (a child with only its verb's secrets, or an agent followed by its validator), `agent.ts` and `roles.ts` spawn `claude -p` under per-role permission rules, `guard.ts` reverts writes outside a role's files and checks a graphics agent's components before a child loads them, `journal.ts` and `lock.ts` are its operational state under the story's gitignored `run/`, `status.ts` the read-only view the admin page may import through `index.ts`. It never publishes, posts, pushes or sends mail; it never imports a module file but its `index.ts`.
Its only stored decision file is `production.json` (`queued`, `parked`); `automation.json` (Milestone 2) is policy, not state, and its operational files (`run/`, `.automation/`) are gitignored and decide no stage.
The modules and their rules: `src/modules/README.md`.

## Index

| file (`src/orchestration/`)                                                                                          | what it is                                                                                               |
| -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `production.ts`, `board.ts`, `index.ts`                                                                              | the board: derived stage, next step, halt kind, column; the one door the website reads through           |
| `research.ts`                                                                                                        | `topicNext`: the research board of a topic                                                               |
| `run/runner.ts`, `steps.ts`, `agent.ts`, `roles.ts`, `guard.ts`                                                      | phase 0: the story runner, one step, `claude -p`, the role grants, the tree guard                        |
| `run/journal.ts`, `lock.ts`, `status.ts`, `usage.ts`, `live.ts`                                                      | the run's operational state and its read side (status rows, attempts, rollups, estimates, the live view) |
| `run/release.ts`, `requests.ts`, `replies.ts`, `inbox.ts`, `publish-due.ts`, `launch.ts`                             | phases 2 and 3: the release loop, the mails, the reply grammar, the inbox, the due step, the launch      |
| `run/tick.ts`, `work.ts`, `pick.ts`, `schedule.ts`, `resume.ts`, `preflight.ts`, `notify.ts`, `digest.ts`, `view.ts` | phase 1: the planes                                                                                      |
| `run/discovery.ts`, `discovery-state.ts`                                                                             | phase 4                                                                                                  |
| `run/topic-runner.ts`                                                                                                | phase 5                                                                                                  |
| `run/maintain.ts`, `article-work.ts`                                                                                 | phase 6                                                                                                  |
| `run/readiness.ts`, `run/fresh.ts`, `run/cli.ts`                                                                     | the readiness record and its verb; the fixture's `--fresh`; `npm run run`                                |

## Phase 0: the story runner

`run/runner.ts` is the loop over `boardNext` (`runStory`): it asks the board, runs each step through `steps.ts`
(`execStep`: a `run` step is a module CLI as a timed child with only its verb's secrets, `envFor`; a `prompt` step
is a budgeted `claude -p` agent under its role's grant, `agent.ts` and `roles.ts`, followed by the brief's validator,
whose findings go back to the same session for `runs.validationRounds` rounds), journals every attempt
(`journal.ts`: `run/journal.jsonl`, one line per step attempt; `halt.json`; the lock in `lock.ts` with the child's pid
and step), halts with a kind and an unblock (`RUN_HALT_KINDS` beside the board's `HALT_KINDS`: `budget`, `timeout`,
`no-progress`, `unexpected-edit`, `forbidden-flag`, `git`, ...), and finishes by validating and committing on
`git.commitOn`'s branch (or leaves the tree with `--no-commit`). The tree guard (`guard.ts`) snapshots the tree before
the first step and after every guard, reverts writes outside the role's files, restores held untracked files and
canaries, and typechecks a graphics agent's components before a child loads them. `fresh.ts` archives a fixture
production for `--fresh`. The runner never publishes, posts, pushes or sends mail on its own: the release loop
(phase 2) does the uploads and the request through the publishing CLI, and only a person goes live.

## Phase 2: the release loop

`run/release.ts` continues a packaged story inside `npm run run -- story` (`releasePending`, `releaseJobs` for the
work plane): the draft by policy (`review.draft`: `person` or `shadow` upload the draft privately and mail the draft
request, `requests.ts`; `shadow` also records a `draft-review.md` agent's verdict in `.automation/shadow.json` with
no effect; `agent` lets that agent accept or send back a draft, never a release), `video final` by the person's name
once the draft is accepted, the Shorts (`shorts discover`, the shorts reviewer, a nested run per ready candidate,
`run/shorts.ts`), every output uploaded private, pushed and verified, the release manifest, and `publish request
--channel email`. It dispatches on publishing's `OutputStep` (`verb`, `actor`) and writes only through the CLIs; a
retryable failure resumes by backoff, a person's step halts `awaiting-person`.

## Phase 1: the control plane and the work plane

`run/tick.ts` is the scheduled short pass (preflight in `preflight.ts`, the outbox and halt emails in `notify.ts`,
the digest in `digest.ts`, resume decisions and stuck detection in `resume.ts`, what is due in `schedule.ts`);
`run/work.ts` runs one due long job (a resume, or the production pick in `pick.ts`) and exits; `run/view.ts` is the
admin tab's model. Everything stays off until `automation.json` turns it on; the scheduler commands are printed, never
created. Mail is the mail module's (`src/modules/mail/`): orchestration decides what to send and when, and reaches the mailbox only through the `Mailer` seam (`run/mailer.ts`, the module's CLI as a child; `FakeMailer` in tests).

## Phase 3: approval by reply, publication and launch

`run/replies.ts` is the reply grammar (spec §7.2: the first line of the person's own text decides, and a release
approval is unambiguous: `OK` alone, punctuation allowed, or `OK at <when>`; an OK with anything after it is a
clarification, never a publication; `ownText` (the mail module's) drops quotes and signatures; `parseWhen` reads the schedule in the
configured timezone); `run/inbox.ts` is the inbox
adapter (the thread and the request id both required, one `publish decide` per reply, one clarification for what it
cannot read, `.automation/inbox.json` the record written after the verb; a draft reply writes `run/draft-accepted.json`
for the release loop, which runs `video final` by the person's name); `run/publish-due.ts` is the tick's due step
(a schedule past its time, the Shorts of a published video in order with `--via tick:<request>`, a live Short's push,
one renewal of an expired request then `request-expired`); `run/launch.ts` is the launch job (`launchJobs` for the
work plane, `launch` with its record under `.automation/launch/`, the halt also in the story's run folder,
`probeLaunches` for the tick: `links -- live`, the X post by policy, the launch mail from `requests.ts`
`renderLaunched`; a fixture pushes `fixture/<run id>` and probes the production host negatively and the preview host
positively). `npm run run -- launch` is the hand verb. One launch of a story runs at a time (`.automation/launch/<topic>--<slug>.lock`;
a second work instance ends `held`), it waits while another story of the topic has a live run, and it stages only
the story's folder, the topic's top-level files and the site outputs. The tick's publication steps each run on their
own (one that throws is an action line, the pass goes on); a reply whose `decide` fails leaves the message for the
next poll and halts the story `step-failed`; a reply on a decided request is answered, never applied; a Short goes
live only under a `decided` request, by its person; nothing retries forever: a sync after the scheduled time, a
verification read of the video or a live Short, or a Short's retryable go-live that keeps failing is tried
`MAX_TRIES` (3) times, counted in the story's `run/retries.json` since its marker, then halts `step-failed` once; a
Short's final failure halts the story; a retryable halt of the release loop becomes `retries-spent` (not retryable,
written once) after the backoff array. The probe takes the X post's outcome from the social module's record
(`loadSocial`, `accountFor` for whether the institution is configured), never from the CLI's text, and tries a
retryable failure on `POST_ATTEMPTS` (3) ticks; `deploy-timeout` is written once with a stable why (the probe's
reason in its unblock text), so every terminal failure is one halt the status rows and the halt mail carry once.
The orchestration imports publishing, website and social only through their `index.ts` and writes every effect
through a CLI as a child.

## Phase 4: topic discovery

`run/discovery.ts` is the weekly discovery job of the work plane (`enabled.discovery`, `schedule.discovery`; by hand
`npm run run -- discover [--institution <key>] [--dry-run]`): per institution with a channel one `discover.md` agent
under the discovery grant (new `proposals/*.json` only, validated by `topics -- validate --fresh` with the findings
fed back), then one `proposal-review.md` agent per new proposal in a fresh session (one review file, validated by
`topics -- validate <slug> --review`); then `topics -- batch` (the weak parked with the reviewer's reason, the strong
listed per institution under one `pb-` id), one mail through the outbox (`requests.ts` `renderBatch`), `topics --
sent` for the Message-ID, and `proposals/` committed on main in the clone. The slot is recorded in `schedule.json`
before any agent runs and the record under `.automation/discovery/<slot>.json` grows step by step, so a crashed job
resumes without a second batch, agent or mail (an unsent mail is the outbox flush's). A review that never completes
halts `no-progress` for its slug alone (`.automation/discovery/halts/`, a status row under the pseudo-topic
`proposals`, so the halt mail and the digest carry it). `run/inbox.ts` applies a reply to the batch mail (thread and
`pb-` id required) line by line through `topics approve|reject` by the approver; `APPROVE ALL` expands over the
batch's slugs only; a slug outside the batch is reported back. The digest lists the proposals pending and parked.

## Phase 5: the research pipeline

`research.ts` is `topicNext` (spec 5.2): the research stage of a topic and its next step from the files alone
(the approved proposal, the lists, the store, the batches and the runner's markers under `work/run/`, the documents,
the report, the stories and their review), with `park` where the thresholds or the reviewer say the topic cannot
proceed; `npm run board -- topic` prints it. `run/topic-runner.ts` is the topic runner (`npm run run -- topic`, the
work plane's `topic` job for an approved proposal not yet researched, under `runs.maxConcurrentTopicRuns`): the
story runner's loop over `topicNext`, the research agents under their role grants (parallel extraction and judging
up to `maxParallelAgents`, each validated by its brief's verb and resumed on findings), `record` serial and resumed
with `--from` after a partial failure, `record-sources` never with `--replace-cited` (a refusal is `needs-person`),
the notes agent's reply recorded through `report -- note`, a thin or storyless topic parked through `topics -- park`
(a digest line, no halt, no mail), the finish validated and committed on main touching the topic's own paths (and
the proposal, the institution claim through `topics -- claim`, the brand assets). A research run's topic is
untracked until that commit, so the guard's snapshot holds its files' content and restores an agent's overwrite.

## Phase 6: maintenance and the delegated draft review

`run/maintain.ts` is the scan job (`scanJobs`: the due public topic with the oldest scan, never the fixture, only with
`enabled.maintenance`; `maintain` runs it: the new-sources agent, `record-sources`, `evidence -- scanned`, the report,
a revision note per open revision, the stories, validate, one commit, then `articleWork`; a live video whose script
cites a revised claim is halted `needs-person` on its own story and never rebuilt). `run/article-work.ts` is the
article pass (spec 2 Maintenance, register D10): a released article the module inspects `stale` is reaffirmed by a
fresh reviewer (recorded by `article reaffirm` with the reviewer's why) or corrected by a writer in correction mode,
judged by a fresh reviewer, validated and requested from the person (`article request-correction`; the mail from
`requests.ts` shows each sentence before and after; an unanswered request is renewed once expired; a correction
failing after `CORRECTION_REVISIONS` halts `awaiting-person`); the inbox's `correction-request` branch applies `OK`
and `CHANGES:` through `article decide`. Automation never releases a correction. `runner.ts` carries the notes pass:
`pendingSendBack` reads the ledger's `changes-requested` on the current build (the review page's, the inbox's or the
draft-review agent's), `notesPassSteps` routes each note by placement (sentence or unplaced: `script -- send-back`
and a `script.md (notes)` writer; scene only: `video-fix.md` and `video -- check`), once per request
(`run/notes-pass.json`); `release.ts` counts the agent's send-backs on the output as rounds
(`review.draftReviewRounds`) and returns `RESTART` within them, names the build to the reviewer and quotes the
person's `disagree` marks as what not to raise; `digest.ts` prints the shadow agreement against spec 5.5
(`shadowSentence`). The tree guard leaves VS Code's `vscode-merge-base` key out of the `.git/config` canary.

## Milestone 3: observability

`run/usage.ts` is the read side of spend: the **attempt** (one `claude -p` call, recorded by `steps.ts` under
`run/agents/<journal line>-<round>.json` with the alias asked for, every model version used with its tokens and cost,
turns, api time, the cap and whether the cost overshot it; never the prompt or the reply) is the unit; `attempts()`
lists every one once (records, older journal lines as unknown model, discovery records), `rollups()` sums per run,
story, topic and week beside `budget.json` (the gap named), `estimate()` is the median of a role on one model version
over five or more completed single-model attempts, informational only. `run/live.ts` is the live view the admin page
polls (`/admin/live.json`, dev only): one row per story, Short and research, scan or discovery run with its column and
stage from the board (`topicBoard`, the same `columnOf` and `stoppedOf`), its state from the lock and the halt, the
agent step's role, model, elapsed, cost and estimate, a research run's parallel agents by pid, the jobs (running, the
next job, due, scheduled, stuck), the owner's action list, the activity feed and the readiness table.
`run/readiness.ts` holds the integration list (implemented in code, enabled from `automation.json`) and the one writer
of `readiness.json` (`npm run run -- verified`, a person's act with evidence the verb checks). The topic runner's
finish stages only what the run's own steps wrote (`touched.json`, `pre-dirty.json`); the scan and article passes
check `perRun` before each agent; the correction request's Message-ID is recorded through `article -- sent`.
`docs/OPERATIONS.md` is the runbook.
