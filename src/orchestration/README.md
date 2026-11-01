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

## Phase 1: the control plane and the work plane

`run/tick.ts` is the scheduled short pass (preflight in `preflight.ts`, the outbox and halt emails in `notify.ts`,
the digest in `digest.ts`, resume decisions and stuck detection in `resume.ts`, what is due in `schedule.ts`);
`run/work.ts` runs one due long job (a resume, or the production pick in `pick.ts`) and exits; `run/view.ts` is the
admin tab's model. Everything stays off until `automation.json` turns it on; the scheduler commands are printed, never
created. The mail transport is shared infrastructure (`src/shared/mail.ts`), with `FakeMail` for every test.

## Phase 3: approval by reply, publication and launch

`run/replies.ts` is the reply grammar (spec §7.2: the first line of the person's own text decides; `ownText` drops
quotes and signatures; `parseWhen` reads the schedule in the configured timezone); `run/inbox.ts` is the inbox
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
live only under a `decided` request, by its person; a failing verification is read three times, then halts; a Short's
final failure halts the story. The orchestration imports publishing, website and social only through their
`index.ts` and writes every effect through a CLI as a child.
