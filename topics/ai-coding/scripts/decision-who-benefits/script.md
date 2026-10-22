# Does AI Help Junior or Senior Developers More?

Story `decision:who-benefits` (ai-coding), revision 2. About 7.7 minutes (1139 words at 150 wpm). Validation: **passed**, 0 blocking, 0 warnings, 31/31 assertions verified.

Markers: `[s12 ok]` every assertion verified by the deterministic checks and the reviewer; `[s12 review]` awaiting review or carrying a warning; `[s12 BLOCKED]` an open blocking issue. Sentences without a marker make no factual claim.

## Hook

Picture a pair of developers switching on the same AI coding assistant on the same morning: a veteran, and a newcomer just starting out. Which of them gets more out of it? The confident answer online is the veteran, so let's put that answer next to the trials that actually measured it.

## Does AI help junior or senior developers more?

On The Pragmatic Engineer, in an episode about AI at Shopify, it was offered as a maybe: "the AI agents are going to help the best engineers more than the mediocre engineer". [s04 ok] On the same show, Simon Willison said that with these tools he will "run circles around somebody who's never written a code line of code in their life". [s05 ok] Willison's yardstick is someone who has never coded, and the trials that follow compared developers with each other, so what they can test is the first claim: when researchers split their results by experience, did the best engineers gain more than the rest? In field experiments that gave developers the coding assistant Copilot, short-tenure developers raised their output by 27 to 39 percent, while long-tenure developers gained 8 to 13 percent. [s07 ok] Those estimates are noisy and not statistically significant, but the pattern was the same on all three of the studies' main output measures. [s08 ok] The authors note that longer-tenure developers abandoning the tool after a trial may shrink their estimate, yet junior developers, who used it as much as seniors once they had adopted it, still gained more than senior ones. [s09 ok] A separate experiment found the same direction: developers with fewer years of experience got the speed benefit from generative AI, while the quality of their code was unaffected. [s10 ok] Another Copilot trial found that less experienced programmers benefited more, and its authors called that promising for people moving into software development, if the result holds up in further studies. [s11 ok] An experiment that ran from bachelor's students to professional developers found that every group got significantly further through its task with AI support, and its authors say the differences between groups were not related to experience. [s12 ok] Professionals gained more there than bachelor's students, but each group had tasks suited to its level, and the professionals' were among the most complex. [s13 ok] Then there is a trial of developers who knew their projects deeply: 5 years and 1,500 commits on average in the repositories they worked on. [s14 ok] With AI allowed, these developers were slower, not faster, and its researchers report moderate evidence that they were slowed down more on issues where they had high prior exposure to the task; the developers said AI was particularly helpful on unfamiliar issues and less helpful on familiar ones. [s15 ok] As one developer put it: "if I am the dedicated maintainer of a very specialized part of the codebase, there is no way agent mode can do better than me." [s16 ok] One trial leaned the other way: on a complex task, more senior engineers were, if anything, faster with AI than less senior ones, though that difference was not statistically significant. [s17 ok] Its authors suggest AI may not yet be able to close a skill gap on a task that complex. [s18 ok] That leaves the other half of the belief: that using these tools well is a skill of its own, and the skilled pull ahead. Among those deeply experienced developers, the slowdown broadly did not shrink with up to 50 hours of Cursor experience, counting the hours they reported from before the study. [s20 ok] One developer past 50 hours did see a speedup, but when a second developer corrected the experience they had reported, that group's estimate fell from roughly 25 percent faster to roughly 0 percent. [s21 ok] In the trial that leaned toward seniors, run with full-time Googlers, how often people already used AI tools made no significant difference to their speed with AI; among the possible reasons its authors offer are too little statistical power, a low usability floor where the benefits come quickly, and one feature needing prompting skills that may not be universal yet. [s22 ok] The clearest sign that tool skill matters comes from a maintainability trial: the more practised the original developer was with AI, the better the code scored on a code-health measure once someone else built on it, though that developer's proficiency in Java mattered even more. [s23 ok] So across these trials, nothing shows AI multiplying experts far more than novices: several leaned toward the less experienced, though the field experiments' gaps were noisy and not significant and another trial's result awaits further studies, and the one hint the other way was not significant either. [s24 ok] What runs through them is how much the developer already knew: the tool helped more for short-tenure developers in one trial and on unfamiliar issues in another, and helped less for maintainers on tasks they knew well. [s25 ok] But how can a tool that writes code for you leave an expert slower on work they know best?

## Why can AI assistance cost experts more time than it saves?

Back with those maintainers, the answer starts with how often they took what the tool offered: they accepted fewer than 44 percent of Cursor's generations. [s27 ok] When they turned one down, they reprompted or gave up, and the researchers saw significant time wasted reviewing, testing or modifying code before rejecting it. [s28 ok] Even accepted code cost time: 75 percent said they read every line the AI wrote, and 56 percent said they often had to make major changes to clean it up. [s29 ok] Engineers deciding when to hand work to Claude described the same trade; for a task under 10 minutes, one said, "I'm probably not going to bother using Claude." [s30 ok] Another described a cold start: their team's codebase holds knowledge Claude does not have by default, so rather than iterate on the perfect prompt, "I'm just going to go and do it myself." [s31 ok] The same limit shows up at larger scale: in one company's AI-assisted migration of 5,359 files, the bottleneck was how fast engineers could review the changes, so the team deliberately capped how many changes it generated each week. [s32 ok] A review of what has been written about vibe coding names its central risk a verification gap: code generated faster than developers and their processes can verify its correctness, security and provenance. [s33 ok] Its authors suggest that skill in verification, constraint specification and review may matter as much as skill in writing code. [s34 ok] And the study of engineers using Claude names the catch, a "paradox of supervision": using Claude effectively requires supervising it, and supervising it requires the very coding skills that may atrophy from overuse. [s35 ok] That checking is part of the price those maintainers paid. [s36 ok]

## Close

So before you hand a task to an assistant, ask yourself how much of it you already know, and how long checking its answer will take. And if you find yourself deleting most of what it writes, point it at the parts that are new to you, and keep enough of the skill to check what it hands back.

## Open issues

- **info** s04 (s04.a) wording (deterministic): Wording differs from the canonical claim; the reviewer confirms the passages entail it.
- **info** s05 (s05.a) wording (deterministic): Wording differs from the canonical claim; the reviewer confirms the passages entail it.

## Evidence by sentence

### s04 (attributed, verified)

> On The Pragmatic Engineer, in an episode about AI at Shopify, it was offered as a maybe: "the AI agents are going to help the best engineers more than the mediocre engineer".

- **s04.a** [verified] In The Pragmatic Engineer episode on AI at Shopify, it was said that AI agents will help the best engineers more than mediocre ones.
  - supported (approved): no direct support, 5 contradicting, 2 qualifying, 1 source statement.
  - info wording: Wording differs from the canonical claim; the reviewer confirms the passages entail it.
  - qualifies (uncited): Google RCT partly 0.3, direct `ai-coding/sources/2410.12944.txt#L490-L505`
    > Google RCT: more senior engineers and those coding 5+ hours/day were faster with AI, but the AI x seniority (p=0.706) and AI x hours interactions were not significant, so 'far more' is unsupported.
  - qualifies (uncited): Anthropic internal study partly 0.3, direct `ai-coding/sources/anthropic-work-at-anthropic.txt#L75-L75`
    > Anthropic: experience is needed to spot subtly dangerous Claude proposals, yet a senior engineer says the tools make juniors 'more productive and more bold', so the gain isn't clearly skewed to seniors.
  - contradicts (uncited): METR 2025 RCT wrong 0.6, direct `ai-coding/sources/2507.09089v2.txt#L135-L141`
    > METR 2025 cites prior work finding that AI benefits less-experienced workers more; in its own RCT, highly experienced developers were slowed down, and more so on tasks where they had high prior exposure.
  - contradicts (uncited): Microsoft/Accenture field RCTs wrong 0.5, direct `ai-coding/sources/cui-demirer-copilot-field-experiments.txt#L758-L770`
    > Microsoft experiment: short-tenure developers raised output 27-39% and juniors 21-40%, versus 8-13% for long-tenure and 7-16% for seniors (directionally consistent, mostly not significant), the opposite of AI amplifying experienced engineers more.
  - contradicts (uncited): Shan et al. field study + RCT wrong 0.45, direct `ai-coding/sources/4859137.txt#L872-L878`
    > Moderation analysis in the 253-developer RCT: developers with fewer years of experience got the speed benefit and quality was unaffected, so gains concentrated among less-skilled coders, not experienced ones (easy tasks, ChatGPT-3.5 chat, appendix result).
  - contradicts (uncited): Copilot RCT (Peng) wrong 0.4, direct `ai-coding/sources/2302.06590.txt#L221-L225`
    > Copilot RCT heterogeneity analysis: developers with less programming experience benefited more, which the authors highlight as promise for novices (small sample, noisy estimates).
  - contradicts (uncited): Code-ownership experiment (Martin-Lopez) wrong 0.25, direct `ai-coding/sources/More_Code_Less_Understanding_On_the_Impact_of_AI_Assistants_on_Developers_Productivity_and_Code_Ownership.txt#L556-L569`
    > Every group, BSc students included, gained significantly in completeness, and the authors say differences between groups were not related to experience. Professionals gained the most, but they had different tasks, and position is confounded with task and language.
  - statement: How AI is changing software engineering at Shopify with Farhan Thawar  `u-3IILWQPRM`
    > the AI agents are going to help the best engineers more than the mediocre engineer
  - quotation: "the AI agents are going to help the best engineers more than the mediocre engineer" from `u-3IILWQPRM`

### s05 (attributed, verified)

> On the same show, Simon Willison said that with these tools he will "run circles around somebody who's never written a code line of code in their life".

