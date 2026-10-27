# Storyboard: Is AI-Written Code Harder to Maintain?

31 scenes, 6:20 at 150 wpm including pauses. Script cfd7e3449b (passed). Storyboard status: **ok**.

## Issues

- **warning** - release-stale: release.json locked script 577b3309e7; it is now cfd7e3449b: the approved package has changed, lock it again after review
- **warning** - release-stale: release.json locked package 38da9c6bef; it is now 09874f191a: the approved package has changed, lock it again after review
- **warning** - release-stale: release.json locked validation 640bb773de; it is now ebf617d5ac: the approved package has changed, lock it again after review
- **warning** - release-stale: release.json locked storyboard 1b019b912d; it is now 8b8372dc42: the approved package has changed, lock it again after review

## 1. sc01 (0:00 to 0:08, 8.1s incl. 0.5s pause)

**Purpose.** Pose the question the video answers.

**Narration** (s01). If an AI writes the code today, who pays for it when somebody has to change it next year?

**Visual** (typography). Dark field; the question types on in large type, 'next year' held a beat in accent colour.

**On screen.** "Who pays for it when somebody has to change it?"

**Direction.** Cold open; type on with the narration, hold 0.5 s.

## 2. sc02 (0:08 to 0:16, 8s)

**Purpose.** Introduce the one trial that tested the question directly.

**Narration** (s02). One research team stopped guessing and ran a randomised trial: code written with or without AI, then changed by hand.

**Visual** (typography). Title card: the trial's design in one line, 'changed by hand' landing last.

**On screen.** "Written with or without AI, then changed by hand"

**On-screen citations.** Echoes of AI, randomised controlled trial (Echoes of AI maintainability RCT, lines 2519-L2524)

**Direction.** Line lands on 'changed by hand'.

## 3. sc03 (0:16 to 0:29, 12.4s)

**Purpose.** Show the worry in the research's own words.

**Narration** (s03). The worry has a familiar shape: one study collected in a review of the research warns that code built up through conversation often "lacks cohesive structure", which makes later maintenance harder.

**Visual** (document-excerpt). The review's paragraph on maintainability; 'lacks cohesive structure' highlights as it is spoken.

**Excerpt** from Vibe-coding literature review, lines 1434-L1452, highlighting "lacks cohesive structure":

>     Google Cloud's practitioner guide distinguishes two                  plementations. Maintainability implications appear in 23%
> modes: " `pure' vibe coding," in which "a user might fully               (11) of the sources. One study notes that "code generated
> trust the AI's output to work as intended," and "responsi-               through conversational flows often lacks cohesive structure,
> ble AI-assisted development," in which "AI tools act as a                consistent patterns, and proper documentation, greatly com-
> powerful accelerator, with the developer maintaining over-               plicating future maintenance" [WL27].
> sight" [GL11].
>                                                                              Similarly, a grey-literature source cautions that the "costs
>     Grey sources such as [GL1] and [GL10] describe expe-                 of this transformation are rarely visible in the short term--
> rienced developers using vibe coding to accelerate routine               but they accrue in the long-term debt of unmaintainable sys-
> development tasks while retaining control over design deci-              tems, fragile architectures, and undocumented logic" [GL9].
> sions and validation processes.
>                                                                              These studies often link maintainability challenges to
>     Across evidence streams, grey sources more frequently                shallow understanding of generated code, incremental patch-
> describe vibe coding as a technology that lowers barriers to             ing practices, and limited documentation of design intent.
> software creation, often emphasizing accessibility for novice            For example, [WL5] and [WL15] discuss how rapid AI-
> users. Peer-reviewed studies, by contrast, more frequently               assisted iteration can introduce structural complexity that
> analyze differences between novice and expert developer                  complicates later maintenance, while [GL10] notes that
> behavior, particularly with respect to verification practices            developers sometimes accept generated code without fully
> and interaction strategies.                                              understanding its long-term implications.

**On-screen citations.** Vibe-coding literature review, quoting [WL27] (Vibe-coding literature review, lines 1434-L1452)

**Direction.** Slow push toward the highlight.

## 4. sc04 (0:29 to 0:39, 10.9s incl. 0.5s pause)

**Purpose.** The loudest security warning, in the speaker's own words.

**Narration** (s04). And on security, the Razorwire Cybersecurity channel put it bluntly: "46% of AI generated code is reportedly uh contain some form of security weakness".

**Visual** (typography). Quote card, quoted words only; '46%' punches in.

