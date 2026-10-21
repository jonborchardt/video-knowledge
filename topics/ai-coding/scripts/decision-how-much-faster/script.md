# How Much Faster Does AI Actually Make Programmers?

Story `decision:how-much-faster` (ai-coding), revision 2. About 5.9 minutes (852 words at 150 wpm). Validation: **passed**, 0 blocking, 0 warnings, 28/28 assertions verified.

Markers: `[s12 ok]` every assertion verified by the deterministic checks and the reviewer; `[s12 review]` awaiting review or carrying a warning; `[s12 BLOCKED]` an open blocking issue. Sentences without a marker make no factual claim.

## Hook

How much faster does AI actually make the people who write code? Ask around and the answers point in opposite directions, from enormous multiples to slower than before. So set the loudest answers aside, look at the studies that measured programmers at work, and ask what each one actually measured.

## How much faster does AI make programmers?

On the Lex Fridman Podcast, DHH described "that magical 10X, 100X, in a few rare cases, 1000X productivity boost", and said that to get it you have to work with the AI agents directly. [s04 ok] From the other side, a run of videos and posts repeats one trial's result, in the words of the channel Macro Lens: when experienced developers were allowed AI tools, "they were 19% slower than when they weren't". [s05 ok] Start with ordinary workplaces. One set of field experiments followed almost five thousand software developers at three companies, in their regular jobs and partly over years, and estimated that an AI code suggestion tool raised their productivity, measured by their output, by about 26 percent. [s07 ok] The authors note that this is substantially smaller than an earlier lab result, and suggest why: some kinds of coding are less readily helped by the tool, and coding is only part of a developer's job. [s08 ok] A separate trial estimated a roughly 21 percent increase in development speed attributable to AI, but that estimate missed the usual bar for statistical significance, so it is less certain than it sounds. [s09 ok] Then there is the trial behind those slowdown claims. METR ran a randomized controlled trial with 16 experienced open-source developers on 246 tasks in mature projects they had worked on for an average of 5 years, randomly allowing or disallowing AI tools task by task. [s11 ok] The tools were the February to June 2025 frontier: mostly the Cursor Pro editor with Claude 3.5 and 3.7 Sonnet. [s12 ok] With AI allowed, tasks took 19 percent longer to complete. [s13 ok] The researchers' hypothesis for why AI helped less than in earlier trials: their projects averaged about 10 years old and more than 1,100,000 lines of code, compared with the more greenfield projects in those trials. [s14 ok] But would newer tools change that? METR's own 2026 update says that, from talking to participants, it believes developers are likely more sped up in early 2026 than in early 2025. [s16 ok] Its new raw numbers lean the same way: tasks took an estimated 18 percent less time for returning developers and 4 percent less for new recruits, but both ranges still stretch to a slowdown. [s17 ok] And METR calls this only very weak evidence: more developers now decline to take part because they don't want to work without AI, which likely pushes its speedup estimate down, so the ones left are not a fair sample. [s18 ok] And the multiples from the start? The largest figures so far come from Anthropic's own report on its staff: employees self-reported that they now get a 50 percent productivity gain from Claude on average, and merged pull requests per engineer per day rose 67 percent when its engineering org adopted Claude Code. [s20 ok] A count of merged changes is not the same as time saved, but even taken at face value, both figures are an order of magnitude below ten times. [s21 ok] So, how much faster? In the workplace studies, with the tools they tested, the measured gains were modest, nowhere near the multiples in the hype. [s22 ok] For experienced developers in big, mature projects they knew well, early-2025 tools made them slower, and whether today's tools have reversed that, METR's own newer data is too weak to say. [s23 ok] But that slowdown trial holds a stranger detail, and it is about what the developers believed was happening.

## Can developers tell whether AI is speeding them up?

Take a second and make your own guess: how much time does AI save you? Before starting, the METR developers forecast that allowing AI would cut their completion time by 24 percent. [s26 ok] After the study, with the work behind them, they estimated it had cut their time by 20 percent, in the same trial that measured them taking longer. [s27 ok] Outside experts did no better: economists predicted 39 percent shorter completion times, and machine learning experts 38 percent. [s28 ok] So people overestimate the gain? Not always. In an earlier randomized trial of Copilot, a lab task on a greenfield-style project, the measured productivity gain was 55.8 percent, yet participants in both the AI and the control group estimated 35 percent on average: they underestimated it. [s30 ok] So the same kind of guess missed in opposite directions: too high for experienced developers in big projects they knew well, too low on a fresh task in the lab. [s31 ok] METR's later update adds that some developers now self-report very high speedups, and repeats that, as its earlier study found, such estimates can be quite unreliable. [s32 ok] So can developers tell? In both of these trials, not reliably: their guesses missed by a wide margin. [s33 ok]

## Close

Every number in this video belongs to particular people, doing particular work, with particular tools. So when someone tells you how much faster AI makes them, ask what they measured, and if you want to know for yourself, time comparable tasks with the tool and without it rather than trusting the feeling.

## Open issues

- **info** s04 (s04.a) wording (deterministic): Wording differs from the canonical claim; the reviewer confirms the passages entail it.
- **info** s05 (s05.a) wording (deterministic): Wording differs from the canonical claim; the reviewer confirms the passages entail it.
- **info** s05 (s05.b) wording (deterministic): Wording differs from the canonical claim; the reviewer confirms the passages entail it.
- **info** s11 (s11.a) wording (deterministic): Wording differs from the canonical claim; the reviewer confirms the passages entail it.
- **info** s12 (s12.a) wording (deterministic): Wording differs from the canonical claim; the reviewer confirms the passages entail it.
- **info** s13 (s13.a) wording (deterministic): Wording differs from the canonical claim; the reviewer confirms the passages entail it.
- **info** s18 (s18.b) wording (deterministic): Wording differs from the canonical claim; the reviewer confirms the passages entail it.
- **info** s23 (s23.a) wording (deterministic): Wording differs from the canonical claim; the reviewer confirms the passages entail it.

## Evidence by sentence

### s04 (attributed, verified)

> On the Lex Fridman Podcast, DHH described "that magical 10X, 100X, in a few rare cases, 1000X productivity boost", and said that to get it you have to work with the AI agents directly.