- **s05.a** [verified] Simon Willison said that combining his programming knowledge with these tools lets him run circles around someone who has never written code.
  - supported (approved): no direct support, 5 contradicting, 2 qualifying, 1 source statement. modality: universal.
  - info wording: Wording differs from the canonical claim; the reviewer confirms the passages entail it.
  - qualifies (uncited): Google RCT partly 0.3, direct `ai-coding/sources/2410.12944.txt#L490-L505`
    > Google RCT: more senior engineers and those coding 5+ hours/day were faster with AI, but the AI x seniority (p=0.706) and AI x hours interactions were not significant, so 'far more' is unsupported.
  - qualifies (uncited): Anthropic internal study partly 0.3, direct `ai-coding/sources/anthropic-work-at-anthropic.txt#L75-L75`
    > Anthropic: experience is needed to spot subtly dangerous Claude proposals, yet a senior engineer says the tools make juniors 'more productive and more bold', so the gain isn't clearly skewed to seniors.
  - contradicts (uncited): METR 2025 RCT wrong 0.6, direct `ai-coding/sources/2507.09089v2.txt#L135-L141`
    > METR 2025 cites prior work finding that AI benefits less-experienced workers more; in its own RCT, highly experienced developers were slowed down, and more so on tasks where they had high prior exposure.
  - contradicts (uncited): Microsoft/Accenture field RCTs wrong 0.5, direct `ai-coding/sources/cui-demirer-copilot-field-experiments.txt#L758-L770`
    > Microsoft experiment: short-tenure developers raised output 27-39% and juniors 21-40%, versus 8-13% for long-tenure and 7-16% for seniors (directionally consistent, mostly not significant), the opposite of AI amplifying experienced engineers more.
  - contradicts (uncited): Shan et al. field study + RCT wrong 0.45, direct `ai-coding/sources/4859137.txt#L872-L878`
    > Moderation analysis in the 253-developer RCT: developers with fewer years of experience got the speed benefit and quality was unaffected, so gains concentrated among less-skilled coders, not experienced ones (easy tasks, ChatGPT-3.5 chat, appendix result).
  - contradicts (uncited): Copilot RCT (Peng) wrong 0.4, direct `ai-coding/sources/2302.06590.txt#L221-L225`
    > Copilot RCT heterogeneity analysis: developers with less programming experience benefited more, which the authors highlight as promise for novices (small sample, noisy estimates).
  - contradicts (uncited): Code-ownership experiment (Martin-Lopez) wrong 0.25, direct `ai-coding/sources/More_Code_Less_Understanding_On_the_Impact_of_AI_Assistants_on_Developers_Productivity_and_Code_Ownership.txt#L556-L569`
    > Every group, BSc students included, gained significantly in completeness, and the authors say differences between groups were not related to experience. Professionals gained the most, but they had different tasks, and position is confounded with task and language.
  - statement: AI tools for software engineers, but without the hype – with Simon Willison (Co-Creator of Django)  `uRuLgar5XZw`
    > when I combine it with these tools I will run circles around somebody who's never written a code line of code in their life
  - quotation: "run circles around somebody who's never written a code line of code in their life" from `uRuLgar5XZw`

### s07 (factual, verified)

> In field experiments that gave developers the coding assistant Copilot, short-tenure developers raised their output by 27 to 39 percent, while long-tenure developers gained 8 to 13 percent.

