# Audit: video-knowledge script, validation and storyboard pipeline

Date: 2026-10-17. Repository: `F:\github\video-knowledge`, branch `main` at `d53d4a9`, with the script stage present as uncommitted work (15 modified files, 9 new paths; see section 7). Nothing was modified for this audit except the build output in `dist/` (gitignored), which `npm run build` rewrites.

Vocabulary used below: **observed** means read in code or an artifact, or produced by a command run during this audit; **inferred** means derived from observed code without executing that path; **untested** means no test or run exercises it.

---

## 1. Implementation inventory

### 1.1 Stages and their state

| Stage | State | Mechanism | Entry point |
|---|---|---|---|
| Source collection, transcripts | Implemented (prior work) | External `watcher` CLI (`../retire-sim/watcher`, or `$WATCHER_DIR`) | `npm run watcher`, `scripts/watcher.mjs` |
| Claim extraction, AI guesses | Implemented (prior work) | Agent writes `work/hN.json` from `scripts/briefs/extract.md`; `npm run record` records | `scripts/record.mjs` |
| Study verdicts on claims | Implemented (prior work) | Agent writes `work/sv_G.json` from `scripts/briefs/sources.md`; `npm run record-sources` | `scripts/record-sources.mjs` |
| Report | Implemented (prior work) | watcher CLI writes `<topic>/report.json` | `npm run report` |
| Story discovery and evidence gate | Implemented (prior work, modified here) | Deterministic (`src/lib/stories.ts`, `src/lib/evidence.ts`) plus agent review file `story-review.json` | `npm run stories -- discover\|show\|validate` |
| Script evidence package | Implemented, operational | Deterministic (`buildPackage`, `src/lib/script.ts:124`) | `npm run script -- package` |
| Script writing | Operational only as agent work | An agent (Claude Code session) writes `script.json` from `scripts/briefs/script.md`; no API call, no automation | none in code |
| Deterministic script validation | Implemented, operational | `validateScript` (`src/lib/script.ts:441`) | `npm run script -- validate` |
| Semantic script review | Operational only as agent work | A second agent writes `script-review.json` from `scripts/briefs/script-review.md`; merged by `validateScript` | `npm run script -- show` prints the sheet |
| Storyboard planning | Operational only as agent work | Agent writes `storyboard.json` from `scripts/briefs/storyboard.md` | none in code |
| Storyboard filling and checks | Implemented, operational | `buildStoryboard` (`src/lib/storyboard.ts:70`) | `npm run script -- storyboard` |
| Reviewable package | Implemented | `renderScriptMd`, `renderReviewMd` (`src/lib/script.ts`), `renderStoryboardMd` (`src/lib/storyboard.ts`) | written by `validate` and `storyboard` |
| Site page per script | Implemented | `src/pages/[topic]/scripts/[slug].astro`, linked from `src/pages/[topic]/stories.astro` | `npm run build` |
| Narration synthesis, image or video rendering, publishing | Missing (out of scope by the task brief) | none | none |

**"One convenient command"** (`npm run script -- run <topic> <story-id>`, `scripts/script.ts:215-240`) runs only the deterministic stages whose inputs exist and prints a "next: an agent writes ..." line for each LLM stage. It is a stage driver, not an end-to-end generator. Observed: `run` executed on the MLM story prints the package, validation and storyboard results and exits 0.

**Nothing in the repository calls an LLM API.** All "LLM-driven" stages are briefs consumed by an interactive agent. Consequence: reproducibility of those stages rests on the committed JSON they produce, not on code.

### 1.2 Files and modules added or changed for the script stage

New: `src/lib/script.ts` (931 lines), `src/lib/storyboard.ts` (308), `scripts/script.ts` (245), `scripts/briefs/script.md` (123), `scripts/briefs/script-review.md` (74), `scripts/briefs/storyboard.md` (70), `tests/script.test.ts` (471), `src/pages/[topic]/scripts/[slug].astro` (266), `get-rich-quick/scripts/decision-mlm-and-seminars/` (8 files).

Modified: `src/lib/evidence.ts` (optional `derived` figures; commas stripped from passage text before figure matching; plural test ignores quoted spans), `src/lib/stories.ts` (decision-group gaps computed from the final claim list), `src/lib/topics.ts` (`docNames`, `sameStudy`), `src/lib/review.ts` (`audience`), `src/pages/[topic]/stories.astro` (link to script page), `tests/dist.test.ts` (script pages), `package.json` (`script` command), `.prettierignore` (`*/scripts/`), `README.md`, `CLAUDE.md`, and the get-rich-quick data files: `store/videos/1eWkeNDmQj4.json` (three new verdict records), `report.json`, `stories.json`, `story-review.json` (one applicability judgment, one audience line), `site.json` (`sameStudy`).

### 1.3 Data flow

```
sources/*.txt (pdftotext)  --sources.md agent-->  work/sv_*.json  --record-sources-->  store/videos/*.json (verdict records: claim, verdict, confidence, note, source="<file>.txt#L10-L24")
store + report.json  --loadTopic (src/lib/topics.ts)-->  Topic { claims[]: {verdicts[], sources[]} }
Topic  --discover (src/lib/stories.ts) + story-review.json-->  stories.json (Story with audit.central / audit.findings = Validation objects)
Story + Topic + passages  --buildPackage-->  evidence-package.json (claims with statements, evidence passages, roles, applicability; documents with sha, sameStudyAs)
evidence-package.json  --writer agent-->  script.json (sections > sentences > assertions {claims, evidence refs, quote?, calc?})
script.json + live Topic + passages + script-review.json  --validateScript-->  validation.json, script.md, review.md
script.json + validation.json + evidence-package.json  --planner agent-->  storyboard.json (scenes referencing sentence ids)
storyboard.json  --buildStoryboard-->  storyboard.json (filled: narration, timing, status), storyboard.md, review.md
```

Identity chain: canonical claim id (`get-rich-quick/<slug>`) → verdict record cite (`<topic>/sources/<file>.txt#L<a>-L<b>`) → assertion `evidence[]` entry `{kind:'study', claim, cite}` → `Validation.supporting[].ref.cite` → passage read by `passageReader` (`src/lib/evidence.ts:92`). Source statements chain by source id (`{kind:'statement', claim, source}`) to the store's recorded `quote` (at most 25 words, written by the extraction agent).

### 1.4 Deterministic versus LLM-driven

Deterministic: package build, every check in `validateScript`, review merge, storyboard fill and checks, markdown rendering, site build. LLM-driven: writing, semantic review, storyboard planning, and upstream claim extraction and study verdicts (including the verdict `note` text, which matters in section 3).

---

## 2. Artifact schemas and examples

All examples below are copied from the actual files (abbreviated with `...` where noted).

### 2.1 Reviewed story

Producer: `npm run stories -- discover get-rich-quick` (`src/lib/stories.ts`), merging `get-rich-quick/story-review.json`. Location: `get-rich-quick/stories.json`, entry `stories[].id === "decision:mlm-and-seminars"`.

