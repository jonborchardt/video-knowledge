# Blog post idea: I ran 220 AI-coding videos through a fact-checker

Status: idea, not drafted. Written 2026-10-15 for the Always Shippable blog.
Numbers below come from `ai-coding/report.json` at commit df2c07b; re-run the queries
at the bottom before publishing.

**One-line pitch:** YouTube and blogs make hundreds of claims about AI coding tools. I
turned them into 366 canonical claims, judged each one, and checked 131 of them against 14
studies. Most of the hype died. Most of the practical advice held.

**Why it fits the blog:** a real artifact readers can click through, built with the same
agentic workflow the blog is about, and the whole repo shipped in one day of commits (all
eight commits are dated 2026-10-15).

## Hook options

- Eight of the ten "10x"-style claims in the corpus are judged wrong. The careful trials
  find gains of roughly 20 to 26 percent, and the METR trial found a 19 percent slowdown
  for experts on their own repos.
- Developers in that trial predicted a 24 percent speedup and were slowed 19 percent. The
  videos repeat the prediction, not the result.

## Outline

1. **The problem.** Every AI coding video sounds confident. You cannot tell the measured
   claims from the vibes without reading the papers yourself.
2. **The trick: evidence belongs to the claim, not the video.** Extract each video into a
   few mechanism-level claims. Dedupe into one canonical list. Judge the claim once. Every
   source that makes it inherits the verdict, including sources added later. This is the
   design decision that made the project tractable.
3. **Two tiers of verdict.** Every claim gets an AI guess when created, capped at 50
   percent confidence however sure the agent is. A study verdict replaces it only when it
   is at least as confident. Readers see which claims are opinion and which are measured.
4. **The pipeline.** Fetch transcripts, split into groups of about 400k characters, hand
   each group to a parallel Claude Code agent with a written brief
   (`scripts/briefs/extract.md`), merge duplicate claims, record. A second pass hands
   agents the study PDFs plus the claims list (`scripts/briefs/sources.md`). Scripts do
   bookkeeping; the store is never hand-edited.
5. **What held up.** Small verifiable increments, fast feedback loops as the quality
   ceiling, review and understanding as the new bottleneck, upfront written context
   beating prompt tricks. Asserted by 13 to 21 sources each; the studies agree where they
   speak.
6. **What did not.** The commonly-wrong list: 10x productivity, thousands of production
   lines per day, AI eliminating tech debt, CS degrees worthless, one senior equals ten
   engineers.
7. **What is contested or thin.** 235 of 366 claims have only the AI guess. "Vibe-coded
   apps break in production" is half-shown: prototyping evidence is strong, the breakdown
   half is mostly unstudied.
8. **Scoring the sources.** A source's score comes from the verdicts on the claims it
   makes. Novelty rewards being right about something few others say. Short list of top
   and bottom channels.
9. **Honest limits.** One topic so far; GLP-1 just started with one video. Study coverage
   is 14 papers. AI guesses lean neutral by design but are still guesses.
10. **Close.** Link the site and repo. Invite readers to send a topic.

## Numbers

| Fact | Value |
|---|---|
| Active sources | 221 (33 are blog posts) |
| Distinct channels | 163 |
| Canonical claims | 366 |
| Verdict mix | 153 right, 177 partly, 16 wrong, 13 untestable, 7 unknown |
| Claims checked against a study | 131 |
| Claims where a study overrode the AI guess | 51 |
| Study documents | 14 |
| "Pro-hype" claims judged wrong | 8 of 10 |
| Lean tags | 173 neutral, 76 skeptic, 67 pro, 40 calibrating, 10 pro-hype |
| Claims with only an AI guess | 235 |

## Quotable study-backed findings

- **METR 2025 RCT.** 16 experienced developers, 246 tasks, own mature repos. AI tools
  increased completion time by 19 percent. Confidence 0.85, the strongest verdict in the
  corpus.
- **Overestimation.** Forecast 24 percent faster, felt 20 percent faster, measured 19
  percent slower. Experts predicted 38 to 39 percent faster.
- **METR 2026 update.** Returning developers show an 18 percent time reduction, CI minus
  38 to plus 9 percent. METR calls it very weak evidence. "The slowdown was just old
  models" is judged partly, 0.4.
- **Airbnb migration.** Complex files only succeeded once prompts reached 40k to 100k
  tokens with up to 50 related files. Retrying with validation errors fed back fixed most
  simple files within 10 attempts.
- **Google.** AI completion assisted 67 percent of code characters at a 38 percent
  acceptance rate. A completion metric, not autonomous authorship.
- **Debt study, 302k AI commits.** AI commits introduce more issues than they fix across
  all five tools, but only 7.5 to 14.8 percent of commits introduce any issue, and 89
  percent of those are smells that pass review.
- **Amplifies experts, not novices.** Asserted by nine sources, judged wrong at 0.6 by a
  study. Field trials find larger gains for less experienced developers.

## Alternate angles

- **Method-only:** "Evidence belongs to the claim, not the source." Why that rule lets you
  add sources forever without re-judging, and why the AI guess is capped at 0.5.
- **Workflow:** "One brief, eight parallel agents." How the two briefs split 400k-character
  batches across Claude Code agents and merge their duplicate claims.
- **Meta:** "Shipped in a day." The commit log as a narrative.

## Links

- Site: https://jonborchardt.github.io/video-knowledge/
- Repo: https://github.com/jonborchardt/video-knowledge
- Method: README "How verdicts work" and `scripts/briefs/`.
- The watcher library lives in the retire-sim repo. Mention it as the engine; do not
  deep-link unless that branch is public.

## Verify before publishing

- `worthWatching` is true on every source in the current report. Do not quote a
  worth-watching count until that is fixed or explained.
- The bottom line in `ai-coding/site.json` says "20 to 26 percent in field trials".
  Confirm the Microsoft/Accenture and Shan figures before repeating the range.
- GLP-1 has one video and no report. Call it "started", not "published".

## Refreshing the numbers

```
node -e '
const r=require("./ai-coding/report.json");const t=r.topics[0];const c=t.claims;
const lean=require("./ai-coding/lean.json");
const eff={};for(const x of c)eff[x.effective]=(eff[x.effective]||0)+1;
const vids=r.videos.filter(v=>!v.supersededBy);
console.log({sources:vids.length,blogs:vids.filter(v=>v.id.length>11).length,channels:r.channels.length,
claims:c.length,eff,withDocs:c.filter(x=>x.documents&&x.documents.length).length,
studyDecided:c.filter(x=>x.strongest!=="prior").length,
hype:c.filter(x=>lean[x.id]==="pro-hype").length,hypeWrong:c.filter(x=>lean[x.id]==="pro-hype"&&x.effective==="wrong").length,
commonlyWrong:t.commonlyWrong.map(x=>x.text)})'
```
