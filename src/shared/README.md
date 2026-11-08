# src/shared

What every capability may import: types-only contracts (`types.ts`: the shapes of the files one stage writes and another reads), io and path resolution (`io.ts`; `shortId` refuses a Short as a parent), the text helpers (`sentences.ts`: counts, fingerprints, `sectionTitle` and `chapterTitle`, the viewer-facing chapter name) and sentence validation, duration bands, the public-record ledger, the look and build-report readers, the inspect contract, the automation policy reader, the CLI runner, `Refusal`, the request ids, the social text and the smaller helpers (`approver`, `numbers`, `redact`, `ffmpeg`, `release-check`, the evidence gate).
A capability imports only `src/shared/` and `src/config/`, never another capability's code; it reads another's output files through shared io and shared types.
`src/shared/` imports no capability; `types.ts` has no import statement and is browser-safe.
Both rules are held by `tests/boundaries.test.ts` (config `tests/boundaries.json`, whose `edges` allowlist is empty and stays so).
