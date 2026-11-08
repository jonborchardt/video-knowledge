# Operating the system

The runbook for whoever runs Commonwealth of Reason day to day: a person at a terminal, with `/admin` open on the dev
server. Every automated step is a CLI verb a person can run by hand, so this file lists the verbs by situation and
marks each one:

- **read-only**: reads files, prints, changes nothing;
- **writes the repo**: changes files under the repo (artifacts, records, journals); nothing leaves the machine;
- **external effect**: talks to a service (YouTube, mail, X, Cloudflare, a model API) or pushes.

Three states describe every integration, and they are kept apart (`src/orchestration/run/readiness.ts`):

| state           | means                                                                    | recorded where                                              |
| --------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------- |
| **Implemented** | the code exists and its tests pass                                       | code (`INTEGRATIONS`), the test suite                       |
| **Verified**    | a person exercised it against the real service and recorded the evidence | `readiness.json`, written only by `npm run run -- verified` |
| **Enabled**     | configured to run unattended                                             | `automation.json`                                           |

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
- The unit suite runs four vitest workers (`maxWorkers` in `vitest.config.ts`), not one per processor: measured on this
  16 GB machine on 2026-11-06/07, the default failed two idle validates on rotating timeouts, six passed idle every
  time (about 640 s) but failed beside a render (17 timeouts, 2,306 s, free memory down to 357 MB), and four beside a
  render left two 30 s timeouts in `mail/tests/ask-cli.test.ts` (2,323 s). No worker count makes the suite pass
  beside a render here, so a validate does not run beside one: unattended, the only job is the launch (section 4) and
  no render runs; in a session, do not start a render while a launch or a validate runs. Change the number in the
  config with a measurement beside it.
- `npm run dev` (read-only) serves the site and the working pages: `/admin` (the board, Automation, Proposals, the
  maps), `/<topic>/stories/`, `/<topic>/scripts/<slug>/`, `/<topic>/review/<slug>` and `/<topic>/register`. None of
  them is built or deployed.

## 2. Credentials and services

Secrets live in the gitignored `.env` at the repo root (and `.secrets/`), never in the repo, a journal or an event.
The runner hands each child only its verb's family (`envFor` in `src/orchestration/run/steps.ts`) and strips every
secret from an agent's environment.

| service          | keys in `.env`                                                                                                                                                                                                                                                                     | used by                                                                                                                                      |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| YouTube Data API | `YOUTUBE_OAUTH_CREDENTIALS_PATH` (a Desktop OAuth client JSON under `.secrets/`), per commission `YOUTUBE_OAUTH_CREDENTIALS_PATH_<KEY>`; `YOUTUBE_CHANNEL_ID_<KEY>` (or `YOUTUBE_CHANNEL_ID`), the channel an upload must land on, checked against the account before every upload | `npm run publish -- auth                                                                     \| upload \| push \| go-live \| sync \| verify` |
| Approval mail    | `MAIL_SMTP_HOST`, `MAIL_IMAP_HOST`, `MAIL_USER`, `MAIL_PASSWORD` (ports 465 and 993), `APPROVAL_SECRET` (16+ chars)                                                                                                                                                                | the tick's outbox and inbox (`npm run mail`), `publish request`, `article request-correction`, `topics batch`                                |
| Azure AI Speech  | `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`                                                                                                                                                                                                                                          | `npm run video -- final` (the release voice, through `npm run tts-azure`)                                                                    |
| X                | `X_<KEY>_API_KEY`, `_API_SECRET`, `_ACCESS_TOKEN`, `_ACCESS_SECRET`, `_USER_ID` (`_HANDLE` for a test account)                                                                                                                                                                     | `npm run social -- post`                                                                                                                     |
| Cloudflare       | `wrangler.jsonc`, the host's own deploy on push                                                                                                                                                                                                                                    | the launch job's push; `npm run links -- live` probes the result                                                                             |
| Claude Code      | the `claude` CLI on `PATH`, signed in                                                                                                                                                                                                                                              | every agent step (`claude -p`)                                                                                                               |

The External services tab on `/admin` links each console. The one-time YouTube setup (consent screen, OAuth client,
channel verification, `auth`) is in README.md under Publishing.