- **s04.a** [verified] DHH, on the Lex Fridman Podcast, said that getting a 10X, 100X or in rare cases 1000X productivity boost requires interacting with the agents directly.
  - supported (approved): no direct support, 1 contradicting, 1 qualifying, 1 source statement.
  - info wording: Wording differs from the canonical claim; the reviewer confirms the passages entail it.
  - qualifies (uncited): Anthropic internal study wrong 0.4, partial `ai-coding/sources/anthropic-work-at-anthropic.txt#L35-L35`
    > Anthropic: users self-report an average +50% gain at 59% usage, plus about 67% more merged PRs per engineer after Claude Code adoption, an order of magnitude below 10x.
  - contradicts (uncited): Shan et al. field study + RCT wrong 0.3, direct `ai-coding/sources/4859137.txt#L489-L493`
    > The field gain from AI assistants was about 18% more user stories (24-31% under alternative estimators), far from 10x. The tools were 2023-24 assistants, not agentic coding.
  - statement: DHH: Future of Programming, AI, Agentic Engineering, Vibe Coding & Linux | Lex Fridman Podcast #501  `NYFGCESmikA`
    > to get that magical 10X, 100X, in a few rare cases, 1000X productivity boost, you have to interact with the agents directly
  - quotation: "that magical 10X, 100X, in a few rare cases, 1000X productivity boost" from `NYFGCESmikA`

### s05 (attributed, verified)

> From the other side, a run of videos and posts repeats one trial's result, in the words of the channel Macro Lens: when experienced developers were allowed AI tools, "they were 19% slower than when they weren't".

- **s05.a** [verified] Several videos and posts report that experienced developers were 19% slower with AI tools.
  - supported (approved): no direct support, 5 source statements.
  - info wording: Wording differs from the canonical claim; the reviewer confirms the passages entail it.
  - statement: Jensen Huang Said "Stop Learning to Code" — Then Hired 10,000 Developers  `9wF0n48k6JU`
    > experienced developers using AI actually worked 19% slower
  - statement: AI Replacing Developers Has Officially Failed  `Zdus-d4ehN0`
    > Seasoned engineers were actually 19% slower when using AI tools
  - statement: Are Junior Developers Really Getting Replaced by AI? I'm not sold...  `rdcjMm11TUU`
    > those developers got 19% slower, not faster
  - statement: Is AI making devs SLOWER? Yes, according to this study...  `j-ZEhEiHzjg`
    > experienced coders finish their work 19% slower
  - statement: METR's AI productivity study is really good  `seangoedecke-impact-of-ai-study`
    > But in fact they were 19% slower overall
- **s05.b** [verified] The channel Macro Lens said that when the developers were allowed AI tools they were 19% slower than when they weren't.
  - supported (approved): no direct support, 1 source statement.
  - info wording: Wording differs from the canonical claim; the reviewer confirms the passages entail it.
  - statement: The METR Paradox. Why AI Made Senior Devs 19% Slower  `haWve-6WgW4`
    > they were 19% slower than when they weren't
  - quotation: "they were 19% slower than when they weren't" from `haWve-6WgW4`

### s07 (factual, verified)

> One set of field experiments followed almost five thousand software developers at three companies, in their regular jobs and partly over years, and estimated that an AI code suggestion tool raised their productivity, measured by their output, by about 26 percent.

