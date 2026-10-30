# publishing

Publishing owns YouTube only: uploads, release approvals, scheduling, go-live, read-back and verification, recorded in the per-story ledger. Social (X and others) is a separate Milestone 2 module and never part of this one.

- Inputs: `video/review/review.json` and the review package of the story (the build report through shared `build-report`), `video/upload-session.json`.
- Outputs: `publish.json` per story: `events` are written only by the CLI, `metadata` may be hand-edited and is validated at build.
- CLI: `npm run publish -- <verb> <topic> <story-id>` (`cli.ts`). Hand verbs: `show`, `uploaded`, `approve`, `thumbnail`, `scheduled`, `published`, `updated`, `failed`, `unpublished`, `retracted`, `add`. API verbs: `auth`, `upload` (always private), `push`, `go-live`, `sync`, `verify`.
- Files: `publish.ts` (ledger and verbs), `uploader.ts` (API verbs), `youtube.ts` (the one API client), `verify.ts` (read-back checks), `outputs.ts` (the public video view of a ledger).
- Inspect: no; the board reads `outputStates` and the other names `index.ts` exports.
- Public API (`index.ts`): ledger readers and types, `outputStates`, `currentBuild`, `mainOutput`, the `record*` writes the review page and video use, `storyOutputs`, `seekUrl`, `uploadProblem`.
- Read API: none yet.
- Shared: `Refusal` lives in `src/shared/refusal.ts`; the stories file is read through shared io.
