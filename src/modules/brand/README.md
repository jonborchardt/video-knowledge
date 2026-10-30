# brand

The brand kit builder: `npm run brand` (`cli.ts`, drawings in `draw/draw.js`, run in Remotion's headless Chrome).

- Inputs: `brand/slots.json`, `brand/<brand>/kit.json` and `accounts.json`, `src/config/site.ts`, the brand fonts (`brand/fonts/`).
- Outputs: the SVGs (committed) and PNG/JPG rasters (gitignored) in `brand/<brand>/`, seals (`public/commissions/`), share cards (`public/og/`, one per live story in `public/og/stories/`), stamps (`public/stamps/`), the favicon set and the header logo.
- CLI: `npm run brand`. Inspect: no. Read API: none (nothing imports brand code; `index.ts` is empty).
- Consumes: website's `contentGraph`/`storyNode`, stories' `loadStories`/`storyUrlSlug`, evidence's `publicTopicNames` (a share card exists only for a story that is live).
- Every brand uses the same designs; never hand-edit a kit SVG; a new page or graphic takes its colours and marks from the kit, never from memory.
- Rasters are not byte-stable between runs (a few JPG/PNGs differ by sha on identical input); the SVGs are.
- Test: `tests/accounts.test.ts` (reads `brand/**` and `src/config/site.ts`; stays in `tests/`).
