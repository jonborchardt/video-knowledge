# src/shared

What every capability may import: types-only contracts (`types.ts`: the shapes of the files one stage writes and another reads), io and path resolution, sentence validation, the public-record ledger, the look and build-report readers, and the inspect contract.
Rule 2: a capability imports only `src/shared/` and `src/config/`, never another capability's code; it reads another's output files through shared io and shared types.
Rule 8: `src/shared/` imports no capability; `types.ts` has no import statement and is browser-safe.
Contents arrive one extraction at a time; the allowlist in `tests/boundaries.json` only shrinks.
Spec: `docs/superpowers/specs/2026-10-29-module-architecture.md`.
