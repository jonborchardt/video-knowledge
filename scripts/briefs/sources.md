# Brief: judge claims against study documents

Give an agent this file plus: the topic id, a group name G, which documents in
`<topic>/sources/` to read, and which claims list to judge (all claims:
`<topic>/work/claims.txt`; only new ones: a smaller file you make). The agent writes one
JSON file and runs nothing else.

Convert documents to text first: `pdftotext -layout paper.pdf paper.txt`. Line numbers in
citations refer to the `.txt`, counted by LF. Strip any bare carriage return (a table copied from a web page
often has one between cells): the passage reader treats it as a line break, and a test fails on it.

## Method

1. Read each document properly: abstract, results, discussion, limitations. Read big files
   in chunks. Note what was actually measured, on whom, and the caveats.
2. Go through EVERY claim on your list and ask: does a specific passage bear directly on
   this claim? Grep the `.txt` for key terms, then read the surrounding lines.
3. Record a verdict ONLY where a passage really bears on the claim as stated. Most claims
   get nothing from a given document, which is fine. A loosely related passage doesn't count.
4. For each one:
   - verdict ∈ right | wrong | partly | untestable | unknown. partly = right mechanism,
     wrong dose or scope, or supported only in a narrower setting. A narrow study limits a
     general claim ("partly"); it doesn't refute it. But a base rate that contradicts the
     claim's promise does: if the claim says anyone or most can do X and the data show most
     who try don't, that is "wrong". unknown = the source explicitly can't tell.
   - confidence 0–1 (null for unknown/untestable): how strongly THIS source settles the claim,
     given design, sample and caveats. An RCT on the exact question: 0.7–0.85. A company
     self-report, case study or count-the-mentions review: 0.2–0.5. Confidence decides
     whether a study overrides the AI guess, which counts for at most 0.5.
   - note: one plain sentence with the passage's gist and how it bears on the claim (numbers welcome).
   - source: `"<topic>/sources/<file>.txt#L<start>-L<end>"`, the tightest range holding the
     passage. Re-read those lines to check them.
5. Be even-handed: report what the source shows, whether it helps or hurts the claim.

## Output

Write `<topic>/work/sv_G.json`:

```json
[
  {
    "claim": "<topic>/<slug>",
    "verdict": "partly",
    "confidence": 0.6,
    "note": "...",
    "source": "<topic>/sources/<file>.txt#L10-L24"
  }
]
```

- Every claim id must exist in the claims list exactly. Valid JSON, written with the Write tool.
- Final reply: count per document, plus the 3 verdicts that most change the picture.