```json
{
 "id": "decision:mlm-and-seminars", "kind": "decision",
 "title": "How Much Money Do MLM Participants Actually Make?",
 "readiness": "ready", "format": "long-form",
 "claims": [
  "get-rich-quick/most-mlm-participants-earn-little-nothing",
  "get-rich-quick/mlm-income-comes-mainly-recruiting-leading",
  "get-rich-quick/recruiting-downline-gives-mlm-participants-leverage",
  "get-rich-quick/exponential-recruiting-exhausts-population-within-dozen"
 ],
 "scores": { "overall": 0.9, ... },
 "gaps": [],
 "audit": {
  "central": { "text": "Most MLM participants earn little or nothing and a substantial share lose money", "status": "supported", "decision": "approved", "strength": 0.65, "independent": 4 },
  "findings": [ ["evidence","f0","supported","approved"], ["evidence","f1","qualified","qualify"], ["evidence","f2","qualified","qualify"], ["evidence","f3","qualified","qualify"] ]
 }
}
```

The review entry that produced it (`get-rich-quick/story-review.json`, `stories["decision:mlm-and-seminars"]`) carries `coherence`, the pruned `claims` list (the recap group also held two rental-property claims), `question`, `title`, `premise`, `arc`, `qualificationsAccepted: true`, and (new) `audience`. Note: `independent: 4` counts the FTC blog summary and the FTC report as two documents even though `site.json` now marks them `sameStudy` (see finding P1-3).

### 2.2 Script evidence package

Producer: `buildPackage` (`src/lib/script.ts:124`). Location: `get-rich-quick/scripts/decision-mlm-and-seminars/evidence-package.json` (552 lines). Top-level keys (observed): `topic, story, inputs, audience, title, question, alternates, premise, whyWatch, tension, arc, format, readiness, central, claims, documents, gaps, fingerprint, generatedAt`. `fingerprint` is sha1 of everything except `generatedAt` (`src/lib/script.ts:261`); current value `4824306bfc`.

One claim, abbreviated:

```json
{
 "id": "get-rich-quick/recruiting-downline-gives-mlm-participants-leverage",
 "text": "Recruiting a downline gives MLM participants leverage and scalable income",
 "stance": "asserts", "verdict": "partly", "confidence": 0.5,
 "decidedBy": "FTC MLM income disclosure report 2024", "lean": "pro-hype", "role": "evidence",
 "guess": { "verdict": "wrong", "confidence": 0.65, "note": "Income disclosures show downline earnings concentrate ..." },
 "statements": [
  { "source": "1eWkeNDmQj4", "title": "Network Marketing Recruiting – How To Recruit 10 People In 10 Days", "channel": "Frazer Brookes", "kind": "video", "href": "https://www.youtube.com/watch?v=1eWkeNDmQj4", "stance": "asserts", "quote": "they might recruit 10 people themselves and have an organization of a thousand people" }, ...
 ],
 "evidence": [
  { "cite": "get-rich-quick/sources/ftc-2024-mlm-income-disclosures.txt#L838-L866", "doc": "get-rich-quick/sources/ftc-2024-mlm-income-disclosures.txt", "by": "FTC MLM income disclosure report 2024", "verdict": "partly", "confidence": 0.5, "note": "Downline-based commissions and rank bonuses exist, but the rank tables show over 90% ...", "role": "qualifies", "applicability": "direct", "basis": "heuristic", "why": "the verdict bears on the claim as worded", "passage": "<the lines, present in the file>", "audited": true }, ...
 ],
 "audit": { "text": "...", "status": "qualified", "decision": "qualify", "limitations": [ ... ], "suggestions": [ ... ] }
}
```

Document record: `{ "file": "get-rich-quick/sources/ftc-mlm-report-blog.txt", "name": "FTC MLM report summary", "sha": "81a0a3159f", "lines": 204, "sameStudyAs": "get-rich-quick/sources/ftc-2024-mlm-income-disclosures.txt", "cites": ["...#L35-L35"] }`.

Five evidence categories the task asked for map to: `statements` (someone made the claim), `evidence.role` `supports` / `qualifies` / `contradicts` / `context`, and `guess` (never evidence). The MLM package has no `contradicts` item; the only counter-position is a `statements` entry with `stance: "denies"` (Eric Worre on the recruiting-income claim).

### 2.3 Structured script

Producer: writer agent. Location: `.../script.json` (1768 lines). Top level:

```json
{ "topic": "get-rich-quick", "story": "decision:mlm-and-seminars",
  "title": "How Much Money Do MLM Participants Actually Make?", "revision": 2,
  "generation": { "model": "claude-fable-5-1", "brief": "scripts/briefs/script.md", "date": "2026-10-17T11:00:00Z", "wordsPerMinute": 150, "evidencePackage": "4824306bfc", "notes": "Revision 2: ... Not adopted: ... 79 of more than 600 MLMs ..." },
  "sections": [ { "name": "hook", "sentences": [ ... ] }, ... ] }
```

One sentence with a derived figure (s56):

```json
{ "id": "s56",
  "text": "The survey says the most likely outcome, by a wide margin, is that you lose money or break even: 74 percent of participants did, nearly three in four.",
  "type": "factual",
  "assertions": [ { "id": "s56.a", "text": "74% of the surveyed participants lost money (47%) or broke even (27%).", "kind": "fact",
     "claims": [ { "id": "get-rich-quick/most-mlm-participants-earn-little-nothing", "stance": "asserts" } ],
     "evidence": [ { "kind": "study", "claim": "get-rich-quick/most-mlm-participants-earn-little-nothing", "cite": "get-rich-quick/sources/aarp-2018-mlm-study.txt#L135-L139" } ],
     "calc": { "expression": "47 + 27", "inputs": [ { "value": "47", "cite": "...#L135-L139" }, { "value": "27", "cite": "...#L135-L139" } ], "result": "74", "note": "share who lost money plus share who broke even" },
     "qualifications": [ "s50 says the figures are self-reported; 'most likely outcome' is a base rate, not a prediction about one person." ] } ] }
```

Sentence `type` ∈ factual, attributed, hypothetical, rhetorical, transitional. Assertion ids are `<sentence>.<letter>`. Sentence ids are stable across revisions; revision 2 inserted s65, s66, s67 (ids are not renumbered).

### 2.4 Validation report

Producer: `validateScript`, written by `npm run script -- validate`. Location: `.../validation.json` (6043 lines). Top level (observed):

```json
{ "topic": "get-rich-quick", "story": "decision:mlm-and-seminars", "revision": 2, "date": "2026-10-17T17:38:42.096Z",
  "status": "passed", "scriptFingerprint": "e798a4fd2c", "packageFingerprint": "4824306bfc",
  "wordsPerMinute": 150, "words": 1790, "minutes": 11.9,
  "counts": { "sentences": 67, "factual": 50, "assertions": 59, "verified": 59, "blocking": 0, "warnings": 21, "unreviewed": 0 },
  "revisionLimitReached": false,
  "sentences": [67 SentenceResult], "issues": [60 Issue], "resolved": [19 ReviewFinding+resolvedBy],
  "history": [ { "revision": 1, "status": "blocked", "blocking": 5, "warnings": 31, ... }, { "revision": 2, "status": "passed", "blocking": 0, "warnings": 21, ... } ] }
```

Per sentence: `{ id, section, text, type, fingerprint, words, status: verified|needs-review|blocked, approved, assertions: [{ id, text, kind, calc?, quote?, status, validation: <evidence.ts Validation without passages>, issues[] }], issues[] }`. Issue: `{ sentence, assertion?, category, severity: blocking|warning|info, explanation, refs?, suggestion?, by: deterministic|review, revision? }`. The 60 issues are 21 warnings and 39 info (`wording` notes on every paraphrased assertion).

