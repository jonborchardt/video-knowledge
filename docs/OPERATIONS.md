# Operating the system

The runbook for whoever runs Commonwealth of Reason day to day: a person at a terminal, with `/admin` open on the dev
server. Every automated step is a CLI verb a person can run by hand, so this file lists the verbs by situation and
marks each one:

- **read-only**: reads files, prints, changes nothing;
- **writes the repo**: changes files under the repo (artifacts, records, journals); nothing leaves the machine;
- **external effect**: talks to a service (YouTube, mail, X, Cloudflare, a model API) or pushes.

Three states describe every integration, and they are kept apart (`src/orchestration/run/readiness.ts`):

| state           | means                                                                                   | recorded where                                                   |
| --------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **Implemented** | the code exists and its tests pass                                                      | code (`INTEGRATIONS`), the test suite                            |
| **Verified**    | a person exercised it against the real service and recorded the evidence               | `readiness.json`, written only by `npm run run -- verified`      |
| **Enabled**     | configured to run unattended                                                            | `automation.json`                                                |

A green suite is never a verification, and a verification never enables anything. The Automation tab's Readiness
table shows all three per integration; the `verified` column is the only one that comes from `readiness.json`.

The architecture this runs on is in `src/modules/README.md` (the modules and their boundaries) and
`src/orchestration/README.md` (the board, the runner, the planes); the command reference is `docs/COMMANDS.md`; the
rules every change keeps are `CLAUDE.md`.

## 1. Setup

- Node 22+, `npm ci`. Python 3 with `pip install edge-tts` for the draft voice. `pdftotext` (poppler) for study PDFs.
  Remotion downloads Chrome on the first render. The watcher checkout (`../retire-sim/watcher`, or `WATCHER_DIR`) is
  needed by `npm run report`, `record`, `record-sources` and the research verbs, not by the site or the videos.
- `npx playwright install chromium firefox webkit` once, for `npm run quality` and the browser suite.
- `npm run dev` (read-only) serves the site and the working pages: `/admin` (the board, Automation, Proposals, the
  maps), `/<topic>/stories/`, `/<topic>/scripts/<slug>/`, `/<topic>/review/<slug>` and `/<topic>/register`. None of
  them is built or deployed.

## 2. Credentials and services

Secrets live in the gitignored `.env` at the repo root (and `.secrets/`), never in the repo, a journal or an event.
The runner hands each child only its verb's family (`envFor` in `src/orchestration/run/steps.ts`) and strips every
secret from an agent's environment.

| service              | keys in `.env`                                                                              | used by                                       |
| -------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------- |
| YouTube Data API     | `YOUTUBE_OAUTH_CREDENTIALS_PATH` (a Desktop OAuth client JSON under `.secrets/`), per commission `YOUTUBE_OAUTH_CREDENTIALS_PATH_<KEY>` | `npm run publish -- auth|upload|push|go-live|sync|verify` |
| Approval mail        | `MAIL_SMTP_HOST`, `MAIL_IMAP_HOST`, `MAIL_USER`, `MAIL_PASSWORD` (ports 465 and 993), `APPROVAL_SECRET` (16+ chars) | the tick's outbox and inbox, `publish request`, `article request-correction`, `topics batch` |
| Azure AI Speech      | `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`                                                   | `npm run video -- final` (the release voice, through `npm run tts-azure`) |
| X                    | `X_<KEY>_API_KEY`, `_API_SECRET`, `_ACCESS_TOKEN`, `_ACCESS_SECRET`, `_USER_ID` (`_HANDLE` for a test account) | `npm run social -- post`                      |
| Cloudflare           | `wrangler.jsonc`, the host's own deploy on push                                             | the launch job's push; `npm run links -- live` probes the result |
| Claude Code          | the `claude` CLI on `PATH`, signed in                                                       | every agent step (`claude -p`)                |

The External services tab on `/admin` links each console. The one-time YouTube setup (consent screen, OAuth client,
channel verification, `auth`) is in README.md under Publishing.

## 3. Configuration

`automation.json` is the automation policy (`src/shared/automation.ts`): a closed key set, validated at build, every
`enabled.*` flag off by default. Agent permissions are code (`src/orchestration/run/roles.ts`), never configuration.