**On screen.** ""46% of AI generated code is reportedly uh contain some form of security weakness""

**On-screen citations.** Razorwire Cybersecurity

**Direction.** Camera punches on '46%'.

## 5. sc05 (0:39 to 0:46, 6.8s)

**Purpose.** Turn to the trial's result.

**Narration** (s05). So what happened in that trial when people had to change code an AI had helped write?

**Visual** (typography). The question types on.

**On screen.** "So what happened in that trial?"

**Direction.** Type on with the narration.

## 6. sc06 (0:46 to 0:52, 5.6s)

**Purpose.** Speed result: consistent with no effect.

**Narration** (s06). On speed, nothing reliable: their completion times were consistent with no effect at all.

**Visual** (document-excerpt). The trial's RQ1 answer; 'consistent with a null effect' highlights.

**Excerpt** from Echoes of AI maintainability RCT, lines 2519-L2524, highlighting "consistent with a null effect":

>     RQ1: Is AI-assisted code more efficient to evolve manually?
> 
>     Our RCT provides no reliable evidence that AI-assisted code differs in manual
>     evolution efficiency. Both completion times and perceived productivity in Task 2
>     were consistent with a null effect, with at most small and highly uncertain
>     differences between treatment and control.

**On-screen citations.** Echoes of AI trial, RQ1: evolution efficiency (Echoes of AI maintainability RCT, lines 2519-L2524)

**Direction.** Highlight sweeps on 'no effect at all'.

## 7. sc07 (0:52 to 1:03, 11.3s incl. 0.5s pause)

**Purpose.** The authors' caveat: absence of evidence is not proof of absence.

**Narration** (s07). The authors are careful about what that means: any difference was at most small, and highly uncertain, which is not the same as proof there is none.

**Visual** (typography). Title card; 'highly uncertain' held in accent colour.

**On screen.** "At most small, and highly uncertain"

**On-screen citations.** Echoes of AI trial, RQ1 (Echoes of AI maintainability RCT, lines 2519-L2524)

**Direction.** Hold 0.5 s after the last word.

## 8. sc08 (1:03 to 1:11, 8s)

**Purpose.** Quality result: no reliable difference in code health; coverage identical.

**Narration** (s08). On quality, the code's health score after the changes showed no reliable difference either, and test coverage was essentially identical.

**Visual** (document-excerpt). The trial's RQ2 answer; 'no reliable frequentist evidence' highlights.

**Excerpt** from Echoes of AI maintainability RCT, lines 2581-L2587, highlighting "no reliable frequentist evidence":

>     RQ2: Does prior AI use improve quality after manual evolution?
> 
>     Our RCT provides no reliable frequentist evidence that prior AI-assisted devel-
>     opment affects CodeHealth after continued manual evolution. Bayesian analysis
>     suggests a small CodeHealth improvement when the original Task 1 solution
>     was co-developed with AI by a habitual AI user. Test coverage was essentially
>     identical between groups.

**On-screen citations.** Echoes of AI trial, RQ2: CodeHealth and coverage (Echoes of AI maintainability RCT, lines 2581-L2587)

**Direction.** Highlight on 'no reliable difference'.

## 9. sc09 (1:11 to 1:22, 10.4s)

**Purpose.** The Bayesian hint, if anything, pointed the other way.

**Narration** (s09). A second, Bayesian analysis even hinted at a small gain in code health when the original was written with AI by someone who uses it habitually.

**Visual** (document-excerpt). Same passage, now 'small CodeHealth improvement' highlights.

**Excerpt** from Echoes of AI maintainability RCT, lines 2581-L2587, highlighting "small CodeHealth improvement":

>     RQ2: Does prior AI use improve quality after manual evolution?
> 
>     Our RCT provides no reliable frequentist evidence that prior AI-assisted devel-
>     opment affects CodeHealth after continued manual evolution. Bayesian analysis
>     suggests a small CodeHealth improvement when the original Task 1 solution
>     was co-developed with AI by a habitual AI user. Test coverage was essentially
>     identical between groups.

**On-screen citations.** Echoes of AI trial, Bayesian analysis (Echoes of AI maintainability RCT, lines 2581-L2587)

**Direction.** Highlight moves down the same passage.

## 10. sc10 (1:22 to 1:32, 10.2s incl. 1s pause)

**Purpose.** A plain-spoken summary of the trial.

**Narration** (s10). Dave Farley, talking about the study, summed it up: "The AI didn't make it any better and it didn't make it any worse."

