# Every leap second has been an addition, never a subtraction [meta.headline fp=8d724ef480]

Story `decision:most-discussed-claims` (test-fixture), revision 3. SEO title: Has a leap second ever been taken away? [meta.seoTitle fp=7aa4427c85]. Validation: **passed**, 0 blocking, 4 warnings, 4/4 assertions verified.

> Has a leap second ever been taken away? The IERS record says no. [meta.dek ok fp=68d70ca0f6]

Description: Every leap second so far was an addition, never a subtraction. [meta.description ok fp=7e58120b81]

## Every step in the record added a second [heading:answer fp=c6ef50b86b]

The IERS table records the gap between atomic and civil time, and it has only ever widened. [s01 ok fp=fcaa8ce4f8] All twenty-seven steps added a second. [s02 ok fp=adff0891c2]

Figure decision-most-discussed-claims/sc02: The IERS table's opening value, its latest value, and the single-second steps between them. [decision-most-discussed-claims/sc02 fp=a8d8c149dc]

## Open issues

- **warning** - structure (deterministic): no "hook" section
- **warning** - structure (deterministic): no "setup" section
- **warning** - structure (deterministic): no "investigation" section
- **warning** - structure (deterministic): no "takeaway" section
- **info** meta.dek (meta.dek.a1) overgeneralization (review): The headline ("Every leap second has been an addition, never a subtraction") and the dek ("The IERS record says no") are unbounded: they answer for all time, including now. The cited lines L17-L44 are the table's 28 data rows and stop at 37 seconds on 1 January 2017, so on their own they establish that every one of the 27 steps up to that row added a second, not that nothing has happened since. What closes the gap is elsewhere in the same file: the header says the last line means no leap second was introduced since its date, the file is updated through IERS Bulletin 72 of July 2026 and it was retrieved on 2026-10-31. So the statements are true and this document establishes them, but not from the lines the cite names. Not blocking: the reader comes away believing exactly what the document supports, and the assertion's own wording (1972 to 2017, 27 steps) stays inside the cited rows. The same point applies to meta.description. Suggestion: Widen the cite to test-fixture/sources/iers-leap-second-dat.txt#L1-L44 so the "never since" reading is reproducible from the passage the reader is sent to. The script reviewer raised the same point about s02 of script.json; a single widened cite on the shared assertion fixes both.
- **info** meta.description (meta.description.a1) overgeneralization (review): "Every leap second so far was an addition, never a subtraction" reads to the present day; the cited rows end at 1 January 2017. "So far" is the right hedge and the file's header carries the record to July 2026, so the sentence is true and supported by the document, but the cited lines alone stop short of it. Recorded against this sentence as well as meta.dek because the description is the text a search result shows on its own, without the article's figure. Suggestion: Same fix as the dek: widen the assertion's cite to L1-L44.
- **info** s01 structure (review): The four open deterministic warnings (no hook, setup, investigation or takeaway section) are expected at this story's 15-second micro target, which asks for one paragraph. The article's single "answer" section with two sentences and the figure is the right proportion; adding sections to clear those warnings would pad it past the target. Recorded so the writer does not treat them as work to do. Suggestion: Leave the structure warnings open.
