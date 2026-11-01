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
