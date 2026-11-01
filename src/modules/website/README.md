# website

Website owns rendering, the content graph and building and deploying the site. It renders `article-release.json` and never decides whether a finding needs a correction (article owns corrections and reaffirmations). The Astro folders (`src/pages`, `components`, `layouts`, `styles`, `admin`, `tools`) and `astro.config.mjs` are part of it and stay where Astro needs them; they import `site-graph.ts` directly.

- Inputs: `report.json`, `stories.json`, `public-record.json`, `article-release.json`, `publish.json`, `video/review/*`, `cta.json`, the datasets.
- Outputs: the built site (`dist/`), `public-urls.json`, `.web-quality/`.
- Briefs: `briefs/cta.md`.
- CLIs: `npm run links -- freeze|check|cta` (`cli-links.ts`), `npm run quality` (`cli-quality.ts`), `npm run rehearse` (`cli-rehearse.ts`).
- Inspect: no.
- Public API (`index.ts`): the node-safe surface only (nothing reads `import.meta.env`): content graph, calls to action, SEO, review page model and job, rehearsal helpers. `site-graph.ts` is Astro-only and not exported.
- Read API (read-only, nothing written; listed under `website` in `tests/boundaries.json`): `contentGraph(root, topics, view)` builds the graph from the topic files; `storyNode(topic, storyId)` is a story's node id; `matterPath(topic, story)` is its site path; `loadCta(topic, storyId)` reads `cta.json`; `resolveCtas(file, graph, story)` checks it against the graph; `ctaPath(topic, storyId)` is its file path; type `CtaType`.
- Consumes: article's `loadArticleRelease`, publishing's ledger and output readers; evidence (`loadTopic`, `publicTopicNames`, `loadDatasets`, `dataRef` through its `index.ts`), stories and shorts through their read APIs. Website never imports packaging.

Read API additions (Milestone 2): `publicUrlsOf(topic, storyId, root)` is the absolute matter, article and data URLs a story's release will have, pure over the graph with the story assumed live. `resolveCtas` lists every paid link of `cta.json` under `commercial` (`ctaId`, approved or not): an unapproved one is dropped from the description and shown numbered in the release manifest for the person's `PAID OK`; an `automated:` or placeholder `approvedBy` is still a file problem. `approveCommercial(topic, storyId, id, by)` (`npm run links -- cta approve <topic> <story-id> <id> --by <name>`, phase 3) writes a person's approval into the matching entry once; publishing's `decide` runs it as a child for each `PAID OK` link.