**Visual** (typography). Quote card, quoted words only; 'better' and 'worse' balance either side.

**On screen.** ""The AI didn't make it any better and it didn't make it any worse.""

**On-screen citations.** Dave Farley, on the Echoes of AI study

**Direction.** Hold 1 s after the last word.

## 11. sc11 (1:32 to 1:35, 3.6s)

**Purpose.** Turn to where the fear comes from.

**Narration** (s11). So where does the debt fear get its evidence?

**Visual** (typography). The question types on.

**On screen.** "So where does the debt fear get its evidence?"

**Direction.** Type on with the narration.

## 12. sc12 (1:35 to 1:53, 17.6s)

**Purpose.** The survey evidence and what kind of evidence it is.

**Narration** (s12, s13). Partly from surveys: one study measured maintainability and technical debt through its respondents' answers to questionnaire scales, and AI use went with lower maintainability and more debt. That is an association in people's answers, not a timed test of someone else changing the code.

**Visual** (typography). Two lines build one per sentence: what was measured, then what it is.

**On screen.** "Questionnaire answers" / "An association, not a timed test"

**On-screen citations.** Shan et al., survey of developers (Shan et al. field study + RCT, lines 1219-L1229)

**Direction.** Line one on 'surveys', line two on 'association'.

## 13. sc13 (1:53 to 2:08, 15.2s)

**Purpose.** The review's count of the concern, and why a count is not a measurement.

**Narration** (s14, s15). The review of the research counted the worry too: maintainability concerns came up in 11 of its sources, 23 percent. That counts how often the concern is raised, which is not the same as measuring it.

**Visual** (data-chart). Two tiles: sources raising maintainability, and their share.

**Chart** (stat-tiles: Sources raising maintainability concerns).

| Label | Display | Value | Unit | Source |
|---|---|---|---|---|
| Sources | 11 | 11 | count | Vibe-coding literature review, lines 1434-L1452 |
| Share of the review's sources | 23% | 23 | percent | Vibe-coding literature review, lines 1434-L1452 |

Note: Counts how often the concern is raised, not a measurement of maintainability.

**On-screen citations.** Vibe-coding literature review (Vibe-coding literature review, lines 1434-L1452)

**Direction.** Tiles count up on '11' and '23 percent'.

## 14. sc14 (2:08 to 2:21, 12.8s)

**Purpose.** Introduce the commit study.

**Narration** (s16). Then there is code out in the wild: a study that tracked commits made with AI coding assistants found that some of the issues they introduced still survive in the latest code.

**Visual** (typography). Title card; 'still survive' held in accent colour.

**On screen.** "Some issues still survive in the latest code"

**On-screen citations.** Study of AI co-authored commits (Debt study (302k AI commits), lines 918-L933)

**Direction.** Line lands on 'still survive'.

## 15. sc15 (2:21 to 2:32, 11.2s)

**Purpose.** The commit study's net result: smells even, correctness and security worse.

**Narration** (s17). The assistants fixed about as many code smells, surface problems like naming and formatting, as they introduced; but they introduced more correctness and security issues than they fixed.

**Visual** (document-excerpt). The study's discussion paragraph; 'introduce more correctness and security issues than they fix' highlights.

**Excerpt** from Debt study (302k AI commits), lines 918-L933, highlighting "introduce more correctness and security issues than they fix":

> findings suggest that although AI coding assistants introduce technical debt, they also fix existing
> issues in the codebase. First, we observe that AI co-authored commits actually fix a similar number
> of code smell issues as they introduce. This suggests that AI coding assistants are able to perform
> local cleanup and repetitive maintenance tasks effectively. They can recognize and address surface-
> level code quality problems (e.g., formatting, naming, or simple refactoring opportunities). However,
> what is concerning is that AI coding assistants seem to be less effective at fixing correctness and
> security issues, and they even introduce more of these than they fix. Section 5.3 shows that many
> AI-introduced issues still survive at HEAD, while the net-impact analysis shows that AI commits
> introduce more correctness and security issues than they fix. This inconsistency suggests that
> AI coding assistants may struggle with changes that require a deeper understanding of program
> behavior, execution context, or security implications. Also, the practical impact of correctness and
> security issues is often more severe than that of code smells, making it more critical to address
> them effectively. Developers should not treat all AI-generated code as equally trustworthy, and they
> should pay particular attention to changes that may introduce correctness or security vulnerabilities.
> 
>    Technical debt cannot be solved by switching between AI coding tools. Our cross-tool