### 2.5 Semantic review file

Producer: reviewer agent. Location: `.../script-review.json` (348 lines). Shape: `{ reviewer, model, date, revision: 2, approved: { "<sentence id>": "<fingerprint>" } (67 entries), findings: [20] }`. Severities present: 5 blocking, 11 warning, 4 info, all raised against revision 1. First finding, verbatim:

```json
{ "sentence": "s12", "assertion": "s12.a", "fingerprint": "9662063721", "revision": 1, "category": "unsupported", "severity": "blocking",
  "explanation": "The transcript shows the line is not John Oliver's. It is a clip of a former Herbalife distributor that the segment plays: ... Attributing the sentence to Oliver misattributes a critic's one-liner to the host.",
  "refs": ["get-rich-quick/store/transcripts/s6MwGeOm8iI.txt"],
  "suggestion": "Say 'in a clip John Oliver's show played, a former Herbalife distributor puts it this way: ...'" }
```

Note the `refs` path is under `store/transcripts/`, which `.gitignore` line 2 excludes (`git check-ignore` confirms). The evidence the reviewer used for this finding is not in the repository.

### 2.6 Structured storyboard

Producer: planner agent, then filled in place by `buildStoryboard`. Location: `.../storyboard.json` (1556 lines). Top level: `{ topic, story, title, scriptFingerprint: "e798a4fd2c", scriptStatus: "passed", wordsPerMinute: 150, runtime: 731, generation: {model, brief, date, notes: "<palette and type rules>"}, status: "ok", issues: [], scenes: [43] }`. Scene sc18 (the rank-table chart), abbreviated:

```json
{ "id": "sc18", "sentences": ["s24", "s25"], "purpose": "The single most revealing visual: one rank table drawn two ways.",
  "visual": { "category": "data-chart",
    "description": "Left: the table 'as the company shows it', ten equal rows ... Right: ... each row's height proportional to its share of participants, so the $41.69 row fills 92% of the height ...",
    "onScreenText": ["92.37% of participants: average $41.69", "<0.01% of participants: average $1,018,350.20", "half the rows describe half of one percent of the people"],
    "chart": { "type": "proportional-table", "title": "One income disclosure table, excerpted by the FTC (Figure 6)",
      "series": [ { "label": "92.37% of participants", "value": "$41.69", "cite": "get-rich-quick/sources/ftc-2024-mlm-income-disclosures.txt#L838-L866" }, ... 10 rows ... ],
      "note": "One company's table as excerpted by the FTC; the period of the averages is not stated in the excerpt ..." } },
  "citations": [ { "label": "FTC staff report, Figure 6: excerpted data from one income disclosure table", "cite": "...#L838-L866" } ],
  "direction": "Hold the proportional view 1.5 s after the last word.", "pauseSeconds": 1.5,
  "order": 18, "words": 55, "start": 228.8, "duration": 23.5, "end": 252.3,
  "narration": "One table the FTC excerpted shows the shape: 92.37 percent of participants in the bottom row, ..." }
```

`order`, `words`, `start`, `duration`, `end`, `narration` are derived by code; the rest is the plan. `narration` is always copied from the script (`src/lib/storyboard.ts:134`); a plan that supplies different narration is blocked (`:137`).

### 2.7 Human-readable review package

`script.md` (773 lines): narration by section with `[sNN ok|review|BLOCKED]` markers, open issues, then "Evidence by sentence" with each assertion's status, evidence roles, and passage excerpts re-read at render time. `storyboard.md` (750 lines): one section per scene with timing, narration, visual, chart table, citations, direction. `review.md` (96 lines): summary table (reproduced in section 6), open issues, resolved review findings with the revision that addressed them, research gaps, outstanding editorial decisions, history.

---

## 3. Evidence integrity: provenance traces

Method: `npm run script -- show get-rich-quick decision:mlm-and-seminars <id>` (executed for s04, s42, s12, s16, s37), which prints the assertion, its deterministic result and the cited lines read from `get-rich-quick/sources/*.txt`.

### Trace 1 (numerical): s04

- Narration: "In a study published in 2018, AARP asked 601 Americans who had actually done this how it went, and 47 percent said they lost money."
- Assertion s04.a: "AARP's survey, published in 2018, covered 601 current and former MLM participants, and 47% of them reported losing money."
- Claim: `get-rich-quick/most-mlm-participants-earn-little-nothing` (asserts).
- Documents: `get-rich-quick/sources/aarp-2018-mlm-study.txt` ("AARP MLM survey 2018"), cites `#L376-L392` and `#L135-L139`; both recorded verdicts `right`, confidence 0.65, applicability `direct` (the L376 one by reviewer judgment in `story-review.json`, since its note says "self-reported", which the wording heuristic would read as `partial`).
- Passages: L137 "Nearly half (47%) of MLM participants reported that they lost money."; L388 "Two hundred and eighty-five MLM participants (47%) reported that they lost money by joining."; L389 "Among all 601 MLM participants in the sample"; the page header inside L376-L392 reads "AARP STUDY OF MULTILEVEL MARKETING | August 2018".
- Deterministic result: `supported (approved): 2 supporting (1 independent, strongest 0.65)`; figures 2018, 601, 47 all found in cited text.
- Limitations: self-reported (carried by s50 and s65); "Americans" rests on the verdict note's phrase "nationally representative" and the study's methods section (L105-L117), which is not a cited passage.
- Verdict: genuinely supported. One soft spot: "2018" is validated only because a page header happens to sit inside the cited range; the reviewer separately noted fieldwork was in 2017, so the narration says "published in 2018".

### Trace 2 (methodological qualification): s42

- Narration: "That number depends on his assumptions about what participants had to spend, how many dropped out and how many were ever counted, which he states; it is an estimate built on the companies' tables, not a measurement of anyone's bank account."
- Assertion s42.a: "Taylor's loss rate is calculated from company earnings reports under assumptions he states about participants' expenses, retention and the share of participants counted."
- Claim: `most-mlm-participants-earn-little-nothing`; document `taylor-case-against-mlm.txt` ("Taylor, The Case against MLM"), cite `#L1785-L1790`, verdict `right` 0.55 direct.
- Passage (complete): "Observation from Appendix 7A: In every case, using the analytical framework described above, the loss rate for all of these MLMs ranged from 99.12% to 99.97%, with an average of 99.6% of participants losing money. On average, one in 238 actually profited after subtracting expenses, and 996 out of 1,000 lost money ... to say nothing of the time invested."
- Deterministic result: `supported (approved)`, no figures in the assertion to check.
- **Chain weakness (observed):** the cited passage says "using the analytical framework described above" and "after subtracting expenses". It does not mention retention or how participants were counted. Those come from Taylor's footnotes 45 to 48 (reviewer's finding on revision 1), which are not a recorded cite. The sentence is a correct qualification, but its provenance for "how many dropped out and how many were ever counted" is the reviewer's reading, recorded only in `script-review.json` (explanation text), not in a passage reference the code can resolve.

### Trace 3 (attributed): s12

