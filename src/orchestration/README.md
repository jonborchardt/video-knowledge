# orchestration

Owns derived state: every topic's, story's and script's stage, computed from the committed artifacts alone (`production.ts`).
Owns routing: for each story the stage, the next step (a command or a brief), the halt kind (`HALT_KINDS`) and the board column (`COLUMNS`, `columnOf`); a published output's next line is the ledger's own (`OutputState.next`), passed through.
`npm run board -- next <topic> <story-id> [--json]` (`board.ts`) prints that answer; `/produce` (`.claude/skills/produce/SKILL.md`) is the executor of its steps.
It reads each module through its `index.ts` (an `inspect()` where the module has one) and module files through `src/shared/` io.
The website reads it only through `index.ts`.
It never writes a module's artifact, never judges content, and schedules nothing in Milestone 1.
Milestone 2 adds the executor here (scheduling, execution of the board's steps as child processes and `claude -p` agents, retries, budgets, notifications, the approval mail adapter); those are coordination, and the two rules above still hold for them: a write is the owning module's CLI, and judgment is a brief handed to an agent.
Its only stored decision file is `production.json` (`queued`, `parked`); `automation.json` (Milestone 2) is policy, not state, and its operational files (`run/`, `.automation/`) are gitignored and decide no stage.
The modules and their rules: `src/modules/README.md`.