| key                                            | what it decides                                                                           |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `enabled.tick`, `enabled.work`                 | whether a scheduled `tick` or `work` does anything at all                                 |
| `enabled.production`, `enabled.research`, `enabled.discovery`, `enabled.maintenance`, `enabled.social` | which jobs the work plane may start, and whether a post goes out |
| `review.draft`                                 | `person` (default), `shadow` (an agent reviews beside you, decides nothing), `agent`       |
| `agents.models`, `agents.effort`               | the model alias per role (the CLI reports the model version it used)                      |
| `agents.budgetUsd`                             | `perAgent` (the cap asked of the CLI per invocation and the pre-check's reservation; it can overshoot and the overshoot is recorded), `perRun`, `perTopic`, `perWeek` (the orchestration's checks before each agent) |
| `runs.*`                                       | concurrency, caps, timeouts, backoff, stuck detection, free disk                          |
| `approvals.*`, `notifications.*`               | who gets the mails, how long a request lives, the digest slot                             |
| `schedule.*`, `production.*`, `topics.*`, `launch.*` | cadences and thresholds                                                              |

Change it by hand, commit it. Nothing reads it but the planes and the CLIs; a wrong key fails the build.

## 4. Starting, stopping, pausing, disabling

Nothing runs unless a person starts it or a scheduler the person created calls the planes.

- `npm run run -- story <topic> <story-id> [--until <stage>] [--model <alias>] [--no-commit]` (writes the repo;
  external effect: model calls, narration, and after `packaged` the uploads and the request mail unless `--until
  packaged`) drives one story. It commits only on `git.commitOn`'s branch; `--no-commit` leaves the artifacts for you.
- `npm run run -- topic <topic>` (writes the repo; external effect: model calls, fetches) researches an approved
  proposal. `npm run run -- maintain <topic>`, `discover`, `launch` likewise; see 10 to 12.
- `npm run run -- tick` (writes `.automation/`; external effect: mail, YouTube reads, the deploy probe, X) is the
  control plane's short pass; `npm run run -- work [--job <kind>] [--dry-run]` the work plane's one long job. Both do
  nothing while their flag is off. `npm run run -- schedule --print` (read-only) prints the Task Scheduler or cron
  commands and the power lines; creating the tasks is your act and is never done here.
- **Stop** a run: close its terminal or kill its process; the lock's pid dies, the next start takes the lock over,
  kills a surviving child and resumes from what the board says. Never edit the tree while a run is live: the tree
  guard reverts edits outside the current agent's files.
- **Pause** automation: set the flag to `false` in `automation.json`. A running job finishes its step; nothing new
  starts. **Disable** it: the same, plus delete the scheduled tasks you created.

## 5. Status: what is happening now

- `/admin#board` (read-only): one row per video in the state of who acts next; the Now cell is live (every 5 s while
  something runs): the actor (an agent with its role and model, a CLI, a person), the step, the elapsed time, the run's
  reported cost and the history's estimate (the median of this role on this model version, with its sample size, or
  "insufficient history"). Red in the strip means the run stopped and a person must act.
- `/admin#automation` (read-only): Awaiting your action (what only you decide, where, and the command), Running now,
  Blocked (kind, why, retries, the next retry, the unblock, where the logs are), Queued and due, Recent activity, All
  runs, the records (requests, scans, corrections, launches, Studio steps) and Readiness.
- `npm run run -- status [--json]` (read-only) prints every run folder: running, halted (kind, why, unblock) or
  idle, and its spend. `npm run board -- next <topic> <story-id> [--json]` (read-only) is the board's answer for one
  story: stage, next step, steps, halt kind. `npm run board -- topic <topic>` the research board's.
- `/admin/live.json` (read-only, dev only) is the JSON the page polls.

## 6. Manual and supervised operation

Every board step is a command or a brief. By hand: `npm run board -- next <topic> <story-id>`, do what it says, ask
again. The `/produce` skill does that in a Claude Code session with you watching (`.claude/skills/produce/SKILL.md`);
`npm run run -- story` does it unattended. A supervised run is the runner on a feature branch with `--no-commit`,
`--until packaged` and a cheaper `--model`, watched on `/admin`.

The person's acts are never a run's: topic approval, release approval, scheduling, go-live, paid links, article
corrections, unpublishing and retraction, and every change to a video's visibility.

## 7. Costs and budgets