- **s07.a** [verified] In the Copilot field experiments, short-tenure developers increased output by 27% to 39% while long-tenure developers gained 8% to 13%.
  - qualified (qualify): 1 supporting (1 independent, strongest 0.5), 3 qualifying.
  - warning needs-qualification: METR 2025 RCT: METR 2025 cites prior work finding that AI benefits less-experienced workers more; in its own RCT, highly experienced developers were slowed down, and more so on tasks where they had high prior exposure. [partial: METR's own trial had only experienced developers; the comparison with novices comes from prior work it cites] Google RCT: Google RCT: more senior engineers and those coding 5+ hours/day were faster with AI, but the AI x seniority (p=0.706) and AI x hours interactions were not significant, so 'far more' is unsupported. Anthropic internal study: Anthropic: experience is needed to spot subtly dangerous Claude proposals, yet a senior engineer says the tools make juniors 'more productive and more bold', so the gain isn't clearly skewed to seniors. Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: Microsoft/Accenture field RCTs wrong 0.5, direct `ai-coding/sources/cui-demirer-copilot-field-experiments.txt#L758-L770`
    > Moving on towards output measures in Figure 6, we see that the productivity-enhancing effects of Copilot are stronger for lower tenure and more junior developers. While our estimates are noisy and not statistically significant at conventional levels, the pattern is the same across all three main outcome measures: short…
  - qualifies (uncited): METR 2025 RCT wrong 0.6, partial `ai-coding/sources/2507.09089v2.txt#L135-L141`
    > METR 2025 cites prior work finding that AI benefits less-experienced workers more; in its own RCT, highly experienced developers were slowed down, and more so on tasks where they had high prior exposure.
  - qualifies (uncited): Google RCT partly 0.3, direct `ai-coding/sources/2410.12944.txt#L490-L505`
    > Google RCT: more senior engineers and those coding 5+ hours/day were faster with AI, but the AI x seniority (p=0.706) and AI x hours interactions were not significant, so 'far more' is unsupported.
  - qualifies (uncited): Anthropic internal study partly 0.3, direct `ai-coding/sources/anthropic-work-at-anthropic.txt#L75-L75`
    > Anthropic: experience is needed to spot subtly dangerous Claude proposals, yet a senior engineer says the tools make juniors 'more productive and more bold', so the gain isn't clearly skewed to seniors.

### s08 (factual, verified)

> Those estimates are noisy and not statistically significant, but the pattern was the same on all three of the studies' main output measures.

- **s08.a** [verified] The tenure estimates are noisy and not statistically significant at conventional levels, but the pattern is the same across all three main outcome measures.
  - qualified (qualify): 1 supporting (1 independent, strongest 0.5), 3 qualifying. modality: universal.
  - warning needs-qualification: METR 2025 RCT: METR 2025 cites prior work finding that AI benefits less-experienced workers more; in its own RCT, highly experienced developers were slowed down, and more so on tasks where they had high prior exposure. [partial: METR's own trial had only experienced developers; the comparison with novices comes from prior work it cites] Google RCT: Google RCT: more senior engineers and those coding 5+ hours/day were faster with AI, but the AI x seniority (p=0.706) and AI x hours interactions were not significant, so 'far more' is unsupported. Anthropic internal study: Anthropic: experience is needed to spot subtly dangerous Claude proposals, yet a senior engineer says the tools make juniors 'more productive and more bold', so the gain isn't clearly skewed to seniors. Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: Microsoft/Accenture field RCTs wrong 0.5, direct `ai-coding/sources/cui-demirer-copilot-field-experiments.txt#L758-L770`
    > Moving on towards output measures in Figure 6, we see that the productivity-enhancing effects of Copilot are stronger for lower tenure and more junior developers. While our estimates are noisy and not statistically significant at conventional levels, the pattern is the same across all three main outcome measures: short…
  - qualifies (uncited): METR 2025 RCT wrong 0.6, partial `ai-coding/sources/2507.09089v2.txt#L135-L141`
    > METR 2025 cites prior work finding that AI benefits less-experienced workers more; in its own RCT, highly experienced developers were slowed down, and more so on tasks where they had high prior exposure.
  - qualifies (uncited): Google RCT partly 0.3, direct `ai-coding/sources/2410.12944.txt#L490-L505`
    > Google RCT: more senior engineers and those coding 5+ hours/day were faster with AI, but the AI x seniority (p=0.706) and AI x hours interactions were not significant, so 'far more' is unsupported.
  - qualifies (uncited): Anthropic internal study partly 0.3, direct `ai-coding/sources/anthropic-work-at-anthropic.txt#L75-L75`
    > Anthropic: experience is needed to spot subtly dangerous Claude proposals, yet a senior engineer says the tools make juniors 'more productive and more bold', so the gain isn't clearly skewed to seniors.

### s09 (factual, verified)

> The authors note that longer-tenure developers abandoning the tool after a trial may shrink their estimate, yet junior developers, who used it as much as seniors once they had adopted it, still gained more than senior ones.

- **s09.a** [verified] The authors say longer-tenure estimates may be attenuated by developers abandoning the tool after an initial trial, but with no difference in usage between junior and senior developers conditional on adoption, juniors still increased output more than seniors.
  - qualified (qualify): no direct support, 3 qualifying, 2 context only. modality: possibility.
  - warning needs-qualification: METR 2025 RCT: METR 2025 cites prior work finding that AI benefits less-experienced workers more; in its own RCT, highly experienced developers were slowed down, and more so on tasks where they had high prior exposure. [partial: METR's own trial had only experienced developers; the comparison with novices comes from prior work it cites] Google RCT: Google RCT: more senior engineers and those coding 5+ hours/day were faster with AI, but the AI x seniority (p=0.706) and AI x hours interactions were not significant, so 'far more' is unsupported. Anthropic internal study: Anthropic: experience is needed to spot subtly dangerous Claude proposals, yet a senior engineer says the tools make juniors 'more productive and more bold', so the gain isn't clearly skewed to seniors. Context only, Microsoft/Accenture field RCTs (wrong): a population base rate cannot rule out an individual outcome the sentence only says is possible. Context only, Code-ownership experiment (Martin-Lopez) (wrong): a population base rate cannot rule out an individual outcome the sentence only says is possible. Add the qualification: the evidence supports a narrower or weaker statement.
  - qualifies (uncited): METR 2025 RCT wrong 0.6, partial `ai-coding/sources/2507.09089v2.txt#L135-L141`
    > METR 2025 cites prior work finding that AI benefits less-experienced workers more; in its own RCT, highly experienced developers were slowed down, and more so on tasks where they had high prior exposure.
  - qualifies (uncited): Google RCT partly 0.3, direct `ai-coding/sources/2410.12944.txt#L490-L505`
    > Google RCT: more senior engineers and those coding 5+ hours/day were faster with AI, but the AI x seniority (p=0.706) and AI x hours interactions were not significant, so 'far more' is unsupported.
  - qualifies (uncited): Anthropic internal study partly 0.3, direct `ai-coding/sources/anthropic-work-at-anthropic.txt#L75-L75`
    > Anthropic: experience is needed to spot subtly dangerous Claude proposals, yet a senior engineer says the tools make juniors 'more productive and more bold', so the gain isn't clearly skewed to seniors.
  - context: Microsoft/Accenture field RCTs wrong 0.5, contextual `ai-coding/sources/cui-demirer-copilot-field-experiments.txt#L758-L770`
    > Moving on towards output measures in Figure 6, we see that the productivity-enhancing effects of Copilot are stronger for lower tenure and more junior developers. While our estimates are noisy and not statistically significant at conventional levels, the pattern is the same across all three main outcome measures: short…
  - context (uncited): Code-ownership experiment (Martin-Lopez) wrong 0.25, contextual `ai-coding/sources/More_Code_Less_Understanding_On_the_Impact_of_AI_Assistants_on_Developers_Productivity_and_Code_Ownership.txt#L556-L569`
    > Every group, BSc students included, gained significantly in completeness, and the authors say differences between groups were not related to experience. Professionals gained the most, but they had different tasks, and position is confounded with task and language.

### s10 (factual, verified)

> A separate experiment found the same direction: developers with fewer years of experience got the speed benefit from generative AI, while the quality of their code was unaffected.

- **s10.a** [verified] In Shan et al.'s moderation analysis, developers with fewer years of experience benefited in faster coding while coding quality remained unaffected.
  - qualified (qualify): 1 supporting (1 independent, strongest 0.45), 3 qualifying.
  - warning needs-qualification: METR 2025 RCT: METR 2025 cites prior work finding that AI benefits less-experienced workers more; in its own RCT, highly experienced developers were slowed down, and more so on tasks where they had high prior exposure. [partial: METR's own trial had only experienced developers; the comparison with novices comes from prior work it cites] Google RCT: Google RCT: more senior engineers and those coding 5+ hours/day were faster with AI, but the AI x seniority (p=0.706) and AI x hours interactions were not significant, so 'far more' is unsupported. Anthropic internal study: Anthropic: experience is needed to spot subtly dangerous Claude proposals, yet a senior engineer says the tools make juniors 'more productive and more bold', so the gain isn't clearly skewed to seniors. Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: Shan et al. field study + RCT wrong 0.45, direct `ai-coding/sources/4859137.txt#L872-L878`
    > Additionally, we conducted a moderation analysis to examine the impact of generative AI across developers with varying levels of coding experience. As shown in Table E.2 of Online Appendix E, the results indicate that developers with fewer years of experience benefit in terms of faster coding, while coding quality rema…
  - qualifies (uncited): METR 2025 RCT wrong 0.6, partial `ai-coding/sources/2507.09089v2.txt#L135-L141`
    > METR 2025 cites prior work finding that AI benefits less-experienced workers more; in its own RCT, highly experienced developers were slowed down, and more so on tasks where they had high prior exposure.
  - qualifies (uncited): Google RCT partly 0.3, direct `ai-coding/sources/2410.12944.txt#L490-L505`
    > Google RCT: more senior engineers and those coding 5+ hours/day were faster with AI, but the AI x seniority (p=0.706) and AI x hours interactions were not significant, so 'far more' is unsupported.
  - qualifies (uncited): Anthropic internal study partly 0.3, direct `ai-coding/sources/anthropic-work-at-anthropic.txt#L75-L75`
    > Anthropic: experience is needed to spot subtly dangerous Claude proposals, yet a senior engineer says the tools make juniors 'more productive and more bold', so the gain isn't clearly skewed to seniors.

### s11 (factual, verified)

> Another Copilot trial found that less experienced programmers benefited more, and its authors called that promising for people moving into software development, if the result holds up in further studies.

- **s11.a** [verified] Peng et al.'s Copilot trial suggests less experienced programmers benefit more, which the authors say, if it persists in further studies, points to possibilities for job transitions into software development.
  - qualified (qualify): 1 supporting (1 independent, strongest 0.4), 3 qualifying.
  - warning needs-qualification: METR 2025 RCT: METR 2025 cites prior work finding that AI benefits less-experienced workers more; in its own RCT, highly experienced developers were slowed down, and more so on tasks where they had high prior exposure. [partial: METR's own trial had only experienced developers; the comparison with novices comes from prior work it cites] Google RCT: Google RCT: more senior engineers and those coding 5+ hours/day were faster with AI, but the AI x seniority (p=0.706) and AI x hours interactions were not significant, so 'far more' is unsupported. Anthropic internal study: Anthropic: experience is needed to spot subtly dangerous Claude proposals, yet a senior engineer says the tools make juniors 'more productive and more bold', so the gain isn't clearly skewed to seniors. Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: Copilot RCT (Peng) wrong 0.4, direct `ai-coding/sources/2302.06590.txt#L221-L225`
    > The heterogeneous effects identified in this study warrant close attention. Our results sug- gest that less experienced programmers benefit more from Copilot. If this result persists in further studies, the productivity benefits for novice programmers and programmers of older age point to important possibilities for sk…
  - qualifies (uncited): METR 2025 RCT wrong 0.6, partial `ai-coding/sources/2507.09089v2.txt#L135-L141`
    > METR 2025 cites prior work finding that AI benefits less-experienced workers more; in its own RCT, highly experienced developers were slowed down, and more so on tasks where they had high prior exposure.
  - qualifies (uncited): Google RCT partly 0.3, direct `ai-coding/sources/2410.12944.txt#L490-L505`
    > Google RCT: more senior engineers and those coding 5+ hours/day were faster with AI, but the AI x seniority (p=0.706) and AI x hours interactions were not significant, so 'far more' is unsupported.
  - qualifies (uncited): Anthropic internal study partly 0.3, direct `ai-coding/sources/anthropic-work-at-anthropic.txt#L75-L75`
    > Anthropic: experience is needed to spot subtly dangerous Claude proposals, yet a senior engineer says the tools make juniors 'more productive and more bold', so the gain isn't clearly skewed to seniors.

### s12 (factual, verified)

> An experiment that ran from bachelor's students to professional developers found that every group got significantly further through its task with AI support, and its authors say the differences between groups were not related to experience.

- **s12.a** [verified] In the code-ownership experiment, all participant categories (BSc, MSc, Researcher, Professional) had a significant increase in completeness with AI, and differences between categories were not related to their level of experience.
  - qualified (qualify): 1 supporting (1 independent, strongest 0.25), 3 qualifying. modality: universal.
  - warning needs-qualification: METR 2025 RCT: METR 2025 cites prior work finding that AI benefits less-experienced workers more; in its own RCT, highly experienced developers were slowed down, and more so on tasks where they had high prior exposure. [partial: METR's own trial had only experienced developers; the comparison with novices comes from prior work it cites] Google RCT: Google RCT: more senior engineers and those coding 5+ hours/day were faster with AI, but the AI x seniority (p=0.706) and AI x hours interactions were not significant, so 'far more' is unsupported. Anthropic internal study: Anthropic: experience is needed to spot subtly dangerous Claude proposals, yet a senior engineer says the tools make juniors 'more productive and more bold', so the gain isn't clearly skewed to seniors. Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: Code-ownership experiment (Martin-Lopez) wrong 0.25, direct `ai-coding/sources/More_Code_Less_Understanding_On_the_Impact_of_AI_Assistants_on_Developers_Productivity_and_Code_Ownership.txt#L556-L569`
    > It is interesting to see that the overall finding (i.e., positive Task: E2 -9.55 [-38.58, 29.95] 0.178 impact on productivity) is independent from the category of Task: D3 -4.32 [-41.32, 27.28] 0.604 participants (i.e., BSc, MSc, Researcher, Professional): All of Task: E3 -7.02 [-60.26, 11.38] 0.007 them experienced a …
  - qualifies (uncited): METR 2025 RCT wrong 0.6, partial `ai-coding/sources/2507.09089v2.txt#L135-L141`
    > METR 2025 cites prior work finding that AI benefits less-experienced workers more; in its own RCT, highly experienced developers were slowed down, and more so on tasks where they had high prior exposure.
  - qualifies (uncited): Google RCT partly 0.3, direct `ai-coding/sources/2410.12944.txt#L490-L505`
    > Google RCT: more senior engineers and those coding 5+ hours/day were faster with AI, but the AI x seniority (p=0.706) and AI x hours interactions were not significant, so 'far more' is unsupported.
  - qualifies (uncited): Anthropic internal study partly 0.3, direct `ai-coding/sources/anthropic-work-at-anthropic.txt#L75-L75`
    > Anthropic: experience is needed to spot subtly dangerous Claude proposals, yet a senior engineer says the tools make juniors 'more productive and more bold', so the gain isn't clearly skewed to seniors.

### s13 (factual, verified)

> Professionals gained more there than bachelor's students, but each group had tasks suited to its level, and the professionals' were among the most complex.

- **s13.a** [verified] Professional developers benefited more than BSc students, but each category got tasks suited to its level, with researchers and professionals given the most complex tasks.
  - qualified (qualify): 1 supporting (1 independent, strongest 0.25), 3 qualifying. modality: typical.
  - warning needs-qualification: METR 2025 RCT: METR 2025 cites prior work finding that AI benefits less-experienced workers more; in its own RCT, highly experienced developers were slowed down, and more so on tasks where they had high prior exposure. [partial: METR's own trial had only experienced developers; the comparison with novices comes from prior work it cites] Google RCT: Google RCT: more senior engineers and those coding 5+ hours/day were faster with AI, but the AI x seniority (p=0.706) and AI x hours interactions were not significant, so 'far more' is unsupported. Anthropic internal study: Anthropic: experience is needed to spot subtly dangerous Claude proposals, yet a senior engineer says the tools make juniors 'more productive and more bold', so the gain isn't clearly skewed to seniors. Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: Code-ownership experiment (Martin-Lopez) wrong 0.25, direct `ai-coding/sources/More_Code_Less_Understanding_On_the_Impact_of_AI_Assistants_on_Developers_Productivity_and_Code_Ownership.txt#L556-L569`
    > It is interesting to see that the overall finding (i.e., positive Task: E2 -9.55 [-38.58, 29.95] 0.178 impact on productivity) is independent from the category of Task: D3 -4.32 [-41.32, 27.28] 0.604 participants (i.e., BSc, MSc, Researcher, Professional): All of Task: E3 -7.02 [-60.26, 11.38] 0.007 them experienced a …
  - qualifies (uncited): METR 2025 RCT wrong 0.6, partial `ai-coding/sources/2507.09089v2.txt#L135-L141`
    > METR 2025 cites prior work finding that AI benefits less-experienced workers more; in its own RCT, highly experienced developers were slowed down, and more so on tasks where they had high prior exposure.
  - qualifies (uncited): Google RCT partly 0.3, direct `ai-coding/sources/2410.12944.txt#L490-L505`
    > Google RCT: more senior engineers and those coding 5+ hours/day were faster with AI, but the AI x seniority (p=0.706) and AI x hours interactions were not significant, so 'far more' is unsupported.
  - qualifies (uncited): Anthropic internal study partly 0.3, direct `ai-coding/sources/anthropic-work-at-anthropic.txt#L75-L75`
    > Anthropic: experience is needed to spot subtly dangerous Claude proposals, yet a senior engineer says the tools make juniors 'more productive and more bold', so the gain isn't clearly skewed to seniors.

### s14 (factual, verified)

> Then there is a trial of developers who knew their projects deeply: 5 years and 1,500 commits on average in the repositories they worked on.

- **s14.a** [verified] METR's developers had on average 5 years and 1,500 commits of experience on their respective repositories.
  - disputed (qualify): 1 supporting (1 independent, strongest 0.6), 1 contradicting, 5 qualifying. modality: typical.
  - warning needs-qualification: Contradicted by Google RCT: Google RCT on code unfamiliar to all participants found, if anything, more senior engineers gained more from AI (non-significant interaction), contrary to gains concentrating among less experienced developers. Present the disagreement: name the studies on each side instead of stating one side as fact.
  - supports: METR 2025 RCT right 0.6, direct `ai-coding/sources/2507.09089v2.txt#L960-L984`
    > pleted in the study--this is why we have a smaller number of issues for our baseline slowdown estimate. See Section D.4 for details on how we estimate heterogeneous treatment effects. Qualitatively, developers note that AI is particularly helpful when working on unfamiliar issues, and less helpful when working on famil…
  - qualifies (uncited): Microsoft/Accenture field RCTs partly 0.45, direct `ai-coding/sources/cui-demirer-copilot-field-experiments.txt#L758-L770`
    > Microsoft experiment: gains were larger for short-tenure (newer to the company and its code) and junior developers (27-39% vs 8-13%), but differences were not significant and the routine-code half of the claim was not tested.
  - qualifies (uncited): Copilot RCT (Peng) partly 0.4, direct `ai-coding/sources/2302.06590.txt#L174-L177`
    > Copilot RCT: less experienced developers benefited more on a routine, well-trodden task (a basic HTTP server), consistent with the claim but from a small freelancer sample and without a codebase-familiarity test.
  - qualifies (uncited): Anthropic internal study partly 0.4, partial `ai-coding/sources/anthropic-work-at-anthropic.txt#L70-L70`
    > Anthropic: staff delegate where they have low context and complexity is low, and avoid tasks needing tacit codebase knowledge, which mirrors METR's slowdown factors; this concerns task choice rather than measured gains.
  - qualifies (uncited): Shan et al. field study + RCT partly 0.35, direct `ai-coding/sources/4859137.txt#L872-L878`
    > Less-experienced developers gained more speed in the RCT, consistent with the claim, but a follow-up on harder APPS tasks suggested quantity gains were larger on complex tasks (0.283 vs 0.245), which does not fit 'routine code only'.
  - qualifies (uncited): Code-ownership experiment (Martin-Lopez) partly 0.3, direct `ai-coding/sources/More_Code_Less_Understanding_On_the_Impact_of_AI_Assistants_on_Developers_Productivity_and_Code_Ownership.txt#L240-L247`
    > Large completeness gains (+43 points) came on small, popular-domain tasks chosen so that LLMs could help, many of them greenfield. This fits gains on routine code, but the study had no mature codebases to compare against.
  - contradicts (uncited): Google RCT wrong 0.25, direct `ai-coding/sources/2410.12944.txt#L490-L505`
    > Google RCT on code unfamiliar to all participants found, if anything, more senior engineers gained more from AI (non-significant interaction), contrary to gains concentrating among less experienced developers.

### s15 (factual, verified)

> With AI allowed, these developers were slower, not faster, and its researchers report moderate evidence that they were slowed down more on issues where they had high prior exposure to the task; the developers said AI was particularly helpful on unfamiliar issues and less helpful on familiar ones.

- **s15.a** [verified] AI helped METR's developers less than in existing literature, with a baseline slowdown estimate, and METR presents moderate evidence that developers are slowed down more when they have high prior task exposure.
  - disputed (qualify): 1 supporting (1 independent, strongest 0.6), 1 contradicting, 5 qualifying.
  - warning needs-qualification: Contradicted by Google RCT: Google RCT on code unfamiliar to all participants found, if anything, more senior engineers gained more from AI (non-significant interaction), contrary to gains concentrating among less experienced developers. Present the disagreement: name the studies on each side instead of stating one side as fact.
  - supports: METR 2025 RCT right 0.6, direct `ai-coding/sources/2507.09089v2.txt#L960-L984`
    > pleted in the study--this is why we have a smaller number of issues for our baseline slowdown estimate. See Section D.4 for details on how we estimate heterogeneous treatment effects. Qualitatively, developers note that AI is particularly helpful when working on unfamiliar issues, and less helpful when working on famil…
  - qualifies (uncited): Microsoft/Accenture field RCTs partly 0.45, direct `ai-coding/sources/cui-demirer-copilot-field-experiments.txt#L758-L770`
    > Microsoft experiment: gains were larger for short-tenure (newer to the company and its code) and junior developers (27-39% vs 8-13%), but differences were not significant and the routine-code half of the claim was not tested.
  - qualifies (uncited): Copilot RCT (Peng) partly 0.4, direct `ai-coding/sources/2302.06590.txt#L174-L177`
    > Copilot RCT: less experienced developers benefited more on a routine, well-trodden task (a basic HTTP server), consistent with the claim but from a small freelancer sample and without a codebase-familiarity test.
  - qualifies (uncited): Anthropic internal study partly 0.4, partial `ai-coding/sources/anthropic-work-at-anthropic.txt#L70-L70`
    > Anthropic: staff delegate where they have low context and complexity is low, and avoid tasks needing tacit codebase knowledge, which mirrors METR's slowdown factors; this concerns task choice rather than measured gains.
  - qualifies (uncited): Shan et al. field study + RCT partly 0.35, direct `ai-coding/sources/4859137.txt#L872-L878`
    > Less-experienced developers gained more speed in the RCT, consistent with the claim, but a follow-up on harder APPS tasks suggested quantity gains were larger on complex tasks (0.283 vs 0.245), which does not fit 'routine code only'.
  - qualifies (uncited): Code-ownership experiment (Martin-Lopez) partly 0.3, direct `ai-coding/sources/More_Code_Less_Understanding_On_the_Impact_of_AI_Assistants_on_Developers_Productivity_and_Code_Ownership.txt#L240-L247`
    > Large completeness gains (+43 points) came on small, popular-domain tasks chosen so that LLMs could help, many of them greenfield. This fits gains on routine code, but the study had no mature codebases to compare against.
  - contradicts (uncited): Google RCT wrong 0.25, direct `ai-coding/sources/2410.12944.txt#L490-L505`
    > Google RCT on code unfamiliar to all participants found, if anything, more senior engineers gained more from AI (non-significant interaction), contrary to gains concentrating among less experienced developers.
- **s15.b** [verified] Qualitatively, METR's developers note that AI is particularly helpful on unfamiliar issues and less helpful on familiar ones.
  - disputed (qualify): 1 supporting (1 independent, strongest 0.6), 1 contradicting, 5 qualifying.
  - warning needs-qualification: Contradicted by Google RCT: Google RCT on code unfamiliar to all participants found, if anything, more senior engineers gained more from AI (non-significant interaction), contrary to gains concentrating among less experienced developers. Present the disagreement: name the studies on each side instead of stating one side as fact.
  - supports: METR 2025 RCT right 0.6, direct `ai-coding/sources/2507.09089v2.txt#L960-L984`
    > pleted in the study--this is why we have a smaller number of issues for our baseline slowdown estimate. See Section D.4 for details on how we estimate heterogeneous treatment effects. Qualitatively, developers note that AI is particularly helpful when working on unfamiliar issues, and less helpful when working on famil…
  - qualifies (uncited): Microsoft/Accenture field RCTs partly 0.45, direct `ai-coding/sources/cui-demirer-copilot-field-experiments.txt#L758-L770`
    > Microsoft experiment: gains were larger for short-tenure (newer to the company and its code) and junior developers (27-39% vs 8-13%), but differences were not significant and the routine-code half of the claim was not tested.
  - qualifies (uncited): Copilot RCT (Peng) partly 0.4, direct `ai-coding/sources/2302.06590.txt#L174-L177`
    > Copilot RCT: less experienced developers benefited more on a routine, well-trodden task (a basic HTTP server), consistent with the claim but from a small freelancer sample and without a codebase-familiarity test.
  - qualifies (uncited): Anthropic internal study partly 0.4, partial `ai-coding/sources/anthropic-work-at-anthropic.txt#L70-L70`
    > Anthropic: staff delegate where they have low context and complexity is low, and avoid tasks needing tacit codebase knowledge, which mirrors METR's slowdown factors; this concerns task choice rather than measured gains.
  - qualifies (uncited): Shan et al. field study + RCT partly 0.35, direct `ai-coding/sources/4859137.txt#L872-L878`
    > Less-experienced developers gained more speed in the RCT, consistent with the claim, but a follow-up on harder APPS tasks suggested quantity gains were larger on complex tasks (0.283 vs 0.245), which does not fit 'routine code only'.
  - qualifies (uncited): Code-ownership experiment (Martin-Lopez) partly 0.3, direct `ai-coding/sources/More_Code_Less_Understanding_On_the_Impact_of_AI_Assistants_on_Developers_Productivity_and_Code_Ownership.txt#L240-L247`
    > Large completeness gains (+43 points) came on small, popular-domain tasks chosen so that LLMs could help, many of them greenfield. This fits gains on routine code, but the study had no mature codebases to compare against.
  - contradicts (uncited): Google RCT wrong 0.25, direct `ai-coding/sources/2410.12944.txt#L490-L505`
    > Google RCT on code unfamiliar to all participants found, if anything, more senior engineers gained more from AI (non-significant interaction), contrary to gains concentrating among less experienced developers.

### s16 (factual, verified)

> As one developer put it: "if I am the dedicated maintainer of a very specialized part of the codebase, there is no way agent mode can do better than me."

- **s16.a** [verified] One METR developer said that as the dedicated maintainer of a very specialized part of the codebase, agent mode could not do better than them.
  - disputed (qualify): 1 supporting (1 independent, strongest 0.6), 1 contradicting, 5 qualifying. modality: possibility.
  - warning needs-qualification: Contradicted by Google RCT: Google RCT on code unfamiliar to all participants found, if anything, more senior engineers gained more from AI (non-significant interaction), contrary to gains concentrating among less experienced developers. Present the disagreement: name the studies on each side instead of stating one side as fact.
  - supports: METR 2025 RCT right 0.6, direct `ai-coding/sources/2507.09089v2.txt#L960-L984`
    > pleted in the study--this is why we have a smaller number of issues for our baseline slowdown estimate. See Section D.4 for details on how we estimate heterogeneous treatment effects. Qualitatively, developers note that AI is particularly helpful when working on unfamiliar issues, and less helpful when working on famil…
  - qualifies (uncited): Microsoft/Accenture field RCTs partly 0.45, direct `ai-coding/sources/cui-demirer-copilot-field-experiments.txt#L758-L770`
    > Microsoft experiment: gains were larger for short-tenure (newer to the company and its code) and junior developers (27-39% vs 8-13%), but differences were not significant and the routine-code half of the claim was not tested.
  - qualifies (uncited): Copilot RCT (Peng) partly 0.4, direct `ai-coding/sources/2302.06590.txt#L174-L177`
    > Copilot RCT: less experienced developers benefited more on a routine, well-trodden task (a basic HTTP server), consistent with the claim but from a small freelancer sample and without a codebase-familiarity test.
  - qualifies (uncited): Anthropic internal study partly 0.4, partial `ai-coding/sources/anthropic-work-at-anthropic.txt#L70-L70`
    > Anthropic: staff delegate where they have low context and complexity is low, and avoid tasks needing tacit codebase knowledge, which mirrors METR's slowdown factors; this concerns task choice rather than measured gains.
  - qualifies (uncited): Shan et al. field study + RCT partly 0.35, direct `ai-coding/sources/4859137.txt#L872-L878`
    > Less-experienced developers gained more speed in the RCT, consistent with the claim, but a follow-up on harder APPS tasks suggested quantity gains were larger on complex tasks (0.283 vs 0.245), which does not fit 'routine code only'.
  - qualifies (uncited): Code-ownership experiment (Martin-Lopez) partly 0.3, direct `ai-coding/sources/More_Code_Less_Understanding_On_the_Impact_of_AI_Assistants_on_Developers_Productivity_and_Code_Ownership.txt#L240-L247`
    > Large completeness gains (+43 points) came on small, popular-domain tasks chosen so that LLMs could help, many of them greenfield. This fits gains on routine code, but the study had no mature codebases to compare against.
  - contradicts (uncited): Google RCT wrong 0.25, direct `ai-coding/sources/2410.12944.txt#L490-L505`
    > Google RCT on code unfamiliar to all participants found, if anything, more senior engineers gained more from AI (non-significant interaction), contrary to gains concentrating among less experienced developers.
  - quotation: "if I am the dedicated maintainer of a very specialized part of the codebase, there is no way agent mode can do better than me." from `ai-coding/sources/2507.09089v2.txt#L960-L984`

### s17 (factual, verified)

> One trial leaned the other way: on a complex task, more senior engineers were, if anything, faster with AI than less senior ones, though that difference was not statistically significant.

- **s17.a** [verified] In the Google trial on a complex task, the AI x seniority interaction was negative, suggesting more senior participants were faster with AI, but not statistically significant.
  - qualified (qualify): no direct support, 3 qualifying.
  - warning needs-qualification: Google RCT: Google RCT: more senior engineers and those coding 5+ hours/day were faster with AI, but the AI x seniority (p=0.706) and AI x hours interactions were not significant, so 'far more' is unsupported. Add the qualification: the evidence supports a narrower or weaker statement.
  - qualifies: Google RCT partly 0.3, direct `ai-coding/sources/2410.12944.txt#L490-L505`
    > The interaction between experimental condition and se- (p = 0.018). This might be because our current AI tools niority was not statistically significant (model not shown; require that developers spend a lot of time verifying and p = 0.706), but it was negative, suggesting that participants in editing code generated by …
  - qualifies (uncited): METR 2025 RCT wrong 0.6, partial `ai-coding/sources/2507.09089v2.txt#L135-L141`
    > METR 2025 cites prior work finding that AI benefits less-experienced workers more; in its own RCT, highly experienced developers were slowed down, and more so on tasks where they had high prior exposure.
  - qualifies (uncited): Anthropic internal study partly 0.3, direct `ai-coding/sources/anthropic-work-at-anthropic.txt#L75-L75`
    > Anthropic: experience is needed to spot subtly dangerous Claude proposals, yet a senior engineer says the tools make juniors 'more productive and more bold', so the gain isn't clearly skewed to seniors.

### s18 (factual, verified)

> Its authors suggest AI may not yet be able to close a skill gap on a task that complex.

- **s18.a** [verified] The Google trial's authors believe this may be because AI is not yet able to close a skill gap on complex tasks like the one they tested.
  - qualified (qualify): no direct support, 3 qualifying, 2 context only. modality: possibility.
  - warning needs-qualification: Google RCT: Google RCT: more senior engineers and those coding 5+ hours/day were faster with AI, but the AI x seniority (p=0.706) and AI x hours interactions were not significant, so 'far more' is unsupported. Add the qualification: the evidence supports a narrower or weaker statement.
  - qualifies: Google RCT partly 0.3, direct `ai-coding/sources/2410.12944.txt#L490-L505`
    > The interaction between experimental condition and se- (p = 0.018). This might be because our current AI tools niority was not statistically significant (model not shown; require that developers spend a lot of time verifying and p = 0.706), but it was negative, suggesting that participants in editing code generated by …
  - qualifies (uncited): METR 2025 RCT wrong 0.6, partial `ai-coding/sources/2507.09089v2.txt#L135-L141`
    > METR 2025 cites prior work finding that AI benefits less-experienced workers more; in its own RCT, highly experienced developers were slowed down, and more so on tasks where they had high prior exposure.
  - qualifies (uncited): Anthropic internal study partly 0.3, direct `ai-coding/sources/anthropic-work-at-anthropic.txt#L75-L75`
    > Anthropic: experience is needed to spot subtly dangerous Claude proposals, yet a senior engineer says the tools make juniors 'more productive and more bold', so the gain isn't clearly skewed to seniors.
  - context (uncited): Microsoft/Accenture field RCTs wrong 0.5, contextual `ai-coding/sources/cui-demirer-copilot-field-experiments.txt#L758-L770`
    > Microsoft experiment: short-tenure developers raised output 27-39% and juniors 21-40%, versus 8-13% for long-tenure and 7-16% for seniors (directionally consistent, mostly not significant), the opposite of AI amplifying experienced engineers more.
  - context (uncited): Code-ownership experiment (Martin-Lopez) wrong 0.25, contextual `ai-coding/sources/More_Code_Less_Understanding_On_the_Impact_of_AI_Assistants_on_Developers_Productivity_and_Code_Ownership.txt#L556-L569`
    > Every group, BSc students included, gained significantly in completeness, and the authors say differences between groups were not related to experience. Professionals gained the most, but they had different tasks, and position is confounded with task and language.

### s20 (factual, verified)

> Among those deeply experienced developers, the slowdown broadly did not shrink with up to 50 hours of Cursor experience, counting the hours they reported from before the study.

- **s20.a** [verified] Up to 50 hours of Cursor experience (self-reported prior hours plus hours in the study), more experience broadly did not reduce METR's slowdown effect.
  - qualified (qualify): no direct support, 7 qualifying.
  - warning needs-qualification: METR 2025 RCT: METR RCT: speedup did not improve over the first 50 hours of Cursor use, and the lone >50h developer's speedup (~25%) fell to ~0% once a second developer's misreported experience was corrected. The 'high skill ceiling' idea is plausible but underpowered. Add the qualification: the evidence supports a narrower or weaker statement.
  - qualifies: METR 2025 RCT partly 0.35, direct `ai-coding/sources/2507.09089v2.txt#L1217-L1234`
    > We further check if developers appear to get better at using AI over the course of the experiment (Figure 11). There does not appear to be a meaningful difference in slowdown when excluding up to the first eight AI-allowed issues each developer completes. This is evidence against the hypothesis that slowdown is caused …
  - qualifies (uncited): Echoes of AI maintainability RCT right 0.5, partial `ai-coding/sources/2507.00788.txt#L2541-L2551`
    > Bayesian analysis: the more AI-skilled the original developer, the larger the downstream CodeHealth benefit (+0.10, about half an SD, for habitual users). The authors conclude developers vary in their ability to use AI well, though Java proficiency mattered even more.
  - qualifies (uncited): Google RCT partly 0.4, direct `ai-coding/sources/2410.12944.txt#L522-L543`
    > Google RCT, 96 engineers: senior and heavy-coding developers were tentatively faster with AI and natural-language-to-code needs prompting skill, but how often people already used AI tools had no significant effect on their AI speed-up, so the authors point to a 'low usability floor'.
  - qualifies (uncited): Anthropic internal study partly 0.4, direct `ai-coding/sources/anthropic-work-at-anthropic.txt#L36-L40`
    > Anthropic survey (n=132): time-savings responses cluster at opposite ends, with some spending more time debugging AI code; authors attribute gains to learned 'strategic delegation skills' and task choice, supporting wide variation by user practice.
  - qualifies (uncited): Shan et al. field study + RCT partly 0.4, direct `ai-coding/sources/4859137.txt#L1037-L1064`
    > Results depended on how developers used ChatGPT: direct acceptance raised output but not accuracy, while ideation, improvement and debugging raised accuracy, and debugging lowered output. Outcomes vary with usage style, but usage was self-chosen, so the evidence is correlational.
  - qualifies (uncited): Microsoft/Accenture field RCTs partly 0.35, direct `ai-coding/sources/cui-demirer-copilot-field-experiments.txt#L758-L770`
    > Field RCTs, ~4,900 developers: Copilot gains varied with experience, but in the opposite direction from 'skill needed'. Short-tenure and junior developers gained 21-40% while senior and long-tenure developers gained 7-16% (noisy, not significant).
  - qualifies (uncited): Vibe-coding literature review right 0.3, partial `ai-coding/sources/2607.21652v1.txt#L1518-L1526`
    > Vibe-coding MLR (47 sources, mention counts): quality, maintainability and productivity outcomes are described as conditional on developer expertise, task complexity and verification practice, and outcome claims vary substantially by user expertise.
  - inconclusive (uncited): Code-ownership experiment (Martin-Lopez) unknown, direct `ai-coding/sources/More_Code_Less_Understanding_On_the_Impact_of_AI_Assistants_on_Developers_Productivity_and_Code_Ownership.txt#L828-L835`
    > Gains appeared in every experience group, but the authors state they cannot separate experience effects from task and language effects, so the study cannot say whether outcomes depend on user expertise.

### s21 (factual, verified)

> One developer past 50 hours did see a speedup, but when a second developer corrected the experience they had reported, that group's estimate fell from roughly 25 percent faster to roughly 0 percent.

- **s21.a** [verified] METR saw a speedup for the one developer with more than 50 hours of Cursor experience, but after a second developer corrected their reported experience, the over-50-hours bucket moved from roughly 25% speedup to roughly 0%.
  - qualified (qualify): no direct support, 7 qualifying.
  - warning needs-qualification: METR 2025 RCT: METR RCT: speedup did not improve over the first 50 hours of Cursor use, and the lone >50h developer's speedup (~25%) fell to ~0% once a second developer's misreported experience was corrected. The 'high skill ceiling' idea is plausible but underpowered. Add the qualification: the evidence supports a narrower or weaker statement.
  - qualifies: METR 2025 RCT partly 0.35, direct `ai-coding/sources/2507.09089v2.txt#L1217-L1234`
    > We further check if developers appear to get better at using AI over the course of the experiment (Figure 11). There does not appear to be a meaningful difference in slowdown when excluding up to the first eight AI-allowed issues each developer completes. This is evidence against the hypothesis that slowdown is caused …
  - qualifies (uncited): Echoes of AI maintainability RCT right 0.5, partial `ai-coding/sources/2507.00788.txt#L2541-L2551`
    > Bayesian analysis: the more AI-skilled the original developer, the larger the downstream CodeHealth benefit (+0.10, about half an SD, for habitual users). The authors conclude developers vary in their ability to use AI well, though Java proficiency mattered even more.
  - qualifies (uncited): Google RCT partly 0.4, direct `ai-coding/sources/2410.12944.txt#L522-L543`
    > Google RCT, 96 engineers: senior and heavy-coding developers were tentatively faster with AI and natural-language-to-code needs prompting skill, but how often people already used AI tools had no significant effect on their AI speed-up, so the authors point to a 'low usability floor'.
  - qualifies (uncited): Anthropic internal study partly 0.4, direct `ai-coding/sources/anthropic-work-at-anthropic.txt#L36-L40`
    > Anthropic survey (n=132): time-savings responses cluster at opposite ends, with some spending more time debugging AI code; authors attribute gains to learned 'strategic delegation skills' and task choice, supporting wide variation by user practice.
  - qualifies (uncited): Shan et al. field study + RCT partly 0.4, direct `ai-coding/sources/4859137.txt#L1037-L1064`
    > Results depended on how developers used ChatGPT: direct acceptance raised output but not accuracy, while ideation, improvement and debugging raised accuracy, and debugging lowered output. Outcomes vary with usage style, but usage was self-chosen, so the evidence is correlational.
  - qualifies (uncited): Microsoft/Accenture field RCTs partly 0.35, direct `ai-coding/sources/cui-demirer-copilot-field-experiments.txt#L758-L770`
    > Field RCTs, ~4,900 developers: Copilot gains varied with experience, but in the opposite direction from 'skill needed'. Short-tenure and junior developers gained 21-40% while senior and long-tenure developers gained 7-16% (noisy, not significant).
  - qualifies (uncited): Vibe-coding literature review right 0.3, partial `ai-coding/sources/2607.21652v1.txt#L1518-L1526`
    > Vibe-coding MLR (47 sources, mention counts): quality, maintainability and productivity outcomes are described as conditional on developer expertise, task complexity and verification practice, and outcome claims vary substantially by user expertise.
  - inconclusive (uncited): Code-ownership experiment (Martin-Lopez) unknown, direct `ai-coding/sources/More_Code_Less_Understanding_On_the_Impact_of_AI_Assistants_on_Developers_Productivity_and_Code_Ownership.txt#L828-L835`
    > Gains appeared in every experience group, but the authors state they cannot separate experience effects from task and language effects, so the study cannot say whether outcomes depend on user expertise.

### s22 (factual, verified)

> In the trial that leaned toward seniors, run with full-time Googlers, how often people already used AI tools made no significant difference to their speed with AI; among the possible reasons its authors offer are too little statistical power, a low usability floor where the benefits come quickly, and one feature needing prompting skills that may not be universal yet.

- **s22.a** [verified] The Google trial, which sampled only full-time Googlers, found no statistically significant evidence that more frequent prior use of AI coding tools increased speed with AI; the authors list inadequate statistical power, a low usability floor (benefits accruing quickly), and Natural Language to Code requiring familiarity with LLMs and prompting, skills which might not be universal at this time, among possible reasons.
  - qualified (qualify): no direct support, 7 qualifying. modality: possibility.
  - warning needs-qualification: Google RCT: Google RCT, 96 engineers: senior and heavy-coding developers were tentatively faster with AI and natural-language-to-code needs prompting skill, but how often people already used AI tools had no significant effect on their AI speed-up, so the authors point to a 'low usability floor'. Add the qualification: the evidence supports a narrower or weaker statement.
  - qualifies: Google RCT partly 0.4, direct `ai-coding/sources/2410.12944.txt#L522-L543`
    > we estimate a roughly 21% increase in development speed We found no statistically significant evidence that more attributable to AI, controlling for other important predictors frequent use of AI coding tools in participants' software (i.e. the effect attributable to AI in our best-fit model, Model development workflow …
  - qualifies (uncited): Echoes of AI maintainability RCT right 0.5, partial `ai-coding/sources/2507.00788.txt#L2541-L2551`
    > Bayesian analysis: the more AI-skilled the original developer, the larger the downstream CodeHealth benefit (+0.10, about half an SD, for habitual users). The authors conclude developers vary in their ability to use AI well, though Java proficiency mattered even more.
  - qualifies (uncited): Anthropic internal study partly 0.4, direct `ai-coding/sources/anthropic-work-at-anthropic.txt#L36-L40`
    > Anthropic survey (n=132): time-savings responses cluster at opposite ends, with some spending more time debugging AI code; authors attribute gains to learned 'strategic delegation skills' and task choice, supporting wide variation by user practice.
  - qualifies (uncited): Shan et al. field study + RCT partly 0.4, direct `ai-coding/sources/4859137.txt#L1037-L1064`
    > Results depended on how developers used ChatGPT: direct acceptance raised output but not accuracy, while ideation, improvement and debugging raised accuracy, and debugging lowered output. Outcomes vary with usage style, but usage was self-chosen, so the evidence is correlational.
  - qualifies (uncited): METR 2025 RCT partly 0.35, direct `ai-coding/sources/2507.09089v2.txt#L1217-L1234`
    > METR RCT: speedup did not improve over the first 50 hours of Cursor use, and the lone >50h developer's speedup (~25%) fell to ~0% once a second developer's misreported experience was corrected. The 'high skill ceiling' idea is plausible but underpowered.
  - qualifies (uncited): Microsoft/Accenture field RCTs partly 0.35, direct `ai-coding/sources/cui-demirer-copilot-field-experiments.txt#L758-L770`
    > Field RCTs, ~4,900 developers: Copilot gains varied with experience, but in the opposite direction from 'skill needed'. Short-tenure and junior developers gained 21-40% while senior and long-tenure developers gained 7-16% (noisy, not significant).
  - qualifies (uncited): Vibe-coding literature review right 0.3, partial `ai-coding/sources/2607.21652v1.txt#L1518-L1526`
    > Vibe-coding MLR (47 sources, mention counts): quality, maintainability and productivity outcomes are described as conditional on developer expertise, task complexity and verification practice, and outcome claims vary substantially by user expertise.
  - inconclusive (uncited): Code-ownership experiment (Martin-Lopez) unknown, direct `ai-coding/sources/More_Code_Less_Understanding_On_the_Impact_of_AI_Assistants_on_Developers_Productivity_and_Code_Ownership.txt#L828-L835`
    > Gains appeared in every experience group, but the authors state they cannot separate experience effects from task and language effects, so the study cannot say whether outcomes depend on user expertise.

### s23 (factual, verified)

> The clearest sign that tool skill matters comes from a maintainability trial: the more practised the original developer was with AI, the better the code scored on a code-health measure once someone else built on it, though that developer's proficiency in Java mattered even more.

- **s23.a** [verified] In the Echoes of AI trial, the more AI-skilled the Task 1 participants were, the stronger the effect of their AI use on Task 2 CodeHealth, but building on code from a proficient Java developer mattered even more.
  - qualified (qualify): no direct support, 7 qualifying.
  - warning needs-qualification: Echoes of AI maintainability RCT: Bayesian analysis: the more AI-skilled the original developer, the larger the downstream CodeHealth benefit (+0.10, about half an SD, for habitual users). The authors conclude developers vary in their ability to use AI well, though Java proficiency mattered even more. Add the qualification: the evidence supports a narrower or weaker statement.
  - qualifies: Echoes of AI maintainability RCT right 0.5, partial `ai-coding/sources/2507.00788.txt#L2541-L2551`
    > As with the completion time, the Bayesian analysis provides more nuanced insights. We found that the more AI-skilled the Task 1 participants were, the stronger the effect of their AI usage on Task 2 CodeHealth. For habitual AI users, the estimated mean effect was a significant absolute increase of +0.10 in CodeHealth. …
  - qualifies (uncited): Google RCT partly 0.4, direct `ai-coding/sources/2410.12944.txt#L522-L543`
    > Google RCT, 96 engineers: senior and heavy-coding developers were tentatively faster with AI and natural-language-to-code needs prompting skill, but how often people already used AI tools had no significant effect on their AI speed-up, so the authors point to a 'low usability floor'.
  - qualifies (uncited): Anthropic internal study partly 0.4, direct `ai-coding/sources/anthropic-work-at-anthropic.txt#L36-L40`
    > Anthropic survey (n=132): time-savings responses cluster at opposite ends, with some spending more time debugging AI code; authors attribute gains to learned 'strategic delegation skills' and task choice, supporting wide variation by user practice.
  - qualifies (uncited): Shan et al. field study + RCT partly 0.4, direct `ai-coding/sources/4859137.txt#L1037-L1064`
    > Results depended on how developers used ChatGPT: direct acceptance raised output but not accuracy, while ideation, improvement and debugging raised accuracy, and debugging lowered output. Outcomes vary with usage style, but usage was self-chosen, so the evidence is correlational.
  - qualifies (uncited): METR 2025 RCT partly 0.35, direct `ai-coding/sources/2507.09089v2.txt#L1217-L1234`
    > METR RCT: speedup did not improve over the first 50 hours of Cursor use, and the lone >50h developer's speedup (~25%) fell to ~0% once a second developer's misreported experience was corrected. The 'high skill ceiling' idea is plausible but underpowered.
  - qualifies (uncited): Microsoft/Accenture field RCTs partly 0.35, direct `ai-coding/sources/cui-demirer-copilot-field-experiments.txt#L758-L770`
    > Field RCTs, ~4,900 developers: Copilot gains varied with experience, but in the opposite direction from 'skill needed'. Short-tenure and junior developers gained 21-40% while senior and long-tenure developers gained 7-16% (noisy, not significant).
  - qualifies (uncited): Vibe-coding literature review right 0.3, partial `ai-coding/sources/2607.21652v1.txt#L1518-L1526`
    > Vibe-coding MLR (47 sources, mention counts): quality, maintainability and productivity outcomes are described as conditional on developer expertise, task complexity and verification practice, and outcome claims vary substantially by user expertise.
  - inconclusive (uncited): Code-ownership experiment (Martin-Lopez) unknown, direct `ai-coding/sources/More_Code_Less_Understanding_On_the_Impact_of_AI_Assistants_on_Developers_Productivity_and_Code_Ownership.txt#L828-L835`
    > Gains appeared in every experience group, but the authors state they cannot separate experience effects from task and language effects, so the study cannot say whether outcomes depend on user expertise.

### s24 (factual, verified)

> So across these trials, nothing shows AI multiplying experts far more than novices: several leaned toward the less experienced, though the field experiments' gaps were noisy and not significant and another trial's result awaits further studies, and the one hint the other way was not significant either.

- **s24.a** [verified] None of the trials shows AI amplifying experienced engineers far more than novices: the Microsoft/Accenture, Shan and Peng trials found larger gains for less experienced developers, though the Microsoft/Accenture estimates are noisy and not statistically significant and Peng's result is conditional on persisting in further studies, and the Google trial's seniority interaction was not significant either.
  - qualified (qualify): 3 supporting (3 independent, strongest 0.5), 3 qualifying.
  - warning needs-qualification: Google RCT: Google RCT: more senior engineers and those coding 5+ hours/day were faster with AI, but the AI x seniority (p=0.706) and AI x hours interactions were not significant, so 'far more' is unsupported. Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: Microsoft/Accenture field RCTs wrong 0.5, direct `ai-coding/sources/cui-demirer-copilot-field-experiments.txt#L758-L770`
    > Moving on towards output measures in Figure 6, we see that the productivity-enhancing effects of Copilot are stronger for lower tenure and more junior developers. While our estimates are noisy and not statistically significant at conventional levels, the pattern is the same across all three main outcome measures: short…
  - supports: Shan et al. field study + RCT wrong 0.45, direct `ai-coding/sources/4859137.txt#L872-L878`
    > Additionally, we conducted a moderation analysis to examine the impact of generative AI across developers with varying levels of coding experience. As shown in Table E.2 of Online Appendix E, the results indicate that developers with fewer years of experience benefit in terms of faster coding, while coding quality rema…
  - supports: Copilot RCT (Peng) wrong 0.4, direct `ai-coding/sources/2302.06590.txt#L221-L225`
    > The heterogeneous effects identified in this study warrant close attention. Our results sug- gest that less experienced programmers benefit more from Copilot. If this result persists in further studies, the productivity benefits for novice programmers and programmers of older age point to important possibilities for sk…
  - qualifies: Google RCT partly 0.3, direct `ai-coding/sources/2410.12944.txt#L490-L505`
    > The interaction between experimental condition and se- (p = 0.018). This might be because our current AI tools niority was not statistically significant (model not shown; require that developers spend a lot of time verifying and p = 0.706), but it was negative, suggesting that participants in editing code generated by …
  - qualifies (uncited): METR 2025 RCT wrong 0.6, partial `ai-coding/sources/2507.09089v2.txt#L135-L141`
    > METR 2025 cites prior work finding that AI benefits less-experienced workers more; in its own RCT, highly experienced developers were slowed down, and more so on tasks where they had high prior exposure.
  - qualifies (uncited): Anthropic internal study partly 0.3, direct `ai-coding/sources/anthropic-work-at-anthropic.txt#L75-L75`
    > Anthropic: experience is needed to spot subtly dangerous Claude proposals, yet a senior engineer says the tools make juniors 'more productive and more bold', so the gain isn't clearly skewed to seniors.

### s25 (factual, verified)

> What runs through them is how much the developer already knew: the tool helped more for short-tenure developers in one trial and on unfamiliar issues in another, and helped less for maintainers on tasks they knew well.

- **s25.a** [verified] Gains were larger for short-tenure developers in the Copilot field experiments, and METR's developers found AI more helpful on unfamiliar issues and were slowed more on tasks with high prior exposure.
  - disputed (qualify): 1 supporting (1 independent, strongest 0.6), 1 contradicting, 5 qualifying.
  - warning needs-qualification: Microsoft/Accenture field RCTs: Microsoft experiment: gains were larger for short-tenure (newer to the company and its code) and junior developers (27-39% vs 8-13%), but differences were not significant and the routine-code half of the claim was not tested. Present the disagreement: name the studies on each side instead of stating one side as fact.
  - supports: METR 2025 RCT right 0.6, direct `ai-coding/sources/2507.09089v2.txt#L960-L984`
    > pleted in the study--this is why we have a smaller number of issues for our baseline slowdown estimate. See Section D.4 for details on how we estimate heterogeneous treatment effects. Qualitatively, developers note that AI is particularly helpful when working on unfamiliar issues, and less helpful when working on famil…
  - qualifies: Microsoft/Accenture field RCTs partly 0.45, direct `ai-coding/sources/cui-demirer-copilot-field-experiments.txt#L758-L770`
    > Moving on towards output measures in Figure 6, we see that the productivity-enhancing effects of Copilot are stronger for lower tenure and more junior developers. While our estimates are noisy and not statistically significant at conventional levels, the pattern is the same across all three main outcome measures: short…
  - qualifies (uncited): Copilot RCT (Peng) partly 0.4, direct `ai-coding/sources/2302.06590.txt#L174-L177`
    > Copilot RCT: less experienced developers benefited more on a routine, well-trodden task (a basic HTTP server), consistent with the claim but from a small freelancer sample and without a codebase-familiarity test.
  - qualifies (uncited): Anthropic internal study partly 0.4, partial `ai-coding/sources/anthropic-work-at-anthropic.txt#L70-L70`
    > Anthropic: staff delegate where they have low context and complexity is low, and avoid tasks needing tacit codebase knowledge, which mirrors METR's slowdown factors; this concerns task choice rather than measured gains.
  - qualifies (uncited): Shan et al. field study + RCT partly 0.35, direct `ai-coding/sources/4859137.txt#L872-L878`
    > Less-experienced developers gained more speed in the RCT, consistent with the claim, but a follow-up on harder APPS tasks suggested quantity gains were larger on complex tasks (0.283 vs 0.245), which does not fit 'routine code only'.
  - qualifies (uncited): Code-ownership experiment (Martin-Lopez) partly 0.3, direct `ai-coding/sources/More_Code_Less_Understanding_On_the_Impact_of_AI_Assistants_on_Developers_Productivity_and_Code_Ownership.txt#L240-L247`
    > Large completeness gains (+43 points) came on small, popular-domain tasks chosen so that LLMs could help, many of them greenfield. This fits gains on routine code, but the study had no mature codebases to compare against.
  - contradicts (uncited): Google RCT wrong 0.25, direct `ai-coding/sources/2410.12944.txt#L490-L505`
    > Google RCT on code unfamiliar to all participants found, if anything, more senior engineers gained more from AI (non-significant interaction), contrary to gains concentrating among less experienced developers.

### s27 (factual, verified)

> Back with those maintainers, the answer starts with how often they took what the tool offered: they accepted fewer than 44 percent of Cursor's generations.

- **s27.a** [verified] When using Cursor, METR's developers accepted less than 44% of the generations.
  - qualified (qualify): 1 supporting (1 independent, strongest 0.6), 2 qualifying.
  - warning needs-qualification: Anthropic internal study: Anthropic: engineers skip Claude for short tasks or ones needing tacit team context ('I'm just going to go and do it myself') and find familiar work faster done by hand, consistent with checking costs eating the benefit. Vibe-coding literature review: Sources often discuss defects alongside productivity gains, suggesting that faster development 'may introduce additional verification burdens', and the review calls gains conditional on verification; there is no time accounting. Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: METR 2025 RCT right 0.6, direct `ai-coding/sources/2507.09089v2.txt#L1004-L1012`
    > C.1.4 Low AI reliability (Limits AI performance) When using Cursor, developers accept <44% of the generations.13 When developers do not accept generations, we observe a mix of reattempting with different prompts, and giving up (i.e. reverting the proposed changes). This relatively low reliability qualitatively results …
  - qualifies (uncited): Anthropic internal study partly 0.35, direct `ai-coding/sources/anthropic-work-at-anthropic.txt#L67-L69`
    > Anthropic: engineers skip Claude for short tasks or ones needing tacit team context ('I'm just going to go and do it myself') and find familiar work faster done by hand, consistent with checking costs eating the benefit.
  - qualifies (uncited): Vibe-coding literature review partly 0.25, direct `ai-coding/sources/2607.21652v1.txt#L1454-L1458`
    > Sources often discuss defects alongside productivity gains, suggesting that faster development 'may introduce additional verification burdens', and the review calls gains conditional on verification; there is no time accounting.

### s28 (factual, verified)

> When they turned one down, they reprompted or gave up, and the researchers saw significant time wasted reviewing, testing or modifying code before rejecting it.

- **s28.a** [verified] When METR's developers did not accept generations they reattempted with different prompts or gave up, and the low reliability qualitatively resulted in significant wasted time spent reviewing, testing or modifying AI code before rejecting it.
  - qualified (qualify): 1 supporting (1 independent, strongest 0.6), 2 qualifying.
  - warning needs-qualification: Anthropic internal study: Anthropic: engineers skip Claude for short tasks or ones needing tacit team context ('I'm just going to go and do it myself') and find familiar work faster done by hand, consistent with checking costs eating the benefit. Vibe-coding literature review: Sources often discuss defects alongside productivity gains, suggesting that faster development 'may introduce additional verification burdens', and the review calls gains conditional on verification; there is no time accounting. Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: METR 2025 RCT right 0.6, direct `ai-coding/sources/2507.09089v2.txt#L1004-L1012`
    > C.1.4 Low AI reliability (Limits AI performance) When using Cursor, developers accept <44% of the generations.13 When developers do not accept generations, we observe a mix of reattempting with different prompts, and giving up (i.e. reverting the proposed changes). This relatively low reliability qualitatively results …
  - qualifies (uncited): Anthropic internal study partly 0.35, direct `ai-coding/sources/anthropic-work-at-anthropic.txt#L67-L69`
    > Anthropic: engineers skip Claude for short tasks or ones needing tacit team context ('I'm just going to go and do it myself') and find familiar work faster done by hand, consistent with checking costs eating the benefit.
  - qualifies (uncited): Vibe-coding literature review partly 0.25, direct `ai-coding/sources/2607.21652v1.txt#L1454-L1458`
    > Sources often discuss defects alongside productivity gains, suggesting that faster development 'may introduce additional verification burdens', and the review calls gains conditional on verification; there is no time accounting.

### s29 (factual, verified)

> Even accepted code cost time: 75 percent said they read every line the AI wrote, and 56 percent said they often had to make major changes to clean it up.

- **s29.a** [verified] Of METR's experienced developers, 75% report reading every line of AI generated code and 56% report often needing to make major changes to clean it up.
  - qualified (qualify): no direct support, 1 qualifying. modality: universal.
  - warning needs-qualification: METR 2025 RCT: METR 2025: 75% of experienced developers read every line of AI code, 56% often make major cleanups, and 100% report needing to modify it; this shows correction is routinely needed, but the study does not test less-skilled users. "every" is stronger than the evidence (strongest support 0). Add the qualification: the evidence supports a narrower or weaker statement.
  - qualifies: METR 2025 RCT partly 0.45, direct `ai-coding/sources/2507.09089v2.txt#L1015-L1021`
    > Developers further note that even when they accept AI generations, they spend a significant amount of time reviewing and editing AI generated code to ensure it meets their high standards. 75% report that they read every line of AI generated code, and 56% of developers report that they often need to make major changes t…

### s30 (factual, verified)

> Engineers deciding when to hand work to Claude described the same trade; for a task under 10 minutes, one said, "I'm probably not going to bother using Claude."

- **s30.a** [verified] In the Anthropic study, an engineer said that for a task they expect to take less than 10 minutes they probably will not bother using Claude.
  - qualified (qualify): no direct support, 2 qualifying.
  - warning needs-qualification: Anthropic internal study: Anthropic: engineers skip Claude for short tasks or ones needing tacit team context ('I'm just going to go and do it myself') and find familiar work faster done by hand, consistent with checking costs eating the benefit. Add the qualification: the evidence supports a narrower or weaker statement.
  - qualifies: Anthropic internal study partly 0.35, direct `ai-coding/sources/anthropic-work-at-anthropic.txt#L67-L69`
    > Faster to prompt than execute: “[For] a task that I anticipate will take me less than 10 minutes... I'm probably not going to bother using Claude.” “The cold start problem is probably the biggest blocker right now. And by cold start, I mean there is a lot of intrinsic information that I just have about how my team's co…
  - qualifies (uncited): Vibe-coding literature review partly 0.25, direct `ai-coding/sources/2607.21652v1.txt#L1454-L1458`
    > Sources often discuss defects alongside productivity gains, suggesting that faster development 'may introduce additional verification burdens', and the review calls gains conditional on verification; there is no time accounting.
  - quotation: "I'm probably not going to bother using Claude." from `ai-coding/sources/anthropic-work-at-anthropic.txt#L67-L69`

### s31 (factual, verified)

> Another described a cold start: their team's codebase holds knowledge Claude does not have by default, so rather than iterate on the perfect prompt, "I'm just going to go and do it myself."

- **s31.a** [verified] Another engineer described a cold start problem: intrinsic information about their team's codebase that Claude does not have by default, so rather than iterate on the perfect prompt they do it themselves.
  - qualified (qualify): no direct support, 2 qualifying.
  - warning needs-qualification: Anthropic internal study: Anthropic: engineers skip Claude for short tasks or ones needing tacit team context ('I'm just going to go and do it myself') and find familiar work faster done by hand, consistent with checking costs eating the benefit. Add the qualification: the evidence supports a narrower or weaker statement.
  - qualifies: Anthropic internal study partly 0.35, direct `ai-coding/sources/anthropic-work-at-anthropic.txt#L67-L69`
    > Faster to prompt than execute: “[For] a task that I anticipate will take me less than 10 minutes... I'm probably not going to bother using Claude.” “The cold start problem is probably the biggest blocker right now. And by cold start, I mean there is a lot of intrinsic information that I just have about how my team's co…
  - qualifies (uncited): Vibe-coding literature review partly 0.25, direct `ai-coding/sources/2607.21652v1.txt#L1454-L1458`
    > Sources often discuss defects alongside productivity gains, suggesting that faster development 'may introduce additional verification burdens', and the review calls gains conditional on verification; there is no time accounting.
  - quotation: "I'm just going to go and do it myself." from `ai-coding/sources/anthropic-work-at-anthropic.txt#L67-L69`

### s32 (factual, verified)

> The same limit shows up at larger scale: in one company's AI-assisted migration of 5,359 files, the bottleneck was how fast engineers could review the changes, so the team deliberately capped how many changes it generated each week.

- **s32.a** [verified] In the migration report, 5,359 files were migrated with AI-generated changes; the bottleneck was the speed at which engineers could review them, and the number of changes generated each week was purposefully limited to avoid overwhelming reviewers.
  - qualified (qualify): 1 supporting (1 independent, strongest 0.55), 1 qualifying. modality: possibility.
  - warning needs-qualification: Code-ownership experiment (Martin-Lopez): AI users produced more, larger code but understood it less. Their median answering time was 3 min longer (+27%) and they switched back to the code more than twice as often, though the time effect was not robust. The authors suggest time saved may be offset later in the lifecycle. [partial: the verdict note limits its own scope ("though")] Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: Google migrations report right 0.55, direct `ai-coding/sources/2501.06972.txt#L417-L423`
    > With this technique we were able to migrate 5,359 files the Joda time types are used and what the dependencies are. modifying more than 149,000 lines of code in 3 months. The We need answers to several questions: bottleneck in the process was the speed at which engineers could review the changes. We purposefully limite…
  - qualifies (uncited): Code-ownership experiment (Martin-Lopez) partly 0.4, partial `ai-coding/sources/More_Code_Less_Understanding_On_the_Impact_of_AI_Assistants_on_Developers_Productivity_and_Code_Ownership.txt#L736-L767`
    > AI users produced more, larger code but understood it less. Their median answering time was 3 min longer (+27%) and they switched back to the code more than twice as often, though the time effect was not robust. The authors suggest time saved may be offset later in the lifecycle.

### s33 (factual, verified)

> A review of what has been written about vibe coding names its central risk a verification gap: code generated faster than developers and their processes can verify its correctness, security and provenance.

- **s33.a** [verified] The vibe-coding literature review finds the central risk is a verification gap, a mismatch between the speed at which AI-assisted workflows generate code and the capacity of developers and processes to verify correctness, security and provenance.
  - qualified (qualify): 1 supporting (1 independent, strongest 0.4), 1 qualifying.
  - warning needs-qualification: Code-ownership experiment (Martin-Lopez): AI users produced more, larger code but understood it less. Their median answering time was 3 min longer (+27%) and they switched back to the code more than twice as often, though the time effect was not robust. The authors suggest time saved may be offset later in the lifecycle. [partial: the verdict note limits its own scope ("though")] Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: Vibe-coding literature review right 0.4, direct `ai-coding/sources/2607.21652v1.txt#L1906-L1914`
    > The role shift is not uniformly beneficial. While AI as- Findings from RQ5 indicate that the central risk asso- sistance may reduce implementation effort in some tasks, it ciated with vibe coding is a verification gap: a mismatch can increase cognitive load through prompt refinement, con- between the speed at which AI-…
  - qualifies (uncited): Code-ownership experiment (Martin-Lopez) partly 0.4, partial `ai-coding/sources/More_Code_Less_Understanding_On_the_Impact_of_AI_Assistants_on_Developers_Productivity_and_Code_Ownership.txt#L736-L767`
    > AI users produced more, larger code but understood it less. Their median answering time was 3 min longer (+27%) and they switched back to the code more than twice as often, though the time effect was not robust. The authors suggest time saved may be offset later in the lifecycle.

### s34 (factual, verified)

> Its authors suggest that skill in verification, constraint specification and review may matter as much as skill in writing code.

- **s34.a** [verified] The review suggests that skill in verification, constraint specification and review may matter as much as authoring skill.
  - qualified (qualify): 1 supporting (1 independent, strongest 0.5), 1 qualifying. modality: possibility.
  - warning needs-qualification: METR 2025 RCT: METR 2025: 75% of experienced developers read every line of AI code, 56% often make major cleanups, and 100% report needing to modify it; this shows correction is routinely needed, but the study does not test less-skilled users. Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: Vibe-coding literature review right 0.5, direct `ai-coding/sources/2607.21652v1.txt#L1929-L1932`
    > grey literature. What is new here is the link between these For practitioners, this reframing suggests that skill in conditional outcomes and the strength of the evaluation loop verification, constraint specification, and review may matter introduced in Section 4.1. Rather than treating productivity as much as authorin…
  - qualifies (uncited): METR 2025 RCT partly 0.45, direct `ai-coding/sources/2507.09089v2.txt#L1015-L1021`
    > METR 2025: 75% of experienced developers read every line of AI code, 56% often make major cleanups, and 100% report needing to modify it; this shows correction is routinely needed, but the study does not test less-skilled users.

### s35 (factual, verified)

> And the study of engineers using Claude names the catch, a "paradox of supervision": using Claude effectively requires supervising it, and supervising it requires the very coding skills that may atrophy from overuse.

- **s35.a** [verified] The Anthropic study describes a paradox of supervision: effectively using Claude requires supervision, and supervising Claude requires the coding skills that may atrophy from AI overuse.
  - qualified (qualify): 1 supporting (1 independent, strongest 0.5), 1 qualifying. modality: possibility.
  - warning needs-qualification: METR 2025 RCT: METR 2025: 75% of experienced developers read every line of AI code, 56% often make major cleanups, and 100% report needing to modify it; this shows correction is routinely needed, but the study does not test less-skilled users. Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: Anthropic internal study right 0.5, direct `ai-coding/sources/anthropic-work-at-anthropic.txt#L93-L94`
    > One reason that the atrophy of coding skills is concerning is the “paradox of supervision”—as mentioned above, effectively using Claude requires supervision, and supervising Claude requires the very coding skills that may atrophy from AI overuse. One person said: Honestly, I worry much more about the oversight and supe…
  - qualifies (uncited): METR 2025 RCT partly 0.45, direct `ai-coding/sources/2507.09089v2.txt#L1015-L1021`
    > METR 2025: 75% of experienced developers read every line of AI code, 56% often make major cleanups, and 100% report needing to modify it; this shows correction is routinely needed, but the study does not test less-skilled users.
  - quotation: "paradox of supervision" from `ai-coding/sources/anthropic-work-at-anthropic.txt#L93-L94`

### s36 (factual, verified)

> That checking is part of the price those maintainers paid.

- **s36.a** [verified] METR lists low AI reliability, which results in significant wasted time reviewing, testing or modifying AI generated code before rejecting it, as one factor limiting AI performance for its developers.
  - qualified (qualify): 1 supporting (1 independent, strongest 0.6), 2 qualifying.
  - warning needs-qualification: Anthropic internal study: Anthropic: engineers skip Claude for short tasks or ones needing tacit team context ('I'm just going to go and do it myself') and find familiar work faster done by hand, consistent with checking costs eating the benefit. Vibe-coding literature review: Sources often discuss defects alongside productivity gains, suggesting that faster development 'may introduce additional verification burdens', and the review calls gains conditional on verification; there is no time accounting. Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: METR 2025 RCT right 0.6, direct `ai-coding/sources/2507.09089v2.txt#L1004-L1012`
    > C.1.4 Low AI reliability (Limits AI performance) When using Cursor, developers accept <44% of the generations.13 When developers do not accept generations, we observe a mix of reattempting with different prompts, and giving up (i.e. reverting the proposed changes). This relatively low reliability qualitatively results …
  - qualifies (uncited): Anthropic internal study partly 0.35, direct `ai-coding/sources/anthropic-work-at-anthropic.txt#L67-L69`
    > Anthropic: engineers skip Claude for short tasks or ones needing tacit team context ('I'm just going to go and do it myself') and find familiar work faster done by hand, consistent with checking costs eating the benefit.
  - qualifies (uncited): Vibe-coding literature review partly 0.25, direct `ai-coding/sources/2607.21652v1.txt#L1454-L1458`
    > Sources often discuss defects alongside productivity gains, suggesting that faster development 'may introduce additional verification burdens', and the review calls gains conditional on verification; there is no time accounting.