## 3. Configuration

`automation.json` is the automation policy (`src/shared/automation.ts`): a closed key set, validated at build, every
`enabled.*` flag off by default. Agent permissions are code (`src/orchestration/run/roles.ts`), never configuration.

| key                                                                                                    | what it decides                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `enabled.tick`, `enabled.work`                                                                         | whether a scheduled `tick` or `work` does anything at all                                                                                                                                                            |
| `enabled.production`, `enabled.research`, `enabled.discovery`, `enabled.maintenance`, `enabled.social` | which jobs the work plane may start, and whether a post goes out                                                                                                                                                     |
| `review.draft`                                                                                         | `person` (default), `shadow` (an agent reviews beside you, decides nothing), `agent`                                                                                                                                 |
| `agents.models`, `agents.effort`                                                                       | the model alias per role (the CLI reports the model version it used)                                                                                                                                                 |
| `agents.budgetUsd`                                                                                     | `perAgent` (the cap asked of the CLI per invocation and the pre-check's reservation; it can overshoot and the overshoot is recorded), `perRun`, `perTopic`, `perWeek` (the orchestration's checks before each agent) |
| `runs.*`                                                                                               | concurrency, caps, timeouts, backoff, stuck detection, free disk                                                                                                                                                     |
| `approvals.*`, `notifications.*`                                                                       | who gets the mails, how long a request lives, the digest slot                                                                                                                                                        |
| `schedule.*`, `production.*`, `topics.*`, `launch.*`                                                   | cadences and thresholds                                                                                                                                                                                              |

Change it by hand, commit it. Nothing reads it but the planes and the CLIs; a wrong key fails the build.

## 4. Starting, stopping, pausing, disabling

Nothing runs unless a person starts it or a scheduler the person created calls the planes.

- `npm run run -- story <topic> <story-id> [--until <stage>] [--model <alias>] [--no-commit]` (writes the repo;
  external effect: model calls, narration, and after `packaged` the private uploads, a draft-request mail for every
  draft it uploads under `review.draft: person` or `shadow` (the video's and each Short's), and the release request
  mail, unless `--until packaged`) drives one story. It commits only on `git.commitOn`'s branch; `--no-commit` leaves the artifacts for you.
- `npm run run -- topic <topic>` (writes the repo; external effect: model calls, fetches) researches an approved
  proposal. `npm run run -- maintain <topic>`, `discover`, `launch` likewise; see 10 to 12.
- `npm run run -- tick` (writes `.automation/`; external effect: mail, YouTube reads, the deploy probe, X) is the
  control plane's short pass; `npm run run -- work [--job <kind>] [--dry-run]` the work plane's one long job. Both do
  nothing while their flag is off. `npm run run -- tick --preflight` (read-only but for one `claude -p` call) runs the
  preflight alone as if `enabled.tick` and `enabled.work` were on and prints what a live tick would stop on. `npm run run -- schedule --print` (read-only) prints the Task Scheduler or cron
  commands and the power lines; creating the tasks is your act and is never done here.
- **Stop** a run: close its terminal or kill its process; the lock's pid dies, the next start takes the lock over,
  kills a surviving child and resumes from what the board says. Never edit the tree while a run is live: the tree
  guard reverts edits outside the current agent's files.
- **Pause** automation: set the flag to `false` in `automation.json`. A running job finishes its step; nothing new
  starts. **Disable** it: the same, plus delete the scheduled tasks you created.

**Three kinds of unattended work, kept apart.** _Administrative_ (the tick task): preflight, inbox, due
publications, deploy probes with `go-live` and `verify` under a person's decision, halt mails, the digest; no
agent-written code runs; it holds the mail, YouTube and approval secrets by verb (`envFor`). _Public publication_ (the
`work --job launch` task): report seed, brand, build, links freeze, validate, commit, push, then the tick's probe goes
live; no agent-written code runs (Astro builds repo code agents cannot edit); it holds no secret beyond git's push
credential. _Agent work_ (story runs and resumes, topic runs, scans and article passes, discovery, notes passes,
renders): `claude -p` and the renders of agent-written components execute **as you**; the containment strips secrets
from their environments and denies the agent's tools `.env` and `.secrets/`, but does not prevent code an agent wrote
from reading those files when a render executes it. So no task starts agent work: a `work` task without
`--job launch`, or any of `enabled.production|research|discovery|maintenance`, turns on unattended execution of
agent-written code, and until an isolation that has been measured exists you do not. You start each agent run in a
session.