- Narration: "The critics have their own one-liner; in a clip John Oliver's show played, a former Herbalife distributor puts it this way: \"You make money from signing people up.\""
- Assertion s12.a (`kind: attribution`): statement evidence `{claim: mlm-income-comes-mainly-recruiting-leading, source: s6MwGeOm8iI}`; recorded quote in the store: "You make a little, not much. Not enough to pay the bills that are wrecking up. You make money from signing people up."
- Deterministic result: `supported (approved)`: quotation found inside the recorded quote and inside the sentence; one source suffices because the frame has no plural word.
- **Chain break (observed):** "a former Herbalife distributor" and "in a clip" are supported only by the reviewer's reading of `store/transcripts/s6MwBI...` (the finding's `refs`), a gitignored cache file. The recorded 25-word quote does not identify the speaker. The code verifies the words, not the speaker. Revision 1 attributed the line to Oliver himself and passed every deterministic check; only the LLM review caught it.

### Trace 4 (numerical with denominator): s16

- Narration: "Once FTC staff worked through the fine print, the statements with enough data to tell showed most participants received $1,000 or less in a year: under $84 a month."
- Assertion s16.a: cites `ftc-mlm-report-blog.txt#L35-L35` (verdict right 0.4) and `ftc-2024-mlm-income-disclosures.txt#L1481-L1498` (right 0.6).
- Passages: blog L35 "most participants made $1,000 or less per year — that's less than $84 dollars per month. And that may not account for expenses."; report L1492-L1494 "For 33 of the disclosures, staff calculated the portion of participants with $1,000 or less in reported income for the year."
- Deterministic result: `supported (approved): 2 supporting (2 independent, strongest 0.6)`. **The "2 independent" is wrong**: `site.json` marks the blog as `sameStudy` of the report, but `src/lib/evidence.ts:258` counts distinct files. Status is unaffected; the count is misleading in `script.md` and the site.
- Verdict: supported; the narration's "with enough data to tell" is the reviewer's correction (revision 1 said "read as published").

### Trace 5 (partial evidence, modality): s37

- Narration: "Both can be true at once, because in the plans the FTC describes, the \"customer\" can be the recruit, buying a set amount of product to qualify, and the plans pay commissions on those purchases."
- Assertion s37.a cites `ftc-2024-mlm-income-disclosures.txt#L201-L205`, recorded verdict `partly` 0.3 on `mlm-income-comes-mainly-recruiting-leading`.
- Passage L201-L205: "MLMs often offer commissions ... for meeting specific benchmarks, such as purchasing or inducing others to purchase a certain amount of products ... or recruiting a certain number of new participants who make such purchases. In some cases, participants can also generate revenue ('retail income') ..."
- Deterministic result: `qualified (qualify)`, a `needs-qualification` warning; status `verified` only because the reviewer approved the sentence at its current fingerprint.
- Verdict: supported as worded ("can be"); revision 1 said "often", which the reviewer blocked as a frequency claim the passage does not make.

### 3.1 Figures that rest on verdict notes rather than passages

`src/lib/evidence.ts:370-375` matches figures against the cited passages **and the verdict notes** (agent-written one-line summaries recorded in the store). A scan of the final script (executed with a small node script during this audit; not part of the repo) found these assertion figures absent from every cited passage as digits and present only in a note: s19.a "70", "29"; s21.a "20"; s29.a "14"; s41.a "30"; s46.b "70", "29"; s47.a "14"; s57.a "14"; s61.a "14". In each case the passage states the number in words ("Twenty-nine", "Fourteen percent", "Twenty of the disclosures") or elsewhere in the document ("30 MLMs" at L868-L871 for s41.a). The chain therefore passes through an LLM-written note for 10 figures in 8 assertions. The reviewer read the passages and confirmed them, so no figure is wrong, but the deterministic layer did not establish them from source text.

---

## 4. Validator architecture and effectiveness

### 4.1 Deterministic checks (`src/lib/script.ts:441-740`)

| Check | Severity | Location |
|---|---|---|
| Duplicate sentence id, unknown section | blocking | `:462-472` |
| Missing section (of the seven) | warning | `:466` |
| Package fingerprint differs from `generation.evidencePackage` | warning | `:479` |
| Factual or attributed sentence with no assertion | blocking `missing-provenance` | `:509` |
| Figure (digits) in a non-factual sentence without assertions | warning `figure-in-non-factual` | `:517` |
| Figure in a sentence not present in any of its assertions' text | blocking `figure-without-assertion` | `:530` |
| Calculation: every input in its cited passage; every operand declared or in `CONSTANTS` {1,10,100,1000,12,52,365}; expression evaluates to `result` within half a unit of the last written decimal; result present in the assertion text | blocking `bad-arithmetic` | `:548-574` |
| Evidence gate (`validate`, `src/lib/evidence.ts:176`): unknown claim, unknown cite, missing passage, statement with the wrong stance | blocking `bad-reference` | `:582`; evidence.ts `:236-238` |
| Gate decision `blocked` without reference problems (no supporting study, contradicting study, AI guess only, context only, attribution without enough sources, figure absent from cited text) | blocking `invented-number` / `contradicted` / `unsupported` | `:584-590`; evidence.ts `:310-376` |
| Gate decision `qualify` (partly verdict, partial applicability, weak support below 0.5, absolute word without strong support) | warning `needs-qualification` | `:594-607` |
| Paraphrase of the canonical claim | info `wording` | `:608` |
| Attribution figure not in the recorded source quotes | blocking `figure-not-in-quote` | `:616-622` |
| Quotation: at least three words; cite or source among the assertion's evidence; normalised text inside the passage or recorded quote; inside the sentence | blocking `quote` / `misquote` | `:624-646` |
| Runtime outside 8 to 12 minutes | warning | `:688` |

Figure matching is digit-only (`:424`, evidence.ts `:174`); "fourteen percent", "twenty-nine" and "a thousand" are invisible to it (ponytail comment at evidence.ts `:173` acknowledges this). Small numbers match trivially ("3", "1").

### 4.2 Semantic review and whether it is mandatory

The reviewer's file is merged at `:488-500`. A finding counts only while its `fingerprint` equals the sentence's current fingerprint; otherwise it is listed as resolved. A sentence is `verified` only if `review.approved[id] === fingerprint` and nothing blocking is open (`:663-667`). Script status (`:698`): `blocked` if any blocking issue; otherwise `needs-review` if any sentence lacks a current approval **or no review file exists**; otherwise `passed`. So semantic approval is mandatory for `passed`, for every sentence including transitional ones (observed: after a code change during the session, trimmed transitional sentences s26, s32, s45 dropped to `needs-review` until re-approved).

What is **not** enforced: that the reviewer read anything. An `approved` map is a bare id-to-fingerprint dictionary; a careless reviewer can approve everything. The brief (`scripts/briefs/script-review.md`) instructs otherwise, and the observed round 1 shows the reviewer did read transcripts and footnotes, but that is behaviour, not a mechanism. Independence between writer and reviewer is also procedural: both were the same model in different sessions.

### 4.3 Independent inspection versus trusting the generator

The validator rebuilds the corpus from the live store (`loadTopic` in `scripts/script.ts:95`), not from the package, and resolves every reference itself. Uncited study verdicts on the same claim are pulled in as contradictions or qualifications whether or not the writer cited them (evidence.ts `:243-247`). The writer cannot hide a contrary verdict. However, the writer chooses which claims an assertion "rests on"; evidence attached to other claims is not consulted. A sentence about the rank table attached to claim 3 is checked against claim 3's verdicts only.

### 4.4 Multiple assertions per sentence