- **s07.a** [verified] Observing the output of almost 5000 software developers at three companies in their regular jobs, partly over years, the authors estimate that a generative AI code suggestion tool raised developer productivity by 26.08%, about 26%.
  - qualified (qualify): 1 supporting (1 independent, strongest 0.7), 2 qualifying, 1 context only.
  - warning needs-qualification: METR 2025 RCT: METR 2025: in large, mature repos (~10 years old, >1.1M LOC) AI helped less than in greenfield RCTs, and on average slowed developers by 19%; this goes beyond 'modest gains', and the repos are open-source rather than enterprise. [partial: the verdict note limits its own scope ("rather than")] Shan et al. field study + RCT: Field DID at a 5,000-person IT services firm (201 devs, 27 weeks, 2023-24 Copilot/ChatGPT/Gemini): AI users completed 1.08 more user stories per week (+18%), a real gain but modest next to 55% or 10x headlines; usage was self-reported and partly self-selected. [partial: the verdict note limits its own scope ("self-reported")] Context only, Google migrations report (partly): bespoke migration pipelines with fine-tuned models and engineers' estimates; not average developer work in an enterprise codebase. Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: Microsoft/Accenture field RCTs right 0.7, direct `ai-coding/sources/cui-demirer-copilot-field-experiments.txt#L774-L784`
    > To summarize, we find that usage of a generative AI code suggestion tool increases software developer productivity by 26.08% (SE: 10.3%). We note that this estimate is sub- stantially smaller than the 58% decrease Peng et al. (2023) find for the time to complete a software engineering task in the lab (which would corre…
  - qualifies (uncited): METR 2025 RCT partly 0.5, partial `ai-coding/sources/2507.09089v2.txt#L995-L1001`
    > METR 2025: in large, mature repos (~10 years old, >1.1M LOC) AI helped less than in greenfield RCTs, and on average slowed developers by 19%; this goes beyond 'modest gains', and the repos are open-source rather than enterprise.
  - qualifies (uncited): Shan et al. field study + RCT partly 0.5, partial `ai-coding/sources/4859137.txt#L489-L493`
    > Field DID at a 5,000-person IT services firm (201 devs, 27 weeks, 2023-24 Copilot/ChatGPT/Gemini): AI users completed 1.08 more user stories per week (+18%), a real gain but modest next to 55% or 10x headlines; usage was self-reported and partly self-selected.
  - context (uncited): Google migrations report partly 0.3, contextual `ai-coding/sources/2501.06972.txt#L245-L251`
    > Google reports large end-to-end savings (about 50% on int64, about 89% on small Joda clusters) in a 500M+ LOC codebase, but only for bespoke migration pipelines with fine-tuned models, not average developer work, and the figures are engineers' estimates.
  - calculation: 26.08 = 26

### s08 (factual, verified)

> The authors note that this is substantially smaller than an earlier lab result, and suggest why: some kinds of coding are less readily helped by the tool, and coding is only part of a developer's job.

- **s08.a** [verified] The field estimate is substantially smaller than the lab result of Peng et al.; the authors suggest some coding tasks are less readily assisted by the tool and coding is only part of a developer's job.
  - qualified (qualify): 1 supporting (1 independent, strongest 0.7), 2 qualifying, 1 context only. modality: possibility.
  - warning needs-qualification: METR 2025 RCT: METR 2025: in large, mature repos (~10 years old, >1.1M LOC) AI helped less than in greenfield RCTs, and on average slowed developers by 19%; this goes beyond 'modest gains', and the repos are open-source rather than enterprise. [partial: the verdict note limits its own scope ("rather than")] Shan et al. field study + RCT: Field DID at a 5,000-person IT services firm (201 devs, 27 weeks, 2023-24 Copilot/ChatGPT/Gemini): AI users completed 1.08 more user stories per week (+18%), a real gain but modest next to 55% or 10x headlines; usage was self-reported and partly self-selected. [partial: the verdict note limits its own scope ("self-reported")] Context only, Google migrations report (partly): bespoke migration pipelines with fine-tuned models and engineers' estimates; not average developer work in an enterprise codebase. Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: Microsoft/Accenture field RCTs right 0.7, direct `ai-coding/sources/cui-demirer-copilot-field-experiments.txt#L774-L784`
    > To summarize, we find that usage of a generative AI code suggestion tool increases software developer productivity by 26.08% (SE: 10.3%). We note that this estimate is sub- stantially smaller than the 58% decrease Peng et al. (2023) find for the time to complete a software engineering task in the lab (which would corre…
  - qualifies (uncited): METR 2025 RCT partly 0.5, partial `ai-coding/sources/2507.09089v2.txt#L995-L1001`
    > METR 2025: in large, mature repos (~10 years old, >1.1M LOC) AI helped less than in greenfield RCTs, and on average slowed developers by 19%; this goes beyond 'modest gains', and the repos are open-source rather than enterprise.
  - qualifies (uncited): Shan et al. field study + RCT partly 0.5, partial `ai-coding/sources/4859137.txt#L489-L493`
    > Field DID at a 5,000-person IT services firm (201 devs, 27 weeks, 2023-24 Copilot/ChatGPT/Gemini): AI users completed 1.08 more user stories per week (+18%), a real gain but modest next to 55% or 10x headlines; usage was self-reported and partly self-selected.
  - context (uncited): Google migrations report partly 0.3, contextual `ai-coding/sources/2501.06972.txt#L245-L251`
    > Google reports large end-to-end savings (about 50% on int64, about 89% on small Joda clusters) in a 500M+ LOC codebase, but only for bespoke migration pipelines with fine-tuned models, not average developer work, and the figures are engineers' estimates.

### s09 (factual, verified)

> A separate trial estimated a roughly 21 percent increase in development speed attributable to AI, but that estimate missed the usual bar for statistical significance, so it is less certain than it sounds.

- **s09.a** [verified] The trial estimated a roughly 21% increase in development speed attributable to AI in its best-fit model, an effect that did not meet the usual significance threshold.
  - qualified (qualify): 1 supporting (1 independent, strongest 0.7), 2 qualifying, 1 context only.
  - warning needs-qualification: METR 2025 RCT: METR 2025: in large, mature repos (~10 years old, >1.1M LOC) AI helped less than in greenfield RCTs, and on average slowed developers by 19%; this goes beyond 'modest gains', and the repos are open-source rather than enterprise. [partial: the verdict note limits its own scope ("rather than")] Shan et al. field study + RCT: Field DID at a 5,000-person IT services firm (201 devs, 27 weeks, 2023-24 Copilot/ChatGPT/Gemini): AI users completed 1.08 more user stories per week (+18%), a real gain but modest next to 55% or 10x headlines; usage was self-reported and partly self-selected. [partial: the verdict note limits its own scope ("self-reported")] Context only, Google migrations report (partly): bespoke migration pipelines with fine-tuned models and engineers' estimates; not average developer work in an enterprise codebase. Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: Google RCT right 0.7, direct `ai-coding/sources/2410.12944.txt#L519-L528`
    > When controlling for other factors in our theoretical frame- detailed, logs-based analyses might circumvent the issues we work, we obtained a similar effect size for AI, but the effect faced with statistical significance within our trial data. did not meet the p < .05 significance threshold. At this stage, we estimate …
  - qualifies (uncited): METR 2025 RCT partly 0.5, partial `ai-coding/sources/2507.09089v2.txt#L995-L1001`
    > METR 2025: in large, mature repos (~10 years old, >1.1M LOC) AI helped less than in greenfield RCTs, and on average slowed developers by 19%; this goes beyond 'modest gains', and the repos are open-source rather than enterprise.
  - qualifies (uncited): Shan et al. field study + RCT partly 0.5, partial `ai-coding/sources/4859137.txt#L489-L493`
    > Field DID at a 5,000-person IT services firm (201 devs, 27 weeks, 2023-24 Copilot/ChatGPT/Gemini): AI users completed 1.08 more user stories per week (+18%), a real gain but modest next to 55% or 10x headlines; usage was self-reported and partly self-selected.
  - context (uncited): Google migrations report partly 0.3, contextual `ai-coding/sources/2501.06972.txt#L245-L251`
    > Google reports large end-to-end savings (about 50% on int64, about 89% on small Joda clusters) in a 500M+ LOC codebase, but only for bespoke migration pipelines with fine-tuned models, not average developer work, and the figures are engineers' estimates.

### s11 (factual, verified)

> METR ran a randomized controlled trial with 16 experienced open-source developers on 246 tasks in mature projects they had worked on for an average of 5 years, randomly allowing or disallowing AI tools task by task.

- **s11.a** [verified] METR's randomized controlled trial had 16 experienced open-source developers complete 246 tasks in mature projects on which they had an average of 5 years of prior experience, with each task randomly assigned to allow or disallow AI tools.
  - supported (approved): 2 supporting (2 independent, strongest 0.85).
  - info wording: Wording differs from the canonical claim; the reviewer confirms the passages entail it.
  - supports: METR 2025 RCT right 0.85, direct `ai-coding/sources/2507.09089v2.txt#L11-L27`
    > the wild remains understudied. We conduct a randomized controlled trial (RCT) to understand how AI tools at the February�June 2025 frontier affect the produc- tivity of experienced open-source developers. 16 developers with moderate AI experience complete 246 tasks in mature projects on which they have an aver- age of …
  - supports: METR 2026 update right 0.7, direct `ai-coding/sources/metr-2026-experiment-design.txt#L58-L62`
    > METR previously published a paper which found the use of AI tools caused a 20% slowdown in completing tasks among experienced open-source developers, using data from February to June 2025. To understand how AI is impacting developer productivity over time, we started a new experiment in August 2025 with a larger pool o…

### s12 (factual, verified)

> The tools were the February to June 2025 frontier: mostly the Cursor Pro editor with Claude 3.5 and 3.7 Sonnet.

- **s12.a** [verified] The trial tested AI tools at the February-June 2025 frontier; developers primarily used Cursor Pro with Claude 3.5/3.7 Sonnet.
  - supported (approved): 1 supporting (1 independent, strongest 0.85).
  - info wording: Wording differs from the canonical claim; the reviewer confirms the passages entail it.
  - supports: METR 2025 RCT right 0.85, direct `ai-coding/sources/2507.09089v2.txt#L11-L27`
    > the wild remains understudied. We conduct a randomized controlled trial (RCT) to understand how AI tools at the February�June 2025 frontier affect the produc- tivity of experienced open-source developers. 16 developers with moderate AI experience complete 246 tasks in mature projects on which they have an aver- age of …

### s13 (factual, verified)

> With AI allowed, tasks took 19 percent longer to complete.

- **s13.a** [verified] Allowing AI increased task completion time by 19%.
  - supported (approved): 1 supporting (1 independent, strongest 0.85).
  - info wording: Wording differs from the canonical claim; the reviewer confirms the passages entail it.
  - supports: METR 2025 RCT right 0.85, direct `ai-coding/sources/2507.09089v2.txt#L11-L27`
    > the wild remains understudied. We conduct a randomized controlled trial (RCT) to understand how AI tools at the February�June 2025 frontier affect the produc- tivity of experienced open-source developers. 16 developers with moderate AI experience complete 246 tasks in mature projects on which they have an aver- age of …

### s14 (factual, verified)

> The researchers' hypothesis for why AI helped less than in earlier trials: their projects averaged about 10 years old and more than 1,100,000 lines of code, compared with the more greenfield projects in those trials.

- **s14.a** [verified] METR hypothesizes that AI helped its developers less than in earlier RCTs because of the size and complexity of the repositories, which average about 10 years old and >1,100,000 lines of code, compared with the more greenfield projects in Peng et al. and other trials.
  - qualified (qualify): no direct support, 2 qualifying, 1 context only.
  - warning needs-qualification: METR 2025 RCT: METR 2025: in large, mature repos (~10 years old, >1.1M LOC) AI helped less than in greenfield RCTs, and on average slowed developers by 19%; this goes beyond 'modest gains', and the repos are open-source rather than enterprise. Add the qualification: the evidence supports a narrower or weaker statement.
  - qualifies: METR 2025 RCT partly 0.5, partial `ai-coding/sources/2507.09089v2.txt#L995-L1001`
    > We hypothesize that analogously to these size and complexity effects within our study, AI broadly helps our developers less compared to existing randomized controlled trials (RCTs) measuring speedup from AI tools because of the overall size and complexity of the repositories included-- participating repositories are on…
  - qualifies (uncited): Shan et al. field study + RCT partly 0.5, partial `ai-coding/sources/4859137.txt#L489-L493`
    > Field DID at a 5,000-person IT services firm (201 devs, 27 weeks, 2023-24 Copilot/ChatGPT/Gemini): AI users completed 1.08 more user stories per week (+18%), a real gain but modest next to 55% or 10x headlines; usage was self-reported and partly self-selected.
  - context (uncited): Google migrations report partly 0.3, contextual `ai-coding/sources/2501.06972.txt#L245-L251`
    > Google reports large end-to-end savings (about 50% on int64, about 89% on small Joda clusters) in a 500M+ LOC codebase, but only for bespoke migration pipelines with fine-tuned models, not average developer work, and the figures are engineers' estimates.

### s16 (factual, verified)

> METR's own 2026 update says that, from talking to participants, it believes developers are likely more sped up in early 2026 than in early 2025.

- **s16.a** [verified] Based on conversations with study participants, METR believes it is likely that developers are more sped up from AI tools in early 2026 than in its early 2025 estimates.
  - qualified (qualify): no direct support, 1 qualifying.
  - warning needs-qualification: METR 2026 update: METR Feb 2026: METR believes developers are likely more sped up in early 2026. Returning developers show an 18% time reduction (CI -38% to +9%) and new recruits a 4% reduction (CI -15% to +9%), but selection effects make this 'very weak evidence', and models are not separated from other changes. Add the qualification: the evidence supports a narrower or weaker statement.
  - qualifies: METR 2026 update partly 0.4, partial `ai-coding/sources/metr-2026-experiment-design.txt#L61-L62`
    > Based on conversations with study participants, we believe it is likely that developers are more sped up from AI tools now — in early 2026 — compared to our estimates from early 2025. However, because of the selection effects in our experiment, our data is only very weak evidence for the size of this increase. Our raw …
  - inconclusive (uncited): METR 2025 RCT unknown, direct `ai-coding/sources/2507.09089v2.txt#L587-L599`
    > The paper tests only Feb-June 2025 tools. It says more reliable or better-elicited systems could speed up developers, and that early agents already make progress, but it doesn't test newer models.

### s17 (factual, verified)

> Its new raw numbers lean the same way: tasks took an estimated 18 percent less time for returning developers and 4 percent less for new recruits, but both ranges still stretch to a slowdown.

- **s17.a** [verified] METR's later study estimates a speedup of -18% (confidence interval -38% to +9%) for returning developers and -4% (confidence interval -15% to +9%) for newly recruited developers; both intervals reach into longer task times.
  - qualified (qualify): no direct support, 1 qualifying.
  - warning needs-qualification: METR 2026 update: METR Feb 2026: METR believes developers are likely more sped up in early 2026. Returning developers show an 18% time reduction (CI -38% to +9%) and new recruits a 4% reduction (CI -15% to +9%), but selection effects make this 'very weak evidence', and models are not separated from other changes. Add the qualification: the evidence supports a narrower or weaker statement.
  - qualifies: METR 2026 update partly 0.4, partial `ai-coding/sources/metr-2026-experiment-design.txt#L61-L62`
    > Based on conversations with study participants, we believe it is likely that developers are more sped up from AI tools now — in early 2026 — compared to our estimates from early 2025. However, because of the selection effects in our experiment, our data is only very weak evidence for the size of this increase. Our raw …
  - inconclusive (uncited): METR 2025 RCT unknown, direct `ai-coding/sources/2507.09089v2.txt#L587-L599`
    > The paper tests only Feb-June 2025 tools. It says more reliable or better-elicited systems could speed up developers, and that early agents already make progress, but it doesn't test newer models.

### s18 (factual, verified)

> And METR calls this only very weak evidence: more developers now decline to take part because they don't want to work without AI, which likely pushes its speedup estimate down, so the ones left are not a fair sample.

- **s18.a** [verified] Because of the selection effects in its new experiment, METR calls its data only very weak evidence for the size of the increase in speedup.
  - qualified (qualify): no direct support, 1 qualifying.
  - warning needs-qualification: METR 2026 update: METR Feb 2026: METR believes developers are likely more sped up in early 2026. Returning developers show an 18% time reduction (CI -38% to +9%) and new recruits a 4% reduction (CI -15% to +9%), but selection effects make this 'very weak evidence', and models are not separated from other changes. Add the qualification: the evidence supports a narrower or weaker statement.
  - qualifies: METR 2026 update partly 0.4, partial `ai-coding/sources/metr-2026-experiment-design.txt#L61-L62`
    > Based on conversations with study participants, we believe it is likely that developers are more sped up from AI tools now — in early 2026 — compared to our estimates from early 2025. However, because of the selection effects in our experiment, our data is only very weak evidence for the size of this increase. Our raw …
  - inconclusive (uncited): METR 2025 RCT unknown, direct `ai-coding/sources/2507.09089v2.txt#L587-L599`
    > The paper tests only Feb-June 2025 tools. It says more reliable or better-elicited systems could speed up developers, and that early agents already make progress, but it doesn't test newer models.
- **s18.b** [verified] METR observed a significant increase in developers choosing not to participate in its new experiment because they do not wish to work without AI, which it says likely biases its estimate of AI-assisted speedup downwards.
  - supported (approved): 1 supporting (1 independent, strongest 0.7).
  - info wording: Wording differs from the canonical claim; the reviewer confirms the passages entail it.
  - supports: METR 2026 update right 0.7, direct `ai-coding/sources/metr-2026-experiment-design.txt#L58-L62`
    > METR previously published a paper which found the use of AI tools caused a 20% slowdown in completing tasks among experienced open-source developers, using data from February to June 2025. To understand how AI is impacting developer productivity over time, we started a new experiment in August 2025 with a larger pool o…

### s20 (factual, verified)

> The largest figures so far come from Anthropic's own report on its staff: employees self-reported that they now get a 50 percent productivity gain from Claude on average, and merged pull requests per engineer per day rose 67 percent when its engineering org adopted Claude Code.

- **s20.a** [verified] Anthropic employees self-reported that they now use Claude in 59% of their work and get +50% productivity gains from it on average.
  - qualified (qualify): no direct support, 2 qualifying. modality: typical.
  - warning needs-qualification: Anthropic internal study: Anthropic: users self-report an average +50% gain at 59% usage, plus about 67% more merged PRs per engineer after Claude Code adoption, an order of magnitude below 10x. Add the qualification: the evidence supports a narrower or weaker statement.
  - qualifies: Anthropic internal study wrong 0.4, partial `ai-coding/sources/anthropic-work-at-anthropic.txt#L35-L35`
    > Employees self-reported that 12 months ago, they used Claude in 28% of their daily work and got a +20% productivity boost from it, whereas now, they use Claude in 59% of their work and achieve +50% productivity gains from it on average. (This roughly corroborates the 67% increase in merged pull requests—i.e. successful…
  - qualifies (uncited): Shan et al. field study + RCT wrong 0.3, partial `ai-coding/sources/4859137.txt#L489-L493`
    > The field gain from AI assistants was about 18% more user stories (24-31% under alternative estimators), far from 10x. The tools were 2023-24 assistants, not agentic coding.
- **s20.b** [verified] Anthropic saw a 67% increase in merged pull requests per engineer per day when it adopted Claude Code across its engineering org.
  - qualified (qualify): no direct support, 2 qualifying.
  - warning needs-qualification: Anthropic internal study: Anthropic: users self-report an average +50% gain at 59% usage, plus about 67% more merged PRs per engineer after Claude Code adoption, an order of magnitude below 10x. Add the qualification: the evidence supports a narrower or weaker statement.
  - qualifies: Anthropic internal study wrong 0.4, partial `ai-coding/sources/anthropic-work-at-anthropic.txt#L35-L35`
    > Employees self-reported that 12 months ago, they used Claude in 28% of their daily work and got a +20% productivity boost from it, whereas now, they use Claude in 59% of their work and achieve +50% productivity gains from it on average. (This roughly corroborates the 67% increase in merged pull requests—i.e. successful…
  - qualifies (uncited): Shan et al. field study + RCT wrong 0.3, partial `ai-coding/sources/4859137.txt#L489-L493`
    > The field gain from AI assistants was about 18% more user stories (24-31% under alternative estimators), far from 10x. The tools were 2023-24 assistants, not agentic coding.

### s21 (factual, verified)

> A count of merged changes is not the same as time saved, but even taken at face value, both figures are an order of magnitude below ten times.

- **s21.b** [verified] A self-reported +50% gain and 67% more merged pull requests are an order of magnitude below 10x.
  - qualified (qualify): no direct support, 2 qualifying.
  - warning needs-qualification: Anthropic internal study: Anthropic: users self-report an average +50% gain at 59% usage, plus about 67% more merged PRs per engineer after Claude Code adoption, an order of magnitude below 10x. Add the qualification: the evidence supports a narrower or weaker statement.
  - qualifies: Anthropic internal study wrong 0.4, partial `ai-coding/sources/anthropic-work-at-anthropic.txt#L35-L35`
    > Employees self-reported that 12 months ago, they used Claude in 28% of their daily work and got a +20% productivity boost from it, whereas now, they use Claude in 59% of their work and achieve +50% productivity gains from it on average. (This roughly corroborates the 67% increase in merged pull requests—i.e. successful…
  - qualifies (uncited): Shan et al. field study + RCT wrong 0.3, partial `ai-coding/sources/4859137.txt#L489-L493`
    > The field gain from AI assistants was about 18% more user stories (24-31% under alternative estimators), far from 10x. The tools were 2023-24 assistants, not agentic coding.

### s22 (factual, verified)

> So, how much faster? In the workplace studies, with the tools they tested, the measured gains were modest, nowhere near the multiples in the hype.

- **s22.a** [verified] Field and trial estimates in workplaces with the assistants they tested (26.08% more output; a roughly 21% speed increase that missed significance) show modest average gains, far below headline claims.
  - qualified (qualify): 2 supporting (2 independent, strongest 0.7), 2 qualifying, 1 context only.
  - warning needs-qualification: METR 2025 RCT: METR 2025: in large, mature repos (~10 years old, >1.1M LOC) AI helped less than in greenfield RCTs, and on average slowed developers by 19%; this goes beyond 'modest gains', and the repos are open-source rather than enterprise. [partial: the verdict note limits its own scope ("rather than")] Shan et al. field study + RCT: Field DID at a 5,000-person IT services firm (201 devs, 27 weeks, 2023-24 Copilot/ChatGPT/Gemini): AI users completed 1.08 more user stories per week (+18%), a real gain but modest next to 55% or 10x headlines; usage was self-reported and partly self-selected. [partial: the verdict note limits its own scope ("self-reported")] Context only, Google migrations report (partly): bespoke migration pipelines with fine-tuned models and engineers' estimates; not average developer work in an enterprise codebase. Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: Microsoft/Accenture field RCTs right 0.7, direct `ai-coding/sources/cui-demirer-copilot-field-experiments.txt#L774-L784`
    > To summarize, we find that usage of a generative AI code suggestion tool increases software developer productivity by 26.08% (SE: 10.3%). We note that this estimate is sub- stantially smaller than the 58% decrease Peng et al. (2023) find for the time to complete a software engineering task in the lab (which would corre…
  - supports: Google RCT right 0.7, direct `ai-coding/sources/2410.12944.txt#L519-L528`
    > When controlling for other factors in our theoretical frame- detailed, logs-based analyses might circumvent the issues we work, we obtained a similar effect size for AI, but the effect faced with statistical significance within our trial data. did not meet the p < .05 significance threshold. At this stage, we estimate …
  - qualifies (uncited): METR 2025 RCT partly 0.5, partial `ai-coding/sources/2507.09089v2.txt#L995-L1001`
    > METR 2025: in large, mature repos (~10 years old, >1.1M LOC) AI helped less than in greenfield RCTs, and on average slowed developers by 19%; this goes beyond 'modest gains', and the repos are open-source rather than enterprise.
  - qualifies (uncited): Shan et al. field study + RCT partly 0.5, partial `ai-coding/sources/4859137.txt#L489-L493`
    > Field DID at a 5,000-person IT services firm (201 devs, 27 weeks, 2023-24 Copilot/ChatGPT/Gemini): AI users completed 1.08 more user stories per week (+18%), a real gain but modest next to 55% or 10x headlines; usage was self-reported and partly self-selected.
  - context (uncited): Google migrations report partly 0.3, contextual `ai-coding/sources/2501.06972.txt#L245-L251`
    > Google reports large end-to-end savings (about 50% on int64, about 89% on small Joda clusters) in a 500M+ LOC codebase, but only for bespoke migration pipelines with fine-tuned models, not average developer work, and the figures are engineers' estimates.

### s23 (factual, verified)

> For experienced developers in big, mature projects they knew well, early-2025 tools made them slower, and whether today's tools have reversed that, METR's own newer data is too weak to say.

- **s23.a** [verified] Early-2025 AI tools increased completion time for experienced open-source developers on mature projects they knew well.
  - supported (approved): 1 supporting (1 independent, strongest 0.85).
  - info wording: Wording differs from the canonical claim; the reviewer confirms the passages entail it.
  - supports: METR 2025 RCT right 0.85, direct `ai-coding/sources/2507.09089v2.txt#L11-L27`
    > the wild remains understudied. We conduct a randomized controlled trial (RCT) to understand how AI tools at the February�June 2025 frontier affect the produc- tivity of experienced open-source developers. 16 developers with moderate AI experience complete 246 tasks in mature projects on which they have an aver- age of …
- **s23.b** [verified] METR's newer data is only very weak evidence for how much developers are sped up now, because of selection effects.
  - qualified (qualify): no direct support, 1 qualifying.
  - warning needs-qualification: METR 2026 update: METR Feb 2026: METR believes developers are likely more sped up in early 2026. Returning developers show an 18% time reduction (CI -38% to +9%) and new recruits a 4% reduction (CI -15% to +9%), but selection effects make this 'very weak evidence', and models are not separated from other changes. Add the qualification: the evidence supports a narrower or weaker statement.
  - qualifies: METR 2026 update partly 0.4, partial `ai-coding/sources/metr-2026-experiment-design.txt#L61-L62`
    > Based on conversations with study participants, we believe it is likely that developers are more sped up from AI tools now — in early 2026 — compared to our estimates from early 2025. However, because of the selection effects in our experiment, our data is only very weak evidence for the size of this increase. Our raw …
  - inconclusive (uncited): METR 2025 RCT unknown, direct `ai-coding/sources/2507.09089v2.txt#L587-L599`
    > The paper tests only Feb-June 2025 tools. It says more reliable or better-elicited systems could speed up developers, and that early agents already make progress, but it doesn't test newer models.

### s26 (factual, verified)

> Before starting, the METR developers forecast that allowing AI would cut their completion time by 24 percent.

- **s26.a** [verified] Before starting tasks, the developers forecast that allowing AI would reduce completion time by 24%.
  - disputed (qualify): 1 supporting (1 independent, strongest 0.8), 1 contradicting, 1 qualifying.
  - warning needs-qualification: Contradicted by Copilot RCT (Peng): In the Copilot RCT both groups estimated a ~35% productivity gain, an underestimate of the measured 55.8% speedup. Present the disagreement: name the studies on each side instead of stating one side as fact.
  - supports: METR 2025 RCT right 0.8, direct `ai-coding/sources/2507.09089v2.txt#L17-L24`
    > primarily use Cursor Pro, a popular code editor, and Claude 3.5/3.7 Sonnet. Be- fore starting tasks, developers forecast that allowing AI will reduce completion time by 24%. After completing the study, developers estimate that allowing AI reduced completion time by 20%. Surprisingly, we find that allowing AI actually i…
  - qualifies (uncited): METR 2026 update partly 0.35, partial `ai-coding/sources/metr-2026-experiment-design.txt#L63-L63`
    > METR Feb 2026: some developers self-report very high speedups, which METR notes can be 'quite unreliable' per its earlier study; it also says the true speedup may be higher among those who selected out, so no new measured overestimate.
  - contradicts (uncited): Copilot RCT (Peng) wrong 0.45, direct `ai-coding/sources/2302.06590.txt#L184-L188`
    > In the Copilot RCT both groups estimated a ~35% productivity gain, an underestimate of the measured 55.8% speedup.
  - inconclusive (uncited): Anthropic internal study unknown, partial `ai-coding/sources/anthropic-work-at-anthropic.txt#L36-L36`
    > Anthropic's +50% figures are self-reported; the post cites METR's overestimation finding and admits perception, social-desirability and recall biases, so it cannot settle the question.

### s27 (factual, verified)

> After the study, with the work behind them, they estimated it had cut their time by 20 percent, in the same trial that measured them taking longer.

- **s27.a** [verified] After completing the study, the developers estimated that allowing AI had reduced completion time by 20%, while the trial found it increased completion time.
  - disputed (qualify): 1 supporting (1 independent, strongest 0.8), 1 contradicting, 1 qualifying.
  - warning needs-qualification: Contradicted by Copilot RCT (Peng): In the Copilot RCT both groups estimated a ~35% productivity gain, an underestimate of the measured 55.8% speedup. Present the disagreement: name the studies on each side instead of stating one side as fact.
  - supports: METR 2025 RCT right 0.8, direct `ai-coding/sources/2507.09089v2.txt#L17-L24`
    > primarily use Cursor Pro, a popular code editor, and Claude 3.5/3.7 Sonnet. Be- fore starting tasks, developers forecast that allowing AI will reduce completion time by 24%. After completing the study, developers estimate that allowing AI reduced completion time by 20%. Surprisingly, we find that allowing AI actually i…
  - qualifies (uncited): METR 2026 update partly 0.35, partial `ai-coding/sources/metr-2026-experiment-design.txt#L63-L63`
    > METR Feb 2026: some developers self-report very high speedups, which METR notes can be 'quite unreliable' per its earlier study; it also says the true speedup may be higher among those who selected out, so no new measured overestimate.
  - contradicts (uncited): Copilot RCT (Peng) wrong 0.45, direct `ai-coding/sources/2302.06590.txt#L184-L188`
    > In the Copilot RCT both groups estimated a ~35% productivity gain, an underestimate of the measured 55.8% speedup.
  - inconclusive (uncited): Anthropic internal study unknown, partial `ai-coding/sources/anthropic-work-at-anthropic.txt#L36-L36`
    > Anthropic's +50% figures are self-reported; the post cites METR's overestimation finding and admits perception, social-desirability and recall biases, so it cannot settle the question.

### s28 (factual, verified)

> Outside experts did no better: economists predicted 39 percent shorter completion times, and machine learning experts 38 percent.

- **s28.a** [verified] Experts in economics predicted 39% shorter completion times and experts in ML predicted 38% shorter.
  - disputed (qualify): 1 supporting (1 independent, strongest 0.8), 1 contradicting, 1 qualifying.
  - warning needs-qualification: Contradicted by Copilot RCT (Peng): In the Copilot RCT both groups estimated a ~35% productivity gain, an underestimate of the measured 55.8% speedup. Present the disagreement: name the studies on each side instead of stating one side as fact.
  - supports: METR 2025 RCT right 0.8, direct `ai-coding/sources/2507.09089v2.txt#L17-L24`
    > primarily use Cursor Pro, a popular code editor, and Claude 3.5/3.7 Sonnet. Be- fore starting tasks, developers forecast that allowing AI will reduce completion time by 24%. After completing the study, developers estimate that allowing AI reduced completion time by 20%. Surprisingly, we find that allowing AI actually i…
  - qualifies (uncited): METR 2026 update partly 0.35, partial `ai-coding/sources/metr-2026-experiment-design.txt#L63-L63`
    > METR Feb 2026: some developers self-report very high speedups, which METR notes can be 'quite unreliable' per its earlier study; it also says the true speedup may be higher among those who selected out, so no new measured overestimate.
  - contradicts (uncited): Copilot RCT (Peng) wrong 0.45, direct `ai-coding/sources/2302.06590.txt#L184-L188`
    > In the Copilot RCT both groups estimated a ~35% productivity gain, an underestimate of the measured 55.8% speedup.
  - inconclusive (uncited): Anthropic internal study unknown, partial `ai-coding/sources/anthropic-work-at-anthropic.txt#L36-L36`
    > Anthropic's +50% figures are self-reported; the post cites METR's overestimation finding and admits perception, social-desirability and recall biases, so it cannot settle the question.

### s30 (factual, verified)

> In an earlier randomized trial of Copilot, a lab task on a greenfield-style project, the measured productivity gain was 55.8 percent, yet participants in both the AI and the control group estimated 35 percent on average: they underestimated it.

- **s30.a** [verified] In the Copilot trial, participants in both treated and control groups estimated a 35% increase in productivity on average, an underestimation compared with the 55.8% increase in their revealed productivity.
  - disputed (qualify): 1 supporting (1 independent, strongest 0.45), 1 contradicting, 1 qualifying. modality: typical.
  - warning needs-qualification: Contradicted by METR 2025 RCT: Developers forecast a 24% speedup and afterward estimated 20%, but were actually slowed 19%. Experts also overestimated, predicting 38-39% faster. Present the disagreement: name the studies on each side instead of stating one side as fact.
  - supports: Copilot RCT (Peng) wrong 0.45, direct `ai-coding/sources/2302.06590.txt#L184-L188`
    > lot during the task, they were given the tutorial video before answering this question so that they are aware of the features of Copilot. Figure 7 presents the distribution of the self-reported productivity gain estimates from the control and treated groups. On average, participants in both treated and control groups e…
  - qualifies (uncited): METR 2026 update partly 0.35, partial `ai-coding/sources/metr-2026-experiment-design.txt#L63-L63`
    > METR Feb 2026: some developers self-report very high speedups, which METR notes can be 'quite unreliable' per its earlier study; it also says the true speedup may be higher among those who selected out, so no new measured overestimate.
  - contradicts (uncited): METR 2025 RCT right 0.8, direct `ai-coding/sources/2507.09089v2.txt#L17-L24`
    > Developers forecast a 24% speedup and afterward estimated 20%, but were actually slowed 19%. Experts also overestimated, predicting 38-39% faster.
  - inconclusive (uncited): Anthropic internal study unknown, partial `ai-coding/sources/anthropic-work-at-anthropic.txt#L36-L36`
    > Anthropic's +50% figures are self-reported; the post cites METR's overestimation finding and admits perception, social-desirability and recall biases, so it cannot settle the question.
- **s30.b** [verified] Peng et al.'s Copilot result came from a software engineering task in the lab, on a more greenfield project.
  - qualified (qualify): 1 supporting (1 independent, strongest 0.7), 2 qualifying, 1 context only.
  - warning needs-qualification: METR 2025 RCT: METR 2025: in large, mature repos (~10 years old, >1.1M LOC) AI helped less than in greenfield RCTs, and on average slowed developers by 19%; this goes beyond 'modest gains', and the repos are open-source rather than enterprise. Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: Microsoft/Accenture field RCTs right 0.7, direct `ai-coding/sources/cui-demirer-copilot-field-experiments.txt#L774-L784`
    > To summarize, we find that usage of a generative AI code suggestion tool increases software developer productivity by 26.08% (SE: 10.3%). We note that this estimate is sub- stantially smaller than the 58% decrease Peng et al. (2023) find for the time to complete a software engineering task in the lab (which would corre…
  - qualifies: METR 2025 RCT partly 0.5, partial `ai-coding/sources/2507.09089v2.txt#L995-L1001`
    > We hypothesize that analogously to these size and complexity effects within our study, AI broadly helps our developers less compared to existing randomized controlled trials (RCTs) measuring speedup from AI tools because of the overall size and complexity of the repositories included-- participating repositories are on…
  - qualifies (uncited): Shan et al. field study + RCT partly 0.5, partial `ai-coding/sources/4859137.txt#L489-L493`
    > Field DID at a 5,000-person IT services firm (201 devs, 27 weeks, 2023-24 Copilot/ChatGPT/Gemini): AI users completed 1.08 more user stories per week (+18%), a real gain but modest next to 55% or 10x headlines; usage was self-reported and partly self-selected.
  - context (uncited): Google migrations report partly 0.3, contextual `ai-coding/sources/2501.06972.txt#L245-L251`
    > Google reports large end-to-end savings (about 50% on int64, about 89% on small Joda clusters) in a 500M+ LOC codebase, but only for bespoke migration pipelines with fine-tuned models, not average developer work, and the figures are engineers' estimates.

### s31 (factual, verified)

> So the same kind of guess missed in opposite directions: too high for experienced developers in big projects they knew well, too low on a fresh task in the lab.

- **s31.a** [verified] METR's experienced developers on their mature projects overestimated their speedup, while participants in the Copilot lab trial underestimated theirs.
  - disputed (qualify): 1 supporting (1 independent, strongest 0.8), 1 contradicting, 1 qualifying.
  - warning needs-qualification: Contradicted by Copilot RCT (Peng): In the Copilot RCT both groups estimated a ~35% productivity gain, an underestimate of the measured 55.8% speedup. Present the disagreement: name the studies on each side instead of stating one side as fact.
  - supports: METR 2025 RCT right 0.8, direct `ai-coding/sources/2507.09089v2.txt#L17-L24`
    > primarily use Cursor Pro, a popular code editor, and Claude 3.5/3.7 Sonnet. Be- fore starting tasks, developers forecast that allowing AI will reduce completion time by 24%. After completing the study, developers estimate that allowing AI reduced completion time by 20%. Surprisingly, we find that allowing AI actually i…
  - qualifies (uncited): METR 2026 update partly 0.35, partial `ai-coding/sources/metr-2026-experiment-design.txt#L63-L63`
    > METR Feb 2026: some developers self-report very high speedups, which METR notes can be 'quite unreliable' per its earlier study; it also says the true speedup may be higher among those who selected out, so no new measured overestimate.
  - contradicts: Copilot RCT (Peng) wrong 0.45, direct `ai-coding/sources/2302.06590.txt#L184-L188`
    > lot during the task, they were given the tutorial video before answering this question so that they are aware of the features of Copilot. Figure 7 presents the distribution of the self-reported productivity gain estimates from the control and treated groups. On average, participants in both treated and control groups e…
  - inconclusive (uncited): Anthropic internal study unknown, partial `ai-coding/sources/anthropic-work-at-anthropic.txt#L36-L36`
    > Anthropic's +50% figures are self-reported; the post cites METR's overestimation finding and admits perception, social-desirability and recall biases, so it cannot settle the question.

### s32 (factual, verified)

> METR's later update adds that some developers now self-report very high speedups, and repeats that, as its earlier study found, such estimates can be quite unreliable.

- **s32.a** [verified] METR's later update says some developers self-report very high speedups, and that as its earlier study documented those estimates can be quite unreliable.
  - disputed (qualify): 1 supporting (1 independent, strongest 0.8), 1 contradicting, 1 qualifying. modality: possibility.
  - warning needs-qualification: METR 2026 update: METR Feb 2026: some developers self-report very high speedups, which METR notes can be 'quite unreliable' per its earlier study; it also says the true speedup may be higher among those who selected out, so no new measured overestimate. Present the disagreement: name the studies on each side instead of stating one side as fact.
  - supports: METR 2025 RCT right 0.8, direct `ai-coding/sources/2507.09089v2.txt#L17-L24`
    > primarily use Cursor Pro, a popular code editor, and Claude 3.5/3.7 Sonnet. Be- fore starting tasks, developers forecast that allowing AI will reduce completion time by 24%. After completing the study, developers estimate that allowing AI reduced completion time by 20%. Surprisingly, we find that allowing AI actually i…
  - qualifies: METR 2026 update partly 0.35, partial `ai-coding/sources/metr-2026-experiment-design.txt#L63-L63`
    > However the true speedup could be much higher among the developers and tasks which are selected out of the experiment. Some developers self-report very high speedups, though as we documented in our earlier study those estimates can be quite unreliable.
  - contradicts (uncited): Copilot RCT (Peng) wrong 0.45, direct `ai-coding/sources/2302.06590.txt#L184-L188`
    > In the Copilot RCT both groups estimated a ~35% productivity gain, an underestimate of the measured 55.8% speedup.
  - inconclusive (uncited): Anthropic internal study unknown, partial `ai-coding/sources/anthropic-work-at-anthropic.txt#L36-L36`
    > Anthropic's +50% figures are self-reported; the post cites METR's overestimation finding and admits perception, social-desirability and recall biases, so it cannot settle the question.

### s33 (factual, verified)

> So can developers tell? In both of these trials, not reliably: their guesses missed by a wide margin.

- **s33.a** [verified] In METR's trial developers' estimates were far above the measured effect, and in the Copilot trial participants' estimates were far below it.
  - disputed (qualify): 1 supporting (1 independent, strongest 0.8), 1 contradicting, 1 qualifying.
  - warning needs-qualification: Contradicted by Copilot RCT (Peng): In the Copilot RCT both groups estimated a ~35% productivity gain, an underestimate of the measured 55.8% speedup. Present the disagreement: name the studies on each side instead of stating one side as fact.
  - supports: METR 2025 RCT right 0.8, direct `ai-coding/sources/2507.09089v2.txt#L17-L24`
    > primarily use Cursor Pro, a popular code editor, and Claude 3.5/3.7 Sonnet. Be- fore starting tasks, developers forecast that allowing AI will reduce completion time by 24%. After completing the study, developers estimate that allowing AI reduced completion time by 20%. Surprisingly, we find that allowing AI actually i…
  - qualifies (uncited): METR 2026 update partly 0.35, partial `ai-coding/sources/metr-2026-experiment-design.txt#L63-L63`
    > METR Feb 2026: some developers self-report very high speedups, which METR notes can be 'quite unreliable' per its earlier study; it also says the true speedup may be higher among those who selected out, so no new measured overestimate.
  - contradicts: Copilot RCT (Peng) wrong 0.45, direct `ai-coding/sources/2302.06590.txt#L184-L188`
    > lot during the task, they were given the tutorial video before answering this question so that they are aware of the features of Copilot. Figure 7 presents the distribution of the self-reported productivity gain estimates from the control and treated groups. On average, participants in both treated and control groups e…
  - inconclusive (uncited): Anthropic internal study unknown, partial `ai-coding/sources/anthropic-work-at-anthropic.txt#L36-L36`
    > Anthropic's +50% figures are self-reported; the post cites METR's overestimation finding and admits perception, social-desirability and recall biases, so it cannot settle the question.