**On-screen citations.** Study of AI co-authored commits, net impact (Debt study (302k AI commits), lines 918-L933)

**Direction.** Highlight on 'but they introduced more'.

## 16. sc16 (2:32 to 2:44, 11.7s incl. 0.5s pause)

**Purpose.** The commit study's missing comparison.

**Narration** (s18). But the authors did not compare those commits with code written by people alone, so the study cannot say AI code leaves more debt than human code does.

**Visual** (document-excerpt). The study's limitations paragraph; the no-baseline sentence highlights.

**Excerpt** from Debt study (302k AI commits), lines 1031-L1035, highlighting "We also do not compare AI-authored commits against a baseline of purely human-written commits.":

> We also do not compare AI-authored commits against a baseline of purely human-written commits.
> Because developers may use AI without leaving any Git trace, and even AI-labeled commits may
> mix human edits, a reliable human-only baseline is difficult to construct, and comparing against
> an unreliable baseline could bias the results. We therefore focus on tracking technical debt inside
> explicitly confirmed AI-authored or co-authored commits.

**On-screen citations.** Study of AI co-authored commits, limitations (Debt study (302k AI commits), lines 1031-L1035)

**Direction.** Highlight sweeps on 'did not compare'.

## 17. sc17 (2:44 to 2:55, 11.2s)

**Purpose.** The one snippet-level security rate.

**Narration** (s30). And the security worry? One study did put a number on it: of 733 code snippets generated by AI, 27.3 percent contained security weaknesses.

**Visual** (data-chart). Two tiles: snippets checked, share with weaknesses.

**Chart** (stat-tiles: AI-generated code snippets checked for security weaknesses).

| Label | Display | Value | Unit | Source |
|---|---|---|---|---|
| Snippets | 733 | 733 | count | 2310.02059.txt, lines 930-L936 |
| Contained security weaknesses | 27.3% | 27.3 | percent | 2310.02059.txt, lines 930-L936 |

Note: AI code alone; no hand-written code checked for comparison.

**On-screen citations.** Study of 733 AI-generated snippets (2310.02059.txt, lines 930-L936)

**Direction.** Tiles count up on '733' and '27.3 percent'.

## 18. sc29 (2:55 to 3:10, 14.8s)

**Purpose.** The newer, hand-confirmed audit of deployed AI-built apps.

**Narration** (s34). A newer audit went further: researchers sampled deployed web apps built at least 90 percent by AI agents, confirmed each finding by hand, and found at least one vulnerability in over 90 percent of them.

**Visual** (data-chart). One tile in the data colour: over 90% of the sampled deployed apps had at least one vulnerability; beneath it, small, the sample: apps built at least 90 percent by AI agents, each finding confirmed by hand.

**Chart** (stat-tiles: Deployed apps built mostly by AI agents).

| Label | Display | Value | Unit | Source |
|---|---|---|---|---|
| Had at least one vulnerability | Over 90% | gt 90 | percent | Vibe-coded apps security audit (200 deployed), lines 457-L464 |

Note: AI-built apps alone; no hand-written apps audited the same way.

**On-screen citations.** Audit of deployed vibe-coded web apps, 2026 (Vibe-coded apps security audit (200 deployed), lines 457-L464)

**Direction.** Tile counts up on 'over 90 percent'.

## 19. sc30 (3:10 to 3:40, 30s)

**Purpose.** Why counts of AI code alone fall short, and the one study that compared with human code.

**Narration** (s31, s35). Both are counts of weaknesses in AI code alone; neither can tell you whether code written by hand would score any better on the same check. One study that did compare, in open-source repositories, found code written by AI agents introduced security findings at 1.14 times the rate of human code, line for line, and the most severe ones at 1.51 times, all flagged by an automated scanner rather than confirmed.

**Visual** (typography). List built one line per sentence: first the gap (no human baseline), then the comparison: two lines, security findings at 1.14 times and the most severe at 1.51 times the human rate, the second in the loss colour; a small caveat line that the findings were flagged by an automated scanner.

**On screen.** "No human code checked the same way" / "Security findings: 1.14 times the human rate" / "Most severe: 1.51 times" / "Flagged by an automated scanner, not confirmed"

**On-screen citations.** Agentic vs human code in open-source repositories, 2026 (Post-merge fate study (182 repos), lines 469-L477)

**Direction.** Lines appear as spoken; the 1.51 line lands with a punch-in.