Each assertion runs through the gate separately and gets its own issues and status (`:545-654`); a sentence is blocked if any assertion is (`:664`), and a sound assertion in a blocked sentence stays `needs-review`, never `verified` (`:665`). Figures in the sentence text must each appear in some assertion (`:530`). Non-numeric clauses without an assertion are invisible to code; the brief assigns that to the reviewer ("coverage").

### 4.5 Detection by error type

| Error | Deterministic? | Semantic? |
|---|---|---|
| Invented number | Yes if written in digits and absent from passages **and notes** | Yes |
| Wrong denominator or population | No (a correct number applied to the wrong group passes) | Yes (observed: reviewer caught "the one nationally representative survey", "more than 90 percent" generalised from one table) |
| Incorrect quotation | Yes, against the passage or the 25-word recorded quote | Speaker attribution only semantically (observed: Oliver misattribution) |
| Missing qualification | Partly: `qualify` decisions warn and block `passed` until approval; absolute words warn | Yes |
| Overgeneralisation | Only absolute words (`ABSOLUTE` regex) | Yes (observed: s62, s44.b) |
| Causation | No | Yes (observed: s49 "which is exactly why") |
| Gross versus net | No | Brief lists it; observed in s16, s21, s46 findings |

### 4.6 Blocking criteria and approval despite gaps

A script cannot be `passed` with an open blocking issue (`:698`), without a review file, or with a sentence approved at a stale fingerprint. The `storyboard` stage blocks on a `blocked` script (`storyboard.ts:107`) but proceeds on `needs-review` (observed: the storyboard was built and reported `ok` while the script was still `needs-review`; `scriptStatus` is recorded in the storyboard).

Ways a materially unsupported statement can still pass (observed or inferred from code):
1. A figure spelled in words (inferred from `:424`).
2. A figure present only in a verdict note (observed, section 3.1).
3. A clause with no number and no assertion inside a factual sentence (inferred; the reviewer is the only check).
4. A reviewer who approves without reading (inferred).
5. A statement's speaker or context beyond the recorded 25-word quote (observed, s12).

### 4.7 Revalidation and invalidation

- Edited sentence: fingerprint changes (`:401`, over text plus assertion text, claims, evidence, quote, calc), approval and open findings lapse. Observed in revision 2: 28 sentences dropped to `needs-review`, 19 findings moved to `resolved` with `resolvedBy: 2`.
- Changed research: validation re-reads the live store, so a retracted verdict yields `bad-reference` (inferred from evidence.ts `:236`). A changed package yields only a `stale-package` warning (`:479`). **A changed source `.txt` (re-run of pdftotext shifting line numbers) is not detected by validation**: the package records a document `sha` but `validateScript` never compares it (observed: no reference to `documents[].sha` in the function). Cites would silently point at different lines.
- Storyboard: `stale-script` blocks when the plan's `scriptFingerprint` differs from the script (`storyboard.ts:102`).

---

## 5. Adversarial validation tests

Tests live in `tests/script.test.ts` (15 tests) and `tests/evidence.test.ts` (18 tests), on a synthetic corpus (`tests/corpus.ts`), not on the MLM data. All pass (section 7).

| Case | Executable test | Prompt only | Not addressed |
|---|---|---|---|
| Invented statistic | `script.test.ts:158` ("62 percent" blocked `invented-number`); `evidence.test.ts:83` | | Word-form numbers |
| Incorrect denominator | `script.test.ts:187` only for an undeclared operand or an input absent from the passage (`100 - 47 - 33`, `['47']`) | Brief: "percent of whom" | A correct number stated over the wrong base (no test, no code) |
| Valid number, wrong population | | `script-review.md` entailment step | Yes, not addressed in code |
| Gross versus net | | `script.md`, `script-review.md` | Yes, not addressed in code |
| Fabricated quotation | `script.test.ts:174` (`misquote`) | | Speaker identity |
| Correlation as causation | | `script-review.md` category `causation` | Yes, not addressed in code |
| Unsupported universal conclusion | `evidence.test.ts:94` ("always" → qualified, review) ; `script.test.ts:206` (contextual-only blocked; partly → needs-review, never passed alone) | | Universals without a trigger word |
| Reference to an irrelevant passage | `evidence.test.ts:107` (missing passage blocks); `script.test.ts:127` (statements alone cannot support a fact) | Brief: entailment | A real but irrelevant passage on the right claim passes code |
| Multiple assertions, one supported | `script.test.ts:246` (sentence blocked, sound half stays `needs-review`); `:158` (`figure-without-assertion`) | | Unnumbered uncovered clause |
| Stale approval after edit | `script.test.ts:262` (approval lapses, finding resolved, history) ; storyboard `stale-script` at `:407` | | |
| Blocking beats blanket approval | `script.test.ts:300` | | |
| Revision limit | `script.test.ts:300` (last assertion, `revisionLimitReached`) | | Nothing stops a revision 4 |
| Storyboard narration and timing | `script.test.ts:376`, `:407` | | |

No test exercises the CLI (`scripts/script.ts`) or the real MLM artifacts; `tests/dist.test.ts:49` checks only that the built page has a sentence badge and a link.

---

## 6. Generated MLM video quality

Paths: `get-rich-quick/scripts/decision-mlm-and-seminars/{script.md, storyboard.md, validation.json, review.md}`.

| | |
|---|---|
| Words | 1790 (67 sentences, 50 factual or attributed, 59 assertions) |
| Estimated runtime | 11.9 min narration at 150 wpm; storyboard 12:11 (731 s) including 18 s of declared pauses |
| Scenes | 43: 11 data-chart, 11 diagram, 11 typography, 4 document-excerpt, 5 animation, 1 transition |
| Validation | `passed` at revision 2; 0 blocking, 21 warnings, 0 unreviewed; 59/59 assertions verified |
| Unresolved findings | None from the reviewer. All 21 warnings are deterministic `needs-qualification` entries on assertions resting on `partly` verdicts (claims 2 to 4) plus one `"all"` wording flag on s46.b |

Caveat on runtime (inferred): the estimate counts whitespace tokens; the narration has 68 numeric tokens, several of which take many spoken words ("$1,018,350", "99.12"), so real narration will run longer than 11.9 minutes.

**Opening hook and central question.** Hook: a hypothetical message from a friend, a recruiter's "leverage" quote, then "47 percent said they lost money ... Only 25 percent said they made any profit at all", then "So where does the money go, and why does leverage ... show up in almost nobody's bank account?" Central question (s07): "how much money do people in multi-level marketing actually make?"