**One writer at a time.** The scheduler keeps each task to one instance ("Do not start a new instance", section 17);
that setting is per task and serialises nothing you start by hand. A job by hand (`npm run run --
story|topic|maintain|discover|pick|launch`, or `work` without `--job`) is started only when `npm run run -- status`
and the live page show nothing running and no launch in progress (a render beside the launch's validate is what
makes the suite time out, section 1); the review page's actions and the bare `publish`
verbs likewise, since a write during a live run is reverted by its guard or left dirty for the next preflight to name
(section 9, `unexpected-edit`).

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
(`.automation/mail/outbox.json`; at least once, never twice as a decision). Your reply's first line decides
(`src/orchestration/run/replies.ts`): `OK`, `OK at <when>`, `CHANGES:` with one note per line, `PAID OK [1, 3]`,
`APPROVE <slug>`, `REJECT <slug>: <why>`, `APPROVE ALL`. Anything else gets one clarification and changes nothing.
The same decisions by hand (external effect where they publish): `npm run publish -- decide ...`,
`npm run article -- decide ...`, `npm run topics -- approve|reject ...`. `npm run mail -- test [--await-reply]`
(external effect) sends one test message. Nothing here sends a real approval mail until the mailbox is configured
and the tick is enabled.

### Asking the approver