## 20. sc18 (3:40 to 3:51, 11.2s)

**Purpose.** The review's tally of security as the top challenge.

**Narration** (s19). The review of the research found security risk was the challenge its sources raised most, in 10 of them, half of those it tallied for that question.

**Visual** (data-chart). Two tiles: sources raising security risk, and their share.

**Chart** (stat-tiles: Most-raised open challenge: security risk).

| Label | Display | Value | Unit | Source |
|---|---|---|---|---|
| Sources | 10 | 10 | count | Vibe-coding literature review, lines 1793-L1803 |
| Share of those tallied | 50% | 50 | percent | Vibe-coding literature review, lines 1793-L1803 |

Note: A count of sources raising the concern, not a rate of weaknesses.

**On-screen citations.** Vibe-coding literature review, open challenges (Vibe-coding literature review, lines 1793-L1803)

**Direction.** Tiles count up on '10' and 'half'.

## 21. sc19 (3:51 to 4:01, 9.7s incl. 0.5s pause)

**Purpose.** What the sources actually agree on.

**Narration** (s20). What those sources agree on is narrower than a rate: generated code may contain weaknesses when developers rely on it without rigorous checking.

**Visual** (document-excerpt). The review's paragraph; 'generated code may contain weaknesses' highlights.

**Excerpt** from Vibe-coding literature review, lines 1793-L1803, highlighting "generated code may contain weaknesses":

> research questions where the topic first appears. The most     garding when developers should trust AI-generated outputs
> frequently discussed challenge concerns security risks as-     and how appropriate reliance can be achieved in practice. For
> sociated with AI-generated code, appearing in 50% (10)         example, [WL6] discusses the difficulty of calibrating trust
> of the sources shown in Table 28. These risks include the      in systems that can produce both high-quality and erroneous
> introduction of unsafe code, vulnerabilities, and potential    outputs within the same workflow. This question connects to
> misuse of generated artifacts. Peer-reviewed and practitioner  the shift in the developer role discussed in RQ3 (3.4).
> sources agree that generated code may contain weaknesses
> when developers rely on automated generation without rig-          Beyond explicitly reported challenges, certain areas ap-
> orous verification ([WL6], [WL21], [GL12], [GL15]). This       pear underrepresented in extractable evidence. In particu-
> challenge builds on the risks and safeguards reported in RQ5   lar, session-level interaction dynamics (RQ3.2) and repro-
> (3.6).                                                         ducibility concerns (RQ4) appear only in a small number

**On-screen citations.** Vibe-coding literature review (Vibe-coding literature review, lines 1793-L1803)

**Direction.** Highlight on 'may contain weaknesses'.

## 22. sc20 (4:01 to 4:09, 8.1s incl. 0.5s pause)

**Purpose.** Pivot to the cost that was measured.

**Narration** (s21). There is one cost, though, that experiments did measure, and it lands on the person who wrote the code.

**Visual** (typography). Title card; 'the person who wrote the code' lands last.

**On screen.** "One cost experiments did measure"

**Direction.** Hard cut in; hold 0.5 s.

## 23. sc21 (4:09 to 4:23, 14s)

**Purpose.** Set up the quiz trial.

**Narration** (s32). In one trial, crowd workers recruited online, most of them freelance or professional software developers, did a coding task with or without AI, then took a quiz on the skills the task should have built.

**Visual** (typography). Title card naming the design.

**On screen.** "A coding task with or without AI, then a quiz"

**On-screen citations.** Skill-formation trial, crowd-worker developers (2601.20245v2.txt, lines 468-L484)

**Direction.** Line lands on 'quiz'.

## 24. sc22 (4:23 to 4:32, 9.6s)

**Purpose.** The quiz result.

**Narration** (s33). Using AI did not make them significantly faster, and their scores came out lower by a gap worth 17 percent of the quiz.

**Visual** (data-chart). One big tile: the score gap.

**Chart** (stat-tiles: Quiz score gap with AI).

| Label | Display | Value | Unit | Source |
|---|---|---|---|---|
| Lower score, share of the quiz | 17% | 17 | percent | 2601.20245v2.txt, lines 468-L484 |

Note: Completion time was not significantly faster with AI.

**On-screen citations.** Skill-formation trial, quiz results (2601.20245v2.txt, lines 468-L484)

**Direction.** Tile counts up on '17 percent'.

## 25. sc23 (4:32 to 4:54, 21.4s incl. 1s pause)

