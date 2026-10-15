# Brief: extract claims from sources

Give an agent this file plus: the topic id, its group number N, and the list file
`<topic>/work/grpN.txt` (tab-separated: source id, transcript path, title). The agent
writes one JSON file and runs nothing else.

Make the inputs first:

```
npm run watcher -- claims list --topic <topic> --store <topic>/store > <topic>/work/claims.txt
npm run watcher -- next --json --store <topic>/store     # "extract" entries → split into grpN.txt files
```

## Inputs

- Your list: `<topic>/work/grpN.txt`. Sources are YouTube transcripts or blog/article
  text (ids that are kebab slugs); treat article text as the transcript.
- Existing canonical claims: `<topic>/work/claims.txt` (`<topic>/<slug> — <text>`). Read it fully first.

## Per source

1. Read the whole transcript or article (use offset/limit for long ones; don't skip the second half).
2. Pick the 4–12 distinct, testable claims a reader would walk away believing. Not every
   sentence. Skip ads and sponsor reads.
3. REUSE an existing slug whenever the meaning matches, even if worded differently. Only
   create a new claim if nothing matches. Use `"s":"d"` when the source argues AGAINST a claim.
4. A new claim's text is one line, mechanism-level, with no numbers that belong to one
   source ("Weight returns after stopping the drug", not "Two-thirds regained within a year").
   Give it an AI guess `"v": [verdict, confidence, note]`:
   - verdict ∈ right | wrong | partly | untestable | unknown. partly = right mechanism,
     wrong dose or scope. untestable = framing, taste or motivation.
   - confidence 0–1 is required for right/wrong/partly; null for untestable/unknown.
   - note: one plain sentence on why, from the best evidence you know. Be calibrated and
     even-handed: lean neither skeptical nor promotional. Self-reported or vendor numbers
     are usually "partly" or "unknown" unless independently measured.
   - `"l"`: which way the claim cuts on the topic's central question IF TRUE (direction, not truth):
     - `pro`: a concrete benefit or capability of the thing the topic is about.
     - `pro-hype`: a favourable claim in sweeping terms (10x, replaces most, does everything).
     - `calibrating`: a benefit is real but smaller, or mismeasured.
     - `skeptic`: harm, risk, cost or a real limit.
     - `neutral`: practice advice, comparisons, framing.
5. Each assertion carries a short verbatim quote (≤25 words) from the text.
6. Write a one-line `sum` per source (no personal data).

## Output

Write `<topic>/work/hN.json`:

```json
[{"video":"<id>","sum":"...","as":[
  {"c":"<existing slug without the topic/ prefix>","q":"quote"},
  {"c":"<slug>","s":"d","q":"quote"},
  {"n":"New canonical claim text","q":"quote","v":["partly",0.5,"reason"],"l":"skeptic"},
  {"n2":"Exact text of a claim you created with n in an earlier source","q":"quote"}
]}]
```

- Every `c` slug must exist in claims.txt exactly (copy it; don't guess).
- Don't use the same claim twice in one source.
- If two of your sources make the same NEW claim, create it once with `n`, then use `n2`
  with the identical text.
- Valid JSON, written with the Write tool. Check it with a quick script before finishing.
- Final reply: counts (sources, assertions, new claims) and any source you skipped and why.
