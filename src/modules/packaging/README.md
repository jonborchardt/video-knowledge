# packaging

Packaging owns the review package of a rendered video: titles, descriptions, captions, chapters, the placement of the calls to action in the description, and the release metadata. Video owns the media and QA; the YouTube limits check (`uploadProblem`) is publishing's and packaging only calls it.

- Inputs: `video/timeline.json`, `video/build-report.json`, `video/segment.mp4`, the script's release files (through `loadSegment`), `cta.json`, and for a Short the parent's `publish.json`.
- Outputs: `video/review/*`: `review.json`, `description.txt`, `README.md`, `checklist.md`, `captions.en.srt`, `links.json`, `thumbnail.png`, `build-report.md` and the mp4 copy.
- CLI: `tsx src/modules/packaging/cli.ts package <topic> <story-id>` (`cli.ts`), reached as `npm run video -- package`, which `video -- final` runs too. A Short is also recorded as the output `short:<slug>` in its parent's ledger by spawning the publish CLI (`publish -- add`), never by importing a write.
- Inspect: no; the board reads the package through publishing's `currentBuild`.
- Public API (`index.ts`): `descriptionLinks`, `renderDescription`, `keywordsOf`, `assertWithinLimits` and their types.
- Read API: none.
- Consumes: publishing's read API (`loadLedger`, `mainOutput`, `uploadProblem`); website's read API (`contentGraph`, `matterPath`, `storyNode`, `loadCta`, `resolveCtas`, `ctaPath`); video's `loadSegment` and the `Timeline`, `BuildReport` and `VIDEO_FILES` types and paths (its read API).
- Shared: `REVIEW_DIR` (the folder name under `video/`) lives in `src/shared/io.ts`.