`npm run mail -- ask "<subject>" --text "<question>" --about <topic>/<story-id>` sends one question to `approvals.to`
and blocks until the reply. A session runs it in the background (the Bash tool's `run_in_background`), goes on with
what does not depend on the answer, and is woken when the command exits. It never polls from the session; the polling
is inside the verb. Reply above the quote in any words. The first reply answers; a later one is kept in order, never
overwritten and never given to another question. A follow-up takes `--reply-to <qn-id>`, threads in your client and
shares the work item.

**A conversational "go ahead" is not an approval.** The reply comes back as your words for the agent to reason about.
It can revise, re-render and ask again on them. Release approval, scheduling, go-live, paid links, topic approval and
article corrections still take their own request mail or verb (section above), and the module cannot apply them.

**Live continuation and durable recovery are different.** While the agent that asked is running, `ask` exits with the
answer and the agent carries on. If that agent has ended, the answer is still recorded by the next fetch (the tick, or
anyone), and the question and its reply stay on disk, but nothing resumes the original work by itself: no automation
acts on an unseen answer. The weekly digest and the live page's owner list show it, `npm run mail -- questions --unseen
--fetch` lists it, and a later session or you pick it up, with `--about` naming the work. An answer stays unseen until
a consumer runs `questions --ack <qn-id>`, so an agent that dies holding one loses nothing.

**Which verb.** `ask` when you need words back: it blocks, or `--timeout 0` sends and returns, and the question stays
open until it is answered and acknowledged, or closed. `report "<subject>" (--text | --text-file <path>) [--about
<ref>]` for anything one-way: a completion report, a progress summary, a status note; it goes through the same outbox,
opens no question and nothing waits on it. Halts and the digest are the tick's. A formal decision keeps its request
mail and its verb.

**The consumer's contract** for an answer, whoever consumes it (the session that asked, a later one, or you): list it
(`questions --fetch --unseen --about <ref>`, or `ask --resume <qn-id>`), act once, keyed by the question id (your own
record says whether the action was done, so a rerun after a crash does not do it twice), then `questions --ack <qn-id>
--note "<what was done>"`, then `report`. Listing never acknowledges: not `questions`, not `npm run run -- status`
(which shows the open questions, an unaccepted answer apart from an unanswered question), not the digest or the live
page. A question nobody will answer, or whose answer no longer matters, is `questions --close <qn-id> --note "<why>"
--by <who>`: it leaves every open list and archives as completed, nothing is pretended answered, and a reply that
comes later is still recorded and shown, never acted on, until `questions --reopen <qn-id> --note "<why>" --by <who>`.

| status       | means                                                                                        | next                                |
| ------------ | -------------------------------------------------------------------------------------------- | ----------------------------------- |
| `unsent`     | recorded, not delivered yet; the tick or a resume retries                                    | `ask --resume <qn-id>`              |
| `failed`     | three failed sends                                                                           | fix the mailbox, then ask again     |
| `awaiting`   | sent, a live process is waiting                                                              | reply                               |
| `unattended` | sent, nobody waiting (timed out, or the session ended)                                       | reply; the answer is still recorded |
| `answered`   | a reply is recorded; `late` if it came after the wait, `unseen` until accepted               | `questions --ack <qn-id>`           |
| `closed`     | closed as moot by a named actor with a note; a later reply is kept and shown, never acted on | `questions --reopen <qn-id>`        |

Delivery is at least once: if a process dies after the server accepted a mail and before recording it, the retry
carries the same Message-ID and you may get two copies; only the first reply's effect counts per question or request.
`sentAt` means the server accepted the message for its one recipient; the server's response line and verdict stay on
the entry (`questions --json`, `smtp`), and a rejected recipient is a failed attempt that leaves the entry unsent for
the flush. A delivery failure the mail system sends back (mailer-daemon, postmaster) is recorded as a bounce, counted
by `questions`, and is never an answer. Acceptance is not arrival: only a reply, or you, proves a mail reached the
inbox.
Records live in `.automation/mail/`: `outbox.json`, `received.json`, `received/*.eml` (the original messages) and
`archive/<YYYY-MM>.json`. Only completed records archive after 90 days (a question answered and accepted, or closed,
a mail sent or out of attempts, a reply handled); an unanswered question or an unprocessed formal reply stays live at any age, and
a late reply to an archived request still threads to it and is refused as expired by its verb. If a lock is stuck, the
error names the pid; if that pid is not a repo process, delete `.automation/mail/.lock/held`. Upgrading: `npm run mail
-- init --dry-run` reports the migration and `npm run mail -- init` performs it (every write runs it anyway).

**Which channel.** An interactive session asks you in the session. An autonomous session (`claude -p`, the SDK, a
routine) and orchestration use `mail ask`; the harness tells a session which it is, and nothing detects whether you
are at the keyboard. An explicit instruction ("use email from now on", "I'm leaving") switches the current session to
mail for the rest of it, and nothing persists past that session: the next one you start is interactive again until
told otherwise. One channel per question, never both, and no fallback from an unanswered local question to mail.
Content roles under the runner have no shell, so they ask through a halt and its mail, as before.

## 9. Diagnosing and recovering

Every halt has a kind and an unblock (`src/orchestration/run/journal.ts`, `RUN_HALT_KINDS`, and the board's
`HALT_KINDS`). Read the Blocked list or `npm run run -- status`; the step log is `run/steps/<n>.log`, the attempt
record `run/agents/`, the validate output `run/validate.log`.

| halt                                             | who       | what to do                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `timeout`, `lock-stale`, retryable `step-failed` | automatic | the tick resumes it by backoff (15, 60, 240 min); after that `retries-spent`, yours                                                                                                                                                                                                                                                                                                                                                                                          |
| `budget`                                         | you       | raise `agents.budgetUsd` or wait for the next ISO week; the tick resumes when the week rolls                                                                                                                                                                                                                                                                                                                                                                                 |
| `awaiting-person`, `needs-person`                | you       | the unblock names the reply, page or command; `npm run run -- clear <topic> <story> --by "<name>"` for a halt that needs no action                                                                                                                                                                                                                                                                                                                                           |
| `unexpected-edit`, `forbidden-flag`              | you       | an agent wrote outside its files (reverted), a canary changed during the run (`changed outside the repo: ~/.claude/settings.json` is your own Claude Code session on this machine writing its settings: resume the run), or the board asked for a flag the runner never passes: read the session, fix the cause. The guard leaves alone only the files the tick's current verb claims; every other write during a step (yours, the review page's, another job's) is reverted |
| `git`                                            | you       | the finish could not commit: a hand edit to a path the run wrote, a staged index that is not the run's, the wrong branch; separate your edit (your other edits in the topic folder are left unstaged and named), run again                                                                                                                                                                                                                                                   |
| `no-progress`, `cap`, `retries-spent`            | you       | read the step log; fix what it names; `npm run run -- story` again                                                                                                                                                                                                                                                                                                                                                                                                           |
| `request-expired`, `deploy-timeout`              | you       | renew the request (`publish request --renew`) or check the host                                                                                                                                                                                                                                                                                                                                                                                                              |

Resume: the same command that started the run (`npm run run -- story|topic|maintain|launch`). The journal is
operational state and decides no stage; the board re-derives the stage from the artifacts. A render or QA that hangs
is killed by the tick after `runs.stuckAfterMinutes` and halted `timeout`.

A `preflight` halt that says `the clone is dirty` and names a ledger, a proposal or an article file: the tick commits
the files each of its own verbs writes as the verb returns (`tick: publish decide ...`), but leaves a file as written
when it was already dirty, when it sits in a live run's own folder or a pending launch owns it, or when the commit
itself failed (the tick then runs no further verb that pass). Nothing is lost: the decision is in the file. Commit the named
files by hand (`git add <files>`, `git commit`) and the next tick goes on; a reply it had already applied answers
`already recorded`. A line of a proposal-batch reply whose verb crashes is tried again on every tick and mailed once,
as the halt `automation/batch:<id>`, with the command to run it by hand. Whatever you decide about that proposal
afterwards (by a later reply or by hand) stands: the retried reply leaves a line alone when the proposal was decided
after it was sent, and says so in its one answer.

## 10. The fixture

`topics/test-fixture/` is a real 15 s story the pipeline runs end to end with nothing relaxed (spec 5.8).
`npm run run -- story test-fixture <story-id> --fresh [--until packaged] [--model sonnet] [--no-commit]` (writes the
repo; external effect: model calls, narration) archives the production to the gitignored `history/<run id>/` and runs
every stage again. It never appears on the production site, is never picked by automation, its uploads are private,
and only a person's explicit decision makes one unlisted, never public. Stop the dev server before `--fresh`: its
file watcher holds the folder on Windows.

## 11. Publishing and verifying

The release loop after `packaged` (inside `npm run run -- story`) uploads every output privately, pushes, verifies,
writes the release manifest and sends the request; your reply or the review page decides. An `OK` leaves the video
private: the launch deploys the matter page with the video embedded, the tick's probe confirms the page carries it,
and only then does the tick run `go-live` under your decision, then `verify`, then the Shorts in order; the X post
and the launch mail follow once everything is live and verified. (`OK at <when>` is unchanged: YouTube publishes at
the time and the page follows about one deploy later.) By hand, in the same order (external effect): `npm run publish
-- upload`, `approve --by --checked`, `decide --verdict ok` (or `approve` alone), `npm run run -- launch`, `npm run
run -- probe` (which goes live once the page carries the video), or `go-live [--at]` yourself after the page is up,
then `sync`, `verify`; `npm run video -- final --approved-by` accepts a draft and makes the release build (Azure
voice). `npm run publish -- show`
(read-only) prints the state and the composed metadata. YouTube Studio is the fallback route; every hand step is
recorded with `uploaded --id`, `scheduled --at`, `published`, `updated --fields`.

## 12. Deployment, maintenance, corrections

- **Launch** (external effect): on your `OK` (the video approved and decided, still private), or once a scheduled
  video is live and verified, the work plane runs `npm run run -- launch <topic> <story-id>`: `report -- seed`,
  `brand`, `build`, `links freeze`, `validate`, one commit, one push; the tick probes the deploy (`npm run links --
live <topic> <story-id>`, read-only: the page carries the video id) and, confirmed, runs `go-live` under your
  decision and `verify`; the Shorts follow from the due step; once the video is verified and every Short is live it
  posts on X by policy and sends the launch mail with the Studio steps left to record. Between the deploy and the
  next tick the page shows the facade of a still-private video (at most one tick interval). A release withdrawn
  after its page is up keeps the page (its URL is frozen) without a video; decided again, the launch runs again
  before the tick goes live. A scheduled release is the exception: the page follows the publication, about one
  deploy later, as before.
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

`<integration>` is one of the keys below; `--evidence` must name a record of the kind that proves that integration (the
evidence column): a ledger event of the named type (a reply decision carries `via: email` and a person's name), a
`<Message-ID>` the outbox sent or the inbox applied, a scan, a shadow record with both verdicts, a live launch, a posted
X record, a recorded tick, a finished topic run, a discovery slot. An automated actor, a dangling reference and a
record of another kind are refused; nothing else is written, and no flag changes.

| integration                 | implemented | enabled by            | evidence                                                           |
| --------------------------- | ----------- | --------------------- | ------------------------------------------------------------------ |
| `youtube-upload`            | yes         | `enabled.work`        | `ledger:<topic>/<story>#uploaded`                                  |
| `youtube-go-live`           | yes         | `enabled.tick`        | `ledger:<topic>/<story>#published`                                 |
| `approval-mail-send`        | yes         | `enabled.tick`        | a `<Message-ID>` the outbox holds                                  |
| `approval-mail-receive`     | yes         | `enabled.tick`        | a `<Message-ID>` the inbox applied                                 |
| `decide-by-reply`           | yes         | `enabled.tick`        | `ledger:<topic>/<story>#decided` (a reply: `via: email`, a person) |
| `correction-by-reply`       | yes         | `enabled.tick`        | a `<Message-ID>` applied to an `ar-` request                       |
| `maintenance-scan`          | yes         | `enabled.maintenance` | `scan:<topic>`                                                     |
| `agent-draft-review-shadow` | yes         | `review.draft`        | `shadow:<topic>/<story>`                                           |
| `cloudflare-deploy-probe`   | yes         | `enabled.work`        | `launch:<topic>/<story>`                                           |
| `x-post`                    | yes         | `enabled.social`      | `social:<topic>/<story>`                                           |
| `mail-question`             | yes         | none: a session's act | `qn-<id>` (a question answered by you and acknowledged)            |
| `scheduled-tasks`           | no (yours)  | none: your scheduler  | `tick:<ISO of a recorded tick>`                                    |
| `research-pipeline`         | yes         | `enabled.research`    | `run:<run id>` (a finished topic run)                              |
| `discovery`                 | yes         | `enabled.discovery`   | `discovery:<slot>`                                                 |

The `verified` column is on `/admin#automation`, from `readiness.json`. An integration that is implemented and
verified is still off until its flag is on; one that is enabled but never verified is running on faith, and the
table says so.

## 15. Incident records

### Heat-pumps launch, 2026-11-04

Four heat-pumps outputs were public while the matter page their descriptions link to returned 404. Jon authorised the launch on 2026-11-04, with the two records below as conditions.

#### Quality gate exception

This exception covers this one launch and nothing else.

- **What fails:** `npm run quality` ends `RESULT: FAILED (browser suite)` on one test, `tests/browser/admin-live.test.ts`: `expected 'shorts' to be 'producing'`.
- **Why the launch proceeded:** the same test fails the same way on the baseline, `9f18ed7`, which has none of the launch's changes. It covers the dev-only admin page on the fixture story, and a build never emits that page.
- **What passed on the prepared tree:** the static gate (181 of 181) and `tests/browser/site.test.ts` (no failures, 22 tests skipped by the suite). `npm run validate` passed in full.
- **What did not change:** the test, the gate and `tests/web-quality.json`, at the time.
- **Root cause and fix (2026-11-05, `a37fb4f`):** the fixture's released ledger wins over its production stage on the board (`buildColumn`), so the row no longer followed the artifact the test moved. The test now moves the fixture's `publish.json` aside for its duration, as it already did the storyboard, and restores it; no assertion, timeout or exception changed.

#### Attribution correction

The ledger event below names the wrong actor. It stays as written, because ledger events are append-only; `npm run publish -- correct-actor`, added afterwards, records the actual actor beside it as an `actor-corrected` event.

| Field          | Value                                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------------------------ |
| Ledger         | `topics/heat-pumps/scripts/decision-does-the-upfront-cost-eat-the-savings/publish.json`                            |
| Output         | `youtube`                                                                                                          |
| Event          | `verified`, `passed`, video `Z1cAlTwainc`, at `2026-11-05T03:10:37.170Z`                                           |
| Recorded actor | `by: Jon`                                                                                                          |
| Actual actor   | The Claude Code agent, running `npm run publish -- verify --by Jon` under Jon's authorisation of operational fixes |
| Written in     | commit `77345df`                                                                                                   |

Read this record alongside that event. The correction changes no ledger state and does not touch Jon's release approval: the `approved` and `decided` events on request `rq-4257256a18e5` are his own and stand as written.

#### The launch job's build step

The launch job crashed at its build step on its first real run, because its CLI runner refused `astro build`. For this launch only, it ran from a one-off script that sent that step to `npm run build`; validation, the commit logic and the push were the job's own, and the push carried commit `4c2c821`. The runner was fixed afterwards in `af4503a`.

## 16. What lives outside git

Gitignored state on this one PC that nothing else holds. `scripts/backup.ps1` (standalone: it reads the ledgers as JSON and runs Windows' `tar.exe`; no npm verb, nothing from `src/`) archives the "backed up" rows daily, unencrypted, to `K:\COR`. The include list is generated on every run and written beside the archive (`<name>.paths.txt`), never kept by hand. The repository is only read: the script writes nothing under it.

| path                                                                                | why it matters                                                                                                                                                          | backed up or re-creatable                                                        |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `.env`, `.secrets/`                                                                 | the credentials (section 2)                                                                                                                                             | backed up (in clear: see the destination below; never logged)                    |
| `.automation/`                                                                      | the mail outbox, received store and archives that `readiness.json` cites, the inbox record, budget, schedule, launch and discovery records, the shadow record, the logs | backed up                                                                        |
| `topics/*/scripts/*/run/`, `topics/*/scripts/*/shorts/*/run/`, `topics/*/work/run/` | journals and attempt records: the spend history, every halt                                                                                                             | backed up                                                                        |
| `topics/*/history/`                                                                 | a fixture story's archived productions (`--fresh`)                                                                                                                      | backed up                                                                        |
| `.superpowers/`, `docs/superpowers/`                                                | plan ledgers, the e2e baseline, the plans                                                                                                                               | backed up                                                                        |
| `readiness.json`, `automation.json`                                                 | tracked, copied so the archive stands alone                                                                                                                             | backed up                                                                        |
| `video/review/*.mp4` of every output with a `published` event                       | the exact bytes the approval and the publication bind (a re-render gives another sha)                                                                                   | backed up; the run fails if the build the upload bound is not in `video/review/` |
| narration, frames, scenes, chunk and draft mp4s, `video/brand/`, transcripts        | regenerated by the video verbs                                                                                                                                          | re-creatable                                                                     |
| `music/*/*.wav`                                                                     | regenerated from the committed `source.strudel` by the recorded command                                                                                                 | re-creatable                                                                     |
| `brand/*/*.png`, `brand/*/*.jpg`                                                    | `npm run brand` from the committed SVGs                                                                                                                                 | re-creatable                                                                     |
| `node_modules`, `dist`, `.astro`, `.cache`, `.web-quality/`                         | installs and build outputs                                                                                                                                              | re-creatable                                                                     |

**The archive.** One run writes `K:\COR\video-knowledge-<yyyy-MM-dd>.tar`, its `.sha256` and its `.paths.txt` (the list it archived), and appends one line to `K:\COR\backup.log` (names, sizes, outcome; never a file's contents). It is built as `.part` and renamed only after every check passed: a ledger that does not parse, a fixed path or a published final missing, a non-zero `tar` exit, or an archive smaller than its files fails the run, which deletes the `.part`, logs the line and exits 1, so the task's Last Run Result shows it. A `.part` at the destination is a crashed run. Dated archives are never pruned by the task; delete old ones yourself. The run refuses a second archive for the same day and overwrites nothing (delete the first by hand to run again). By hand: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\backup.ps1`.

**The destination, in clear.** The archive is not encrypted and holds `.env`, the OAuth client file and the mail records. `K:\COR` is on the WD Elements USB drive labelled BACKUP (8 TB, NTFS; a separate device, attached to this PC by USB, so not off-site and not protected from a failure of the machine's room, power or a ransomware run under this user). On 2026-11-07 the folder's permissions were made its own (inheritance removed): `Jon`, `SYSTEM` and `Administrators` only, where the drive's root grants `Everyone` full control; the only enabled local account is `Jon`, and the only share of the drive is the administrative `K$`. Whether the volume is BitLocker-encrypted could not be read without elevation (`manage-bde -status K:` needs administrative rights). Keep the folder's permissions as they are, and nothing from it goes into git, a mail, a report or a log.

**The task** (yours to create; the repo never creates one):

```
schtasks /Create /SC DAILY /ST 03:00 /TN "video-knowledge backup" /TR "powershell -NoProfile -ExecutionPolicy Bypass -File F:\github\video-knowledge\scripts\backup.ps1" /F
```

Then, in the Task Scheduler window, Settings tab: "Do not start a new instance"; tick "Run task as soon as possible after a scheduled start is missed" (a night the PC was off is caught up at the next start); Conditions tab: leave "Wake the computer to run this task" unticked. Both are window settings, not `schtasks` flags.

**Restore test (the acceptance; a backup that has not been restored is not known to be good).** Outside the repo: a fresh clone at a short path (`git -c core.longpaths=true clone F:\github\video-knowledge <clone>`), then `tar -xf K:\COR\<name> -C <clone>`. In the clone: compare `Get-FileHash` of every file the archive's `.paths.txt` covers against the originals (hashes only; never print contents), and, with `node_modules` linked or installed, `npm run run -- status` and `npm run mail -- questions` read the restored state. Delete the clone (and only it) afterwards. Write the date, the archive name and what matched below.

**Checking the script** (the runbook's own test, no framework): run it by hand against a scratch destination (`-Destination <scratch>`) on a scratch copy of a repo with one published ledger, and see: the generated list names the published final and no draft mp4; the `.sha256` equals `Get-FileHash` of the archive; `tar -xf` into a fresh folder gives files whose hashes match; a same-day rerun exits 1 and overwrites nothing; a published final renamed away exits 1 with nothing under the final name; holding a listed file open exclusively (another PowerShell: `[IO.File]::Open(<path>, 'Open', 'Read', 'None')`) makes `tar` exit 1 and the run exit 1 with nothing under the final name; nothing under the scratch repo was written.

Restore tests run:

- 2026-11-07, `video-knowledge-2026-11-07.tar` (747,179,008 bytes, 2048 files, 29 list entries, 7 published finals: the two heat-pumps videos and their three Shorts, the fixture's video and its Short; the fixture's archived runs under `history/` with their 29 media files; no draft or intermediate video file of a live story). `.sha256` matched `Get-FileHash`; `tar -xf` into a fresh clone outside the repo: every one of the 2048 files matched its original by SHA-256, none missing; `npm run run -- status` and `npm run mail -- questions` read the restored state; the clone was deleted. The repository was not written.

## 17. Running from scheduled tasks

`npm run run -- schedule --print` (read-only) prints the two Task Scheduler lines (the tick every `schedule.tickMinutes`; the work plane as `work --job launch`, launches only, so no agent-written code runs unattended), the settings to apply in the window ("Run only when user is logged on"; "Do not start a new instance" for both: one instance of each task at a time, a trigger that fires while the task runs is skipped, not queued, and the setting is per task, so it serialises neither the tick against work nor anything you start by hand) and the two `powercfg` lines (AC sleep and hibernate off; already 0 on this machine). Check the instance policy after creating a task: `schtasks /Query /TN "video-knowledge work" /XML` shows `<MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>`. The backup task is in section 16. Creating, changing and deleting tasks are your acts:

```
schtasks /Delete /TN "video-knowledge tick" /F
schtasks /Delete /TN "video-knowledge work" /F
schtasks /Delete /TN "video-knowledge backup" /F
```

After the first scheduled tick: `.automation/tick.log`, the live page (`/admin#automation`, Recent activity) and the next digest. Then, when you want it recorded, `npm run run -- verified scheduled-tasks --by "<your name>" --evidence tick:<ISO of a recorded tick>`. The Implemented column of that row stays `no (yours)` by definition (section 14): the integration is your Task Scheduler entries, not code; printing the commands installs nothing.
