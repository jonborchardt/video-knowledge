# src/shared

What every capability may import: types-only contracts (`types.ts`: the shapes of the files one stage writes and another reads), io and path resolution, sentence validation, the public-record ledger, the look and build-report readers, and the inspect contract.
A capability imports only `src/shared/` and `src/config/`, never another capability's code; it reads another's output files through shared io and shared types.
`src/shared/` imports no capability; `types.ts` has no import statement and is browser-safe.
Both rules are held by `tests/boundaries.test.ts` (config `tests/boundaries.json`, whose `edges` allowlist is empty and stays so).