Every `claude -p` call is an **attempt** (`run/agents/<journal line>-<round>.json`: the alias asked for, every
model version used with its tokens and cost, turns, api time, exit, errors; never the prompt or the reply). A step's
journal line sums its attempts; `.automation/budget.json` is written once per attempt and is the gate the runners
check before each agent (`perRun`, `perTopic`, `perWeek`); `perAgent` is asked of the CLI and can overshoot
(recorded as `overCap`). The Automation tab shows the week's rollup over the attempts beside `budget.json` and names
the difference: a lost line, or attempts that ended with no parseable result (their cost is unknown to both).
Estimates are medians over completed, ok, single-model attempts of one role on one model version, five or more;
they inform and never gate. Costs are labelled **reported** (the CLI), **estimated** (history, n) or **limit**
(configuration), never mixed. A model's API cost is what the CLI reports; a subscription's economic cost is yours to
reconcile against it.

## 8. Approval email

With a mailbox configured and `enabled.tick` on, the tick sends one mail per new halt, a weekly digest, the proposal
batch, the draft request, the release request, the correction request and the launch mail, all through the outbox
(`.automation/outbox.json`; at least once, never twice as a decision). Your reply's first line decides
(`src/orchestration/run/replies.ts`): `OK`, `OK at <when>`, `CHANGES:` with one note per line, `PAID OK [1, 3]`,
`APPROVE <slug>`, `REJECT <slug>: <why>`, `APPROVE ALL`. Anything else gets one clarification and changes nothing.
The same decisions by hand (external effect where they publish): `npm run publish -- decide ...`,
`npm run article -- decide ...`, `npm run topics -- approve|reject ...`. `npm run run -- mail-test [--await-reply]`
(external effect) sends one test message. Nothing here sends a real approval mail until the mailbox is configured
and the tick is enabled.

## 9. Diagnosing and recovering

Every halt has a kind and an unblock (`src/orchestration/run/journal.ts`, `RUN_HALT_KINDS`, and the board's
`HALT_KINDS`). Read the Blocked list or `npm run run -- status`; the step log is `run/steps/<n>.log`, the attempt
record `run/agents/`, the validate output `run/validate.log`.

| halt                                   | who         | what to do                                                                                       |
| -------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------ |
| `timeout`, `lock-stale`, retryable `step-failed` | automatic | the tick resumes it by backoff (15, 60, 240 min); after that `retries-spent`, yours              |
| `budget`                               | you         | raise `agents.budgetUsd` or wait for the next ISO week; the tick resumes when the week rolls      |
| `awaiting-person`, `needs-person`      | you         | the unblock names the reply, page or command; `npm run run -- clear <topic> <story> --by "<name>"` for a halt that needs no action |
| `unexpected-edit`, `forbidden-flag`    | you         | an agent wrote outside its files (reverted) or the board asked for a flag the runner never passes: read the session, fix the cause |
| `git`                                  | you         | the finish could not commit: a concurrent edit to a path the run wrote, the wrong branch; separate your edit, run again |
| `no-progress`, `cap`, `retries-spent`  | you         | read the step log; fix what it names; `npm run run -- story` again                               |
| `request-expired`, `deploy-timeout`    | you         | renew the request (`publish request --renew`) or check the host                                  |

Resume: the same command that started the run (`npm run run -- story|topic|maintain|launch`). The journal is
operational state and decides no stage; the board re-derives the stage from the artifacts. A render or QA that hangs
is killed by the tick after `runs.stuckAfterMinutes` and halted `timeout`.

## 10. The fixture

`topics/test-fixture/` is a real 15 s story the pipeline runs end to end with nothing relaxed (spec 5.8).
`npm run run -- story test-fixture <story-id> --fresh [--until packaged] [--model sonnet] [--no-commit]` (writes the
repo; external effect: model calls, narration) archives the production to the gitignored `history/<run id>/` and runs
every stage again. It never appears on the production site, is never picked by automation, its uploads are private,
and only a person's explicit decision makes one unlisted, never public. Stop the dev server before `--fresh`: its
file watcher holds the folder on Windows.

## 11. Publishing and verifying

The release loop after `packaged` (inside `npm run run -- story`) uploads every output privately, pushes, verifies,
writes the release manifest and sends the request; your reply or the review page decides. By hand, in order
(external effect): `npm run publish -- upload`, `approve --by --checked`, `go-live [--at]`, `sync`, `verify`; `npm run
video -- final --approved-by` accepts a draft and makes the release build (Azure voice). `npm run publish -- show`
(read-only) prints the state and the composed metadata. YouTube Studio is the fallback route; every hand step is
recorded with `uploaded --id`, `scheduled --at`, `published`, `updated --fields`.

## 12. Deployment, maintenance, corrections