**Purpose.** The code-ownership experiment and its robustness.

**Narration** (s22, s23). In a separate experiment with different participants, working with AI cut their chance of answering questions about their own code correctly by 5.95 percentage points. The authors re-checked it other ways: each time the drop kept its direction, though in one it was too weak to be sure of.

**Visual** (data-chart). One big tile: the drop in the chance of answering correctly.

**Chart** (stat-tiles: Answering questions about their own code correctly, with AI).

| Label | Display | Value | Unit | Source |
|---|---|---|---|---|
| Drop, percentage points | 5.95 | 5.95 | percent | Code-ownership experiment (Martin-Lopez), lines 700-L721 |

Note: Percentage points, not percent; direction held in every re-check.

**On-screen citations.** Code-ownership experiment (Code-ownership experiment (Martin-Lopez), lines 700-L721)

**Direction.** Tile counts up on '5.95'; holds through the re-check sentence.

## 26. sc24 (4:54 to 5:11, 16.9s incl. 0.5s pause)

**Purpose.** The answer.

**Narration** (s24). So, is AI-written code harder to maintain? In the one trial that tested it, over the time it ran, no: no reliable difference in speed or code health, though one trial with that much uncertainty cannot rule out a small one.

**Visual** (typography). Title card; 'no reliable difference' held in accent colour.

**On screen.** "In the one trial that tested it: no reliable difference"

**On-screen citations.** Echoes of AI trial (Echoes of AI maintainability RCT, lines 2519-L2524)

**Direction.** Line lands on 'no'; hold 0.5 s.

## 27. sc25 (5:11 to 5:19, 8s)

**Purpose.** What the louder warnings rest on.

**Narration** (s25). The louder maintenance warnings rest on questionnaires, counts of concern and issue tallies with nothing human to compare them to.

**Visual** (typography). Title card listing the kinds of evidence behind the warnings.

**On screen.** "Maintenance: questionnaires, counts of concern, issue tallies"

**Direction.** Words appear as spoken.

## 28. sc31 (5:19 to 5:34, 15s incl. 1s pause)

**Purpose.** Security is where the worry holds up.

**Narration** (s36). Security is where the worry holds up: most of the AI-built apps that audit sampled had at least one vulnerability, and against human code the rate was higher, more so for the most severe findings.

**Visual** (typography). Title card: the line types on, 'holds up' turns to the accent as spoken.

**On screen.** "Security: the worry holds up"

**On-screen citations.** Audit of deployed vibe-coded web apps; agentic vs human code, 2026 (Post-merge fate study (182 repos), lines 469-L477)

**Direction.** Hard cut in; hold 1 s.

## 29. sc26 (5:34 to 5:54, 19.8s incl. 1s pause)

**Purpose.** The cost that was measured, and its open question.

**Narration** (s26). The cost that was measured is different: in both of those experiments, people working with AI learned less or understood their own code less well, and whether that makes it harder for those same people to change their code later is something none of these studies tested.

**Visual** (typography). Title card; 'understood their own code less well' held in accent colour.

**On screen.** "Learned less, understood their own code less well"

**On-screen citations.** Skill-formation trial (2601.20245v2.txt, lines 468-L484); Code-ownership experiment (Code-ownership experiment (Martin-Lopez), lines 700-L721)

**Direction.** Hold 1 s after the last word.

## 30. sc27 (5:54 to 6:05, 11.2s)

**Purpose.** A practitioner's rule for the gap.

**Narration** (s27). Simon Willison draws his line here: "I don't think you should ever commit a line of code that a language model wrote If you don't understand it yourself".

**Visual** (typography). Quote card, quoted words only; 'understand it yourself' lands last.

**On screen.** ""I don't think you should ever commit a line of code that a language model wrote If you don't understand it yourself""

**On-screen citations.** Simon Willison

**Direction.** Camera pushes in on 'understand it yourself'.

## 31. sc28 (6:05 to 6:20, 15.4s incl. 1s pause)

**Purpose.** The takeaway for reviewers.

**Narration** (s28, s29). So when you review AI-assisted code, yours or a colleague's, don't stop at whether it works: ask the author to walk you through it with the AI closed. If they can't, the code isn't finished yet.

**Visual** (typography). Two lines build one per sentence.

**On screen.** "Walk me through it with the AI closed" / "If they can't, the code isn't finished yet"

**Direction.** Line two lands on 'isn't finished'; hold 1 s to end.
