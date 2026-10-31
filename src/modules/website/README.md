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