**Narrative structure.** Hook (6 sentences) → Setup: three evidence sources, the pitch in three recruiters' words, two critics' lines → Investigation in three acts: the disclosures and three fine-print problems (who is counted, what is counted, how it is presented, ending on the rank table); the AARP survey distribution; the mechanism (how plans pay, Taylor's reading, the recruiters' rebuttal, the rank table again, Taylor's 99.6% with its assumptions, the 13-cycle arithmetic labelled untested) → Findings recap → Qualifications (five sentences) → Implications (base rates, a three-question checklist) → Conclusion answering the question and returning to the friend.

**Three strongest sections.**
1. The fine-print act (s18 to s25): three concrete, cited mechanisms (29 and 24 exclusions, no expenses netted, 44 rank-only tables) ending on the one table drawn two ways; storyboard sc15 to sc18 carry it with diagrams and a proportional table built from real values.
2. The dialectic on mechanism (s33 to s37): FTC description, Taylor's reading, the recruiter's denial quoted verbatim, and a reconciliation worded to what the passage supports ("can be the recruit").
3. The qualifications (s50 to s54): short, specific, and tied to each source's limits; they also disarm the 13-cycle meme rather than repeating it.

**Three weakest sections.**
1. Findings recap (s45 to s49) repeats numbers the viewer heard two minutes earlier; s49 is a 44-word sentence with a "because" clause the reviewer accepted but which still reads as explanatory.
2. s08 is a 55-word list of sources before anything has happened; the evidence-cards visual (sc07) has to carry it.
3. The survey distribution (s28 to s31, s65) is dense with figures (nine percentages and six dollar bands across four sentences); it depends on the charts (sc20 to sc22) to be followable.

**Conclusion.** s60 to s62 answer the opening question with figures already established (47/27/25, "$1,000 or less ... before expenses", "half of one percent made a lot", leverage "real for the fraction at the top"). Every assertion in them is verified; the wording was narrowed in revision 2 from "paid for by the more than 90 percent" to the FTC's "vast majority". It answers the question as precisely as the evidence allows and says what is not measured.

**Storyboard concreteness.** Scenes name what is on screen, what moves, in what order, and the palette rules are in `generation.notes`. Reused components are named (node tree, 601-dot plot, person-icon grid). Charts carry real values with a cite per value and a `note` saying what the chart must not imply (for example sc16's expense block "must read as unknown height; never give it a number"; sc21's $100,000 group "must be drawn as three dots, not a bar"). Weak spots: chart `type` strings are free text ("proportional-table", "waffle", "stat-tiles"); values are display strings, not numbers; three values are written "fourteen percent (as written in the source)" because the digit check could not find "14" in the AARP passage, which shows the check is honest but also that word-form values pass it with no check at all.

**Cited chart data.** Every chart value with digits was verified by code against its cited passage (`storyboard.ts:160-166`); the first run blocked three "14%" values (observed) until they were rewritten in words. The ten rank-table rows in sc18 match `ftc-2024-mlm-income-disclosures.txt` L844-L862 exactly. No distribution is drawn where only an aggregate exists (sc13, sc16 are tiles and an unknown-height block).

**Full script narration** (from `script.md`; markers removed, every sentence below was `ok`):

> **Hook.** Somewhere in your messages there is probably a pitch like this. A friend you have not heard from in years has started a business, and she would love to have you on her team: you earn from what you sell, and from everyone you bring in after you. The recruiters have a word for that second part: one trainer promises to show you how to "finally create the leverage that you need inside of your network marketing business". In a study published in 2018, AARP asked 601 Americans who had actually done this how it went, and 47 percent said they lost money. Only 25 percent said they made any profit at all. So where does the money go, and why does leverage that sounds so good on paper show up in almost nobody's bank account?
>
> **Setup.** This video is about one question: how much money do people in multi-level marketing actually make? To answer it we have three kinds of evidence: 70 of the companies' own income disclosure statements, read closely by Federal Trade Commission staff; a nationally representative survey of 601 participants by AARP; and an analysis of 30 companies by Jon Taylor, an independent analyst who argues against the industry. First, the promise, in the recruiters' own words: one coach tells his audience that once the team grows, "it starts to compound", like a snowball; another says the person you bring in "might recruit 10 people themselves and have an organization of a thousand people". Another trainer puts the whole idea in one line: it would be "better to have a smaller percentage of 100 people than 100 of yourself". That is the pitch: income from the efforts of other people. The critics have their own one-liner; in a clip John Oliver's show played, a former Herbalife distributor puts it this way: "You make money from signing people up." Even the FTC's own consumer page says, flatly, that "Most people who join legitimate MLMs make little or no money." Two confident stories, so let us see which one the numbers tell.
>
> **Investigation.** Start with the companies, because some of them publish an income disclosure statement, and FTC staff collected 70 of them, from household names to small firms. Once FTC staff worked through the fine print, the statements with enough data to tell showed most participants received $1,000 or less in a year: under $84 a month. In at least 17 of the 70 companies, most participants made nothing at all. And that is the generous reading, because of three things buried in the fine print. First, who gets counted: of the 70 statements, 29 leave out participants who earned no commission, and another 24 leave out anyone the company has labelled inactive. What happens to an average when you remove the zeros before you take it? Second, what gets counted: not one of the 70 statements reports income with expenses taken out in full, and 20 of them never say whether expenses were taken out at all. So the dollar figures are what the company paid out, before most or all of whatever the participant spent to take part. Third, how it is presented: 44 of the 70 break the numbers out only by rank, and in those tables, nearly without exception, the vast majority of participants sit in the two or three lowest ranks. One table the FTC excerpted shows the shape: 92.37 percent of participants in the bottom row, with average earnings of $41.69. The top row averages just over $1,018,350, and holds fewer than 0.01 percent of participants; as the FTC puts it, half the rows in that table describe half of one percent of the people. Disclosures count what companies paid, not whether anyone came out ahead; for that you have to ask the people. AARP did, in a study published in 2018, using a probability-based national panel, the kind of sample that lets you generalise to the whole country. Among the 601 current and former participants it reached, 47 percent said they lost money, 27 percent said they broke even, and 25 percent said they made a profit, counting their entire time in the business. Profit, for most of that quarter, was small: 14 percent of all participants made under $5,000 in total, and only 3 percent made $25,000 or more. Three people, half of one percent of the sample, reported profits of $100,000 or more; those three had each been in the business more than five years, and one of them had founded the company. On the other side of the ledger, 41 percent lost less than $5,000, 3 percent lost $5,000 to $9,999, and 1 percent lost more than $10,000. These are people's own accounts of what they put in and took out, which is a limit; they are also the only figures so far that measure profit or loss rather than payout. So most people lose or break even, and the few who profit mostly profit a little. The pitch said recruiting would compound, so why doesn't it? The FTC describes how the pay plans typically work: commissions for hitting benchmarks such as buying a set amount of product, getting others to buy it, or recruiting people who then buy it; selling to an outside customer at a markup is mentioned as a source of income "in some cases". Taylor went further: he read the compensation plans of the 30 companies with published earnings data, and of more than 350 in all, and concluded that each of them pays primarily for recruiting a large downline rather than for retailing product, with most of the payout going to the highest levels. That is one analyst's reading of the plans; the FTC's report describes the same structure but does not measure how much income actually comes from downlines versus retail customers. The recruiters reject that framing; the same trainer insists that "you don't get paid for the act of building the team you only get paid when sales happen to a customer". Both can be true at once, because in the plans the FTC describes, the "customer" can be the recruit, buying a set amount of product to qualify, and the plans pay commissions on those purchases. Which brings us back to leverage: if income flows up from a downline, somebody has to be the downline. In that rank table, over 90 percent of participants were in a cohort averaging under $100. Taylor's own summary of the pitch says the quiet part: the appeal is "time freedom or leveraged income", a flow from the efforts of others, and under these pay plans getting it depends on recruiting a downline more than on selling the product. His own estimate is blunter: across the 30 companies, after subtracting required purchases and modest expenses, he puts the share losing money at 99.6 percent, about one in 238 profiting. That number depends on his assumptions about what participants had to spend, how many dropped out and how many were ever counted, which he states; it is an estimate built on the companies' tables, not a measurement of anyone's bank account. Critics like to finish with arithmetic; in John Oliver's version, if each recruit brings in a handful more, "you could only do that 13 cycles and you would exceed the population of the earth." None of the studies here tests that arithmetic directly; what they show is the shape it predicts. Taylor writes of pyramid schemes, a class in which he places MLMs, that recruitment eventually dries up as the market saturates, leaving the vast majority at the bottom. And among the former participants AARP surveyed, 29 percent said they left because the commission structure mostly benefited those at the top, and 25 percent because the market was saturated.
>
> **Findings.** Put the three side by side and they agree on the shape, though they measure different things. The companies' own statements: most participants received $1,000 or less in a year, before expenses, and most of the tables leave some participants out entirely. The survey: 47 percent lost, 27 percent broke even, 25 percent profited, and of that 25, 14 points made under $5,000. The analyst: 99.6 percent losing, once required purchases are counted as a cost. And on the central promise: the plans do route money upward from a downline, and the rank tables show where that leaves most people, because in table after table the FTC looked at, the vast majority sit in the two or three lowest ranks with the smallest amounts.
>
> **Qualifications.** Now the limits, because they matter: the AARP numbers are self-reported, by current and former participants, and nothing checks them against bank statements. The FTC's figures are company payouts, not profit, and they cover the 70 companies whose statements were publicly available, which is not the whole industry. Taylor is an independent analyst who argues against the industry, and his 99.6 percent is a calculation under assumptions he states, not a count of real accounts. The split between recruiting income and retail income has been described in these documents, and argued, but not measured. And the thirteen-cycles arithmetic is a thought experiment that none of these studies tested; the rank tables show where people end up, not why.
>
> **Implications.** So, back to that message from your friend; suppose you say yes. The survey says the most likely outcome, by a wide margin, is that you lose money or break even: 74 percent of participants did, nearly three in four. If you do profit, the same survey suggests it will most likely be under $5,000 over your whole time in the business. And the leverage? It exists, in the plan documents; the rank tables show who it works for. Before you answer, ask for the income disclosure statement, and then ask three questions of it: who is left out of the table, whether the figures are before expenses, and how many people are in the bottom row.
>
> **Conclusion.** How much money do MLM participants actually make? For most of them, nothing, or less than nothing: in the nationally representative survey, 47 percent lost money and 27 percent broke even, and in the companies' own statements most participants received $1,000 or less in a year before expenses. A quarter made some profit, mostly small, and half of one percent made a lot. The leverage the pitch sells is real for the fraction at the top; in the plans Taylor read, most of the payout goes to the highest levels, and in the FTC's rank tables the vast majority sit at the bottom. None of that is a verdict on your friend. It is a description of the structure she has joined, written mostly by the companies themselves, and it is worth reading before you join it too.

**Review.md summary table** (verbatim): Story `decision:mlm-and-seminars` (get-rich-quick); Revision 2 of at most 3; Validation **passed** (2026-10-17); 1790 words, about 11.9 min at 150 wpm; 67 sentences (50 factual or attributed); 59 assertions, 59 verified; 0 blocking, 21 warnings; 0 unreviewed; Scenes 43, 12:11 (ok); Evidence package 4824306bfc (4 documents, 4 claims); Model claude-fable-5-1. History: revision 1 blocked (5 blocking, 31 warnings); revision 2 passed (0, 21).

**Storyboard.md** is 750 lines; scene sc18 is reproduced in section 2.6. Scenes sc01 to sc03 (phone notification, node tree, quote card) read as in the plan; the full file is at the path above.

---

## 7. Operational verification

Executed during this audit (all from the repo root, Git Bash on Windows):

| Command | Result |
|---|---|
| `npx astro check` | 0 errors, 0 warnings, 0 hints (36 files) |
| `npx eslint .` | exit 0, no output |
| `npm run format:check` | "All matched files use Prettier code style!" |
| `npx vitest run` | 5 files, 109 tests passed |
| `npm run build` | 12 pages built (overwrites `dist/`, gitignored) |
| `npx vitest run tests/dist.test.ts` | 54 passed (after the build) |
| `npm run validate` (earlier in the session, same tree) | passed all five steps |
| `npm run script -- show get-rich-quick decision:mlm-and-seminars <s04,s42,s12,s16,s37>` | printed the sheets quoted in section 3 |
| `npm run script -- run get-rich-quick decision:mlm-and-seminars` (end of the implementation session, same artifacts) | package unchanged; `passed: 1790 words ... 59 verified, 0 blocking, 21 warnings, 0 sentences unreviewed`; `ok: 43 scenes, 731s`; exit 0 |

Not run during the audit because they rewrite committed-to-be artifacts: `npm run script -- package|validate|storyboard|run` (they overwrite `evidence-package.json`, `validation.json`, `script.md`, `review.md`, `storyboard.json`, `storyboard.md`; `validate` also refreshes the `date` and `history`), `npm run stories -- discover`, `npm run report` (needs the external watcher checkout), `npm run record-sources` (modifies the store). The agent stages (writing, review, storyboard planning) were executed in the implementation session through Claude Code; there is no command that performs them.

Commands to produce a package (inspected, `scripts/script.ts:1-7`): `package`, then an agent writes `script.json`, `validate`, then an agent writes `script-review.json`, `validate` again, then an agent writes `storyboard.json`, `storyboard`; `run` drives the deterministic ones; `show` inspects. Exit code 2 on a blocked script or storyboard (`:204`, `:212`, `:226`).

Git state: all script-stage work is uncommitted (`git status`: 15 modified, 9 untracked paths listed in section 1.2). The last commit on `main` is `d53d4a9 Merge branch 'story-discovery'`.

---

## 8. Architectural assessment

**Demonstrated defects**

1. Figures validated through verdict notes (section 3.1; `src/lib/evidence.ts:370`). Ten figures in the MLM script rest on agent-written notes, not source text.
2. Document-content drift undetected by validation (section 4.7): `validateScript` never checks `documents[].sha`; re-converting a PDF would move every line-based cite silently.
3. Independence double-count: `evidence.ts:258` counts the FTC blog and report as two documents despite `sameStudy` (observed "2 independent" on s16.a and six other assertions; `stories.json` central `independent: 4`).
4. Word-form numbers are unchecked both in the script (`script.ts:424`) and in storyboard chart values (`storyboard.ts:160`); the "fourteen percent" workaround shows the gap being used.
5. Reviewer evidence outside the repository: finding refs point at `store/transcripts/`, which is gitignored; the s12 speaker attribution cannot be re-verified from the public repo.
6. `record-sources` supersession: recording a second passage from a document already judged on a claim replaces the earlier verdict in the story audit (`evidence.ts:138-147`, newest per document). Observed: the FTC L1481 passage dropped out of the story's audited support when L634/L734 were added; the package exposes older cites with `audited: false` but the story's `evidenceAvailable` changed. Adding research can silently reshape the story record.

**Speculative risks (inferred, not demonstrated)**

- Approval without reading: nothing binds an approval to evidence consulted. A `refs`-per-approval requirement or a reviewer sheet hash would help.
- `storyboard.json` mixes plan and derived fields; a designer who edits `narration` triggers `reworded-narration`, but one who edits `start`/`duration` will have them overwritten on the next run without notice.
- Runtime model (whitespace tokens / 150 wpm) will underestimate narration with many numerals; no per-sentence timing exists for a renderer to align visuals to.
- `evalExpr` uses `Function` behind a `[\d.\s+\-*/()]` whitelist (`script.ts:428-437`); safe as written, but any widening of the whitelist is a code-injection surface from a JSON file.
- `MAX_REVISIONS` is reported (`revisionLimitReached`) but not enforced; a revision 4 validates normally.
- The seven-section structure and sentence `type` set are fixed; advice sentences had to be typed `rhetorical` (s59) because no type fits.
- Timestamps (`generatedAt`, `date`, `history`) make `validation.json` and `evidence-package.json` churn on every run even when nothing changed; fingerprints are stable but diffs are noisy.
- External dependencies: `record-sources` and `report` need `../retire-sim/watcher` or `$WATCHER_DIR` (documented in README); `pdftotext` for new sources. No LLM API keys anywhere.

**Barriers to narration and rendering next**

- No per-sentence timing; scene timing derives from word count.
- Chart specs are prose plus display strings; a renderer needs numeric series, units and a chart-type enum.
- No asset manifest or ids; `assets` are free-text strings.
- Pronunciation and reading of numerals ("$1,018,350", "99.12 percent", "s6MwGeOm8iI" never appears in narration, which is good) are unaddressed.
- Nothing produces SSML or a TTS script; `script.md` markers would have to be stripped.

**Duplication or unnecessary abstraction**

- `buildPackage` re-derives direction and applicability for non-audited verdicts (`script.ts:184-210`) duplicating logic in `evidence.ts:146-170`; a small shared helper would remove it.
- `renderReviewMd` lists the same 21 warnings under both "Open issues" and "Outstanding editorial decisions".
- Otherwise the stage is three modules and one CLI with explicit file contracts; no job system, no framework.

---

## 9. Prioritised findings

| # | Sev | Observed problem | Evidence | Consequence | Smallest fix | Blocks first video? |
|---|---|---|---|---|---|---|
| 1 | P0 | Speaker attributions and context beyond the 25-word recorded quote are unverifiable by code; the Oliver misattribution passed all deterministic checks | s12 history: revision 1 `validation.json` history shows 5 blocking from review only; `script-review.json` finding 1; `.gitignore:2` excludes the transcript the reviewer cited | A wrong attribution ships if the reviewer misses it | Require a `quote.source` attribution to name only the source title or channel unless a recorded quote identifies the speaker; or record speaker context in the store assertion when extracting | No (resolved for this script), but P0 for the method |
| 2 | P0 | Figures accepted from verdict notes, not passages | section 3.1 scan: 10 figures in 8 assertions; `evidence.ts:370-375` | Deterministic layer does not actually tie those numbers to source text; a wrong note would pass | Match figures against passages only and let a `calc`-like `spelled` field map digit to the passage's words; or require notes to be excluded when a passage is present | No (reviewer confirmed each), yes for trust in the gate |
| 3 | P1 | Independence count ignores `sameStudy` | `evidence.ts:258`; s16.a "2 independent"; story `independent: 4` | Overstates corroboration in script.md, the site and story scores | Collapse `docOf` through `sameStudy` in `validate` and `discover` | No |
| 4 | P1 | Source text changes are not detected by `validate` | no sha check in `validateScript`; `documents[].sha` only in the package | Line-based cites can silently point at other text | In `validateScript`, compare each cited file's sha to the package's and block on mismatch | No now; yes before re-running pdftotext |
| 5 | P1 | Word-form numbers bypass figure and chart checks | `script.ts:424`, `storyboard.ts:160`; three chart values written as words | A spelled-out invented number passes code | Add number words to `nums` (or block any assertion whose text has no digits but whose sentence does) | No |
| 6 | P1 | Runtime estimate ignores numeral length and gives no per-sentence timing | `storyboard.ts:206`; 68 numeric tokens | Video runs long; renderer cannot align visuals | Count numerals by spoken length; emit `start` per sentence | Yes for rendering alignment |
| 7 | P1 | Adding a verdict supersedes the audited passage for that document | `evidence.ts:138-147`; story `evidenceAvailable` changed after `record-sources` | Research additions reshape the story record without review | Key story audit on the highest-confidence verdict per document, or let the review pin a cite | No |
| 8 | P2 | Nothing enforces that the reviewer consulted evidence or that writer and reviewer differ | `script.ts:663`; briefs only | Procedural independence only | Require `refs` per approval or a sheet hash in the review file | No |
| 9 | P2 | `MAX_REVISIONS` reported, not enforced | `script.ts:730` | Unbounded revision loops | Refuse `validate` when `revision > MAX_REVISIONS` without a `--force` | No |
| 10 | P2 | Chart specs are strings; no numeric series or type enum | sc18, sc21, sc29 in `storyboard.json` | Renderer must parse prose | Add `{value: number, unit}` beside the display string and an enum for `type` | Yes for programmatic charts |
| 11 | P2 | Uncommitted work | `git status` | Artifacts and code could be lost; CI has not run them | Commit on a branch and open a PR | Not technically |
| 12 | P2 | Timestamps churn derived JSON | `generatedAt`, `date`, `history[].date` | Noisy diffs | Date-only or omit when fingerprint unchanged | No |

---

## 10. Final assessment

1. **Does the repository actually generate a complete MLM script and storyboard?** Yes, with a qualification. The deterministic stages ran end to end and the artifacts exist and are complete (67 sentences, 43 scenes). The writing, review and storyboard planning were performed by agents in an interactive session following the briefs; no command regenerates them.

2. **Is every factual assertion independently verifiable through its provenance?** Mostly, not entirely. Every assertion resolves to a recorded claim, a verdict record and a passage or recorded quote, and `show` prints the chain. Three kinds of link are not independently verifiable from the repository: figures established only via verdict notes (10 figures), a methodological qualification whose detail (retention, counting) lies outside the cited lines (s42), and a speaker attribution whose evidence is a gitignored transcript (s12).

3. **Can unsupported statements incorrectly pass validation?** The deterministic layer alone: yes, for word-form numbers, unnumbered clauses, wrong populations, causal wording and speaker context. The combined process: only if the reviewer fails, because `passed` requires per-sentence approval at the current fingerprint and the observed review round caught exactly these classes (5 blocking, 11 warning findings, all resolved by revision 2).

4. **Is the generated script compelling enough to justify video production?** In my judgement yes for a research-explainer channel: a concrete hook, a real investigative structure, verbatim pitch quotes against the companies' own tables, and a conclusion that answers the question without overclaiming. Its weaknesses are density of figures in the survey passage and a recap section that repeats; both are editorial trims, not rewrites.

5. **Is the storyboard detailed enough to render without substantial editorial redesign?** For a human motion designer, yes: each scene states what is on screen, what moves and what the chart must not imply, with every value cited. For an automated renderer, no: charts are prose plus display strings, there is no per-sentence timing and no asset manifest.

6. **Three most important changes before starting video rendering.**
   1. Tie figures to passages, not notes, and add a spelled-number mapping (findings 2 and 5), so the deterministic gate means what it says.
   2. Add per-sentence timing and a numeral-aware runtime model, and give chart series numeric values and a type enum (findings 6 and 10), so the storyboard can drive a renderer.
   3. Bind reviewer evidence to the repository: make `refs` mandatory on findings and approvals and forbid gitignored paths (finding 1 and 8), then commit the branch so CI runs the suite.

**Recommendation: fix specific blockers first.** The script and storyboard are good enough to produce; the gate's trust model has two holes (note-sourced figures, out-of-repo reviewer evidence) and the storyboard lacks the timing and numeric data a renderer needs. None of these requires revisiting the script's content.