- **Launch** (external effect): once a release group is live and verified, the work plane runs `npm run run --
  launch <topic> <story-id>`: `report -- seed`, `brand`, `build`, `links freeze`, `validate`, one commit, one push;
  the tick probes the deploy (`npm run links -- live <topic> <story-id>`, read-only), posts on X by policy and sends
  the launch mail with the Studio steps left to record.
- **Maintenance** (writes the repo; external effect: model calls, fetches): `npm run run -- maintain <topic>` runs
  the scan (a `new-sources.md` agent, `record-sources`, `evidence -- scanned`, `report`, a note per revised finding,
  `stories discover`, validate, one commit) and the article pass (a fresh reviewer reaffirms, or a writer corrects and
  a correction request is mailed). A live video whose script cites a revised finding halts `needs-person` and is never
  rebuilt: add a note to its description and `publish -- push`, or `run -- clear`.
- **Corrections**: `npm run article -- decide --verdict ok|changes --by "<name>"` applies your reply by hand;
  `article -- correct --approved-by --note` releases a correction directly; `reaffirm --note` keeps a stale text.
  Automation never releases a correction.

## 13. Cleaning test uploads and previews

- Private test uploads (fixture runs, superseded drafts) stay on the channel until a person deletes them in YouTube
  Studio. The launch mail of a fixture lists the superseded uploads of earlier runs. A video the ledger knows that is
  deleted in Studio is reconciled by `npm run publish -- sync` (external effect: a read).
- A visibility change on a published video is **not** an undo of the publication: the `published` event stands, a
  change to private or unlisted and any deletion on YouTube is its own act, needs its own authorisation and is
  recorded (`unpublished`, `retracted`). Nothing here changes a visibility on its own.
- Fixture preview branches (`fixture/<run id>`) are deleted with `git push origin --delete fixture/<run id>` (external
  effect) once seen; the local `history/<run id>/` folders are gitignored and can be deleted when no longer needed.
- Render temp: each render leaves a `remotion-webpack-bundle-*` folder in `%TEMP%`; the runner clears them before a
  render when no other run is live.

## 14. Verifying an integration

When you have exercised an integration against the real service, record it (writes `readiness.json`):

```
npm run run -- verified <integration> --by "<your name>" --evidence <ref>
```

`<integration>` is one of the keys below; `--evidence` must name a record that exists: `ledger:<topic>/<story>#<event>`,
`journal:<topic>/<story>#<line>`, `run:<run id>`, `launch:<topic>/<story>`, `scan:<topic>`, `social:<topic>/<story>`,
`discovery:<slot>`, `tick:<ISO>`, or a `<Message-ID>` the outbox or inbox holds. An automated actor and a dangling
reference are refused; nothing else is written, and no flag changes.

| integration                 | implemented | enabled by                | evidence                                  |
| --------------------------- | ----------- | ------------------------- | ----------------------------------------- |
| `youtube-upload`            | yes         | `enabled.work`            | `ledger:<topic>/<story>#uploaded`         |
| `youtube-go-live`           | yes         | `enabled.tick`            | `ledger:<topic>/<story>#published`        |
| `approval-mail-send`        | yes         | `enabled.tick`            | a `<Message-ID>` the outbox holds         |
| `approval-mail-receive`     | yes         | `enabled.tick`            | a `<Message-ID>` the inbox handled        |
| `decide-by-reply`           | yes         | `enabled.tick`            | `ledger:<topic>/<story>#decided`          |
| `correction-by-reply`       | yes         | `enabled.tick`            | a `<Message-ID>` the inbox handled        |
| `maintenance-scan`          | yes         | `enabled.maintenance`     | `scan:<topic>`                            |
| `agent-draft-review-shadow` | yes         | `review.draft`            | `run:<run id>`                            |
| `cloudflare-deploy-probe`   | yes         | `enabled.work`            | `launch:<topic>/<story>`                  |
| `x-post`                    | yes         | `enabled.social`          | `social:<topic>/<story>`                  |
| `scheduled-tasks`           | no (yours)  | none: your scheduler      | `tick:<ISO of a recorded tick>`           |
| `research-pipeline`         | yes         | `enabled.research`        | `run:<run id>`                            |
| `discovery`                 | yes         | `enabled.discovery`       | `discovery:<slot>`                        |

The `verified` column is on `/admin#automation`, from `readiness.json`. An integration that is implemented and
verified is still off until its flag is on; one that is enabled but never verified is running on faith, and the
table says so.
