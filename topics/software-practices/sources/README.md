# Sources for the software-practices topic

Plain-text copies (`pdftotext -layout`) of open-access empirical studies. PDFs are gitignored; the `.txt` files are what claims get judged against. All copies come from arXiv, author or university pages, institutional repositories or publisher open-access pages.

- bacchelli2013-modern-code-review.txt — Bacchelli & Bird, 2013, ICSE: interviews/survey at Microsoft on what developers expect from code review vs what it delivers (finding defects is the stated goal, knowledge transfer and awareness are the main outcome).
- berger2019-languages-reproduction.txt — Berger, Hollenbeck, Maj, Vitek & Vitek, 2019, TOPLAS (arXiv 1901.10220): reproduction of Ray et al. 2014; most language-vs-bug associations disappear after fixing data and statistical issues.
- bernstein2018-open-workspace.txt — Bernstein & Turban, 2018, Phil Trans B: wearable-sensor field studies of two firms moving to open-plan offices; face-to-face interaction fell ~70%, electronic messaging rose.
- blinowski-2022-monolith-vs-microservices.txt — Blinowski, Ojdowska & Przybylek, 2022, IEEE Access 10:20357 (CC BY 4.0): throughput benchmarks of a two-endpoint app built as a monolith and as microservices (Java, .NET) locally and on Azure; the monolith wins at equal infrastructure cost and vertical scaling beats horizontal. Cost is tied to Azure pricing; nothing on development cost, delivery speed or failures.
- bird2011-ownership.txt — Bird, Nagappan, Murphy, Gall & Devanbu, 2011, FSE: code ownership metrics vs pre/post-release defects in Windows Vista and 7; many minor contributors predict more defects.
- bosu2015-useful-reviews.txt — Bosu, Greiler & Bird, 2015, MSR: 1.5 million review comments in five Microsoft projects classified for usefulness; the useful share rises with reviewer experience and falls as the number of files in a change grows.
- buse2010-readability.txt — Buse & Weimer, 2010, TSE (preprint): learned code readability metric from 120 human raters; correlates with defects and churn.
- dora2019-state-of-devops.txt — Forsgren, Smith, Humble & Frazelle, 2019, DORA/Google Cloud Accelerate State of DevOps report: survey-based four key metrics, elite vs low performers, cloud, CD and culture practices.
- dora2023-state-of-devops.txt — DORA/Google Cloud, 2023, Accelerate State of DevOps report: survey of 36,000+ professionals; code review speed, loosely coupled architecture, trunk-based development, documentation and AI against delivery, operational and organizational performance and well-being.
- dyba2008-agile-review.txt — Dybå & Dingsøyr, 2008, IST: systematic review of 36 empirical studies of agile development (mostly XP), strength of evidence rated low.
- fucci2016-tdd-replication.txt — Fucci, Scanniello, Romano, Shepperd, Sigweni, Uyaguari, Turhan, Juristo & Oivo, 2016, ESEM: external replication of a TDD vs test-last experiment with blind analysis; no significant difference in quality, productivity or test effort.
- fucci2017-tdd-dissection.txt — Fucci, Erdogmus, Turhan, Oivo & Juristo, 2017, TSE (arXiv 1611.05994): process-conformance analysis of TDD sessions; granularity and uniformity of cycles matter, test-first order does not.
- gao2017-type-or-not.txt — Gao, Bird & Barr, 2017, ICSE: adding TypeScript/Flow annotations to fixed public JavaScript bugs detects ~15% of them.
- halkjelsvik2018-time-predictions-book.txt — Halkjelsvik & Jørgensen, 2018, Springer open-access book "Time Predictions" (stands in for their 2012 Psych Bulletin review): evidence on judgment-based time and effort predictions, biases, anchoring and overoptimism.
- hannay2009-pair-programming-meta.txt — Hannay, Dybå, Arisholm & Sjøberg, 2009, IST (accepted manuscript): meta-analysis of 18 pair-vs-solo experiments; small quality gain (shrinks under publication-bias correction), medium duration gain, medium effort cost, moderated by task complexity and expertise.
- hanenberg2014-static-types-emse.txt — Hanenberg, Kleinschmager, Robbes, Tanter & Stefik, 2014, EMSE: journal extension of the ICPC 2012 experiment on static typing and maintainability (type errors fixed faster, semantic errors not).
- inozemtseva2014-coverage.txt — Inozemtseva & Holmes, 2014, ICSE: 31,000 generated test suites on five Java systems; coverage correlates only weakly with mutation-score effectiveness once suite size is controlled.
- jorgensen2004-expert-estimation.txt — Jørgensen, 2004, JSS: review of studies on expert judgment effort estimation; experts are not beaten by formal models, with guidelines for reducing bias.
- janzen2008-tdd-design-quality.txt — Janzen & Saiedian, 2008, IEEE Software (Cal Poly Digital Commons copy): three industry quasi-experiments, a 15-project industry case study and two student experiments comparing test-first with iterative test-last on design metrics; test-first units smaller, simpler and better covered, no confirmed gain in coupling or cohesion.
- karac2018-tdd-what-we-know.txt — Karac & Turhan, 2018, IEEE Software: short review of 15 years of TDD evidence; effects are inconsistent and driven by process conformance rather than test-first order.
- kleinschmager2012-static-types-maintainability.txt — Kleinschmager, Hanenberg, Robbes, Tanter & Stefik, 2012, ICPC: controlled experiment (Java vs Groovy) on static types and maintenance tasks; static types help except for fixing semantic errors.
- mark2008-cost-of-interrupted-work.txt — Mark, Gudith & Klocke, 2008, CHI: lab experiment; interrupted work finishes faster but with higher stress, frustration and time pressure.
- mcintosh2014-code-review-coverage.txt — McIntosh, Kamei, Adams & Hassan, 2014, MSR: review coverage and participation vs post-release defects in Qt, VTK, ITK; low coverage/participation predicts more defects.
- meyer2014-perceptions-productivity.txt — Meyer, Fritz, Murphy & Zimmermann, 2014, FSE: survey of 379 and observation of 11 developers on what makes a productive day; task completion and few interruptions.
- mockus2000-change-risk.txt — Mockus & Weiss, 2000, Bell Labs Technical Journal (author copy): logistic model of failure probability for 5ESS software-update changes; size, diffusion and low developer experience raise a change's risk.
- nagappan2008-org-structure.txt — Nagappan, Murphy & Basili, 2008, ICSE (MSR tech report): organizational metrics predict Windows Vista failure-proneness better than code metrics.
- parnin2011-resumption.txt — Parnin & Rugaber, 2011, SQJ: 10,000 recorded programming sessions and a 414-developer survey on resuming after interruptions; resumption takes 15+ minutes, often with warm-up activity.
- pencavel2014-working-hours.txt — Pencavel, 2014, IZA discussion paper: WWI munitions-worker data; output per hour falls past ~50 hours a week, little extra output beyond ~55-60.
- prechelt1999-28to1-legend.txt — Prechelt, 1999, tech report: re-analysis of programmer variability data; 28:1 is an artifact, typical interquartile ratios are 2-4x.
- prechelt2000-seven-languages.txt — Prechelt, 2000, IEEE Computer (submission): 80 implementations of one task in C, C++, Java, Perl, Python, Rexx, Tcl; scripting languages half the length and time, within-language variance larger than between.
- ray2014-languages-github.txt — Ray, Posnett, Filkov & Devanbu, 2014, FSE: 729 GitHub projects; small but significant association of language class (static/functional) with fewer bug-fix commits.
- sadowski2018-code-review-google.txt — Sadowski, Söderberg, Church, Sipko & Bacchelli, 2018, ICSE SEIP: case study of Google's review practice; small changes, one reviewer, fast turnaround, education as major motive.
- santos2018-review-distributed.txt — dos Santos & Nunes, 2018, JSERD (open access): 8,329 reviews from one 201-member industrial project plus a practitioner survey; larger patches take longer to approve and draw fewer comments per line.
- savor2016-continuous-deployment.txt — Savor, Douglas, Gentili, Williams, Beck & Stumm, 2016, ICSE-SEIP (author copy): continuous deployment at Facebook (2008-2014) and OANDA (2010-2014); deployed code per developer held as the team grew 20x, critical failures flat as deployments rose, no test teams.
- siniaalto2007-tdd-design.txt — Siniaalto & Abrahamsson, 2007, ESEM (author version, arXiv 1711.05082): comparative case study of three nine-week student projects (one TDD, two iterative test-last) on Chidamber-Kemerer metrics; coupling differences inconclusive, TDD code less cohesive, test coverage significantly higher.
- scalabrino2019-understandability.txt — Scalabrino, Bavota, Vendome, Linares-Vásquez, Poshyvanyk & Oliveto, 2019, TSE: 121 code/doc/developer metrics vs 444 human understandability judgments; none captures understandability well.
- soldani2018-microservices-pains-gains.txt — Soldani, Tamburri & Van Den Heuvel, 2018, JSS (preprint): systematic grey literature review of 51 industrial sources on microservice pains and gains across design, development and operation.
- lenarduzzi2020-migration-technical-debt.txt — Lenarduzzi, Lomio, Saarimäki & Taibi, 2020, JSS (arXiv 1902.06282): four-year case study of an SME extracting five microservices from a 280K-line monolith; SonarQube technical debt spiked at each extraction then grew about 90% slower, while development cost rose more than 20%.
- su2023-microservice-to-monolith.txt — Su, Li & Taibi, 2023, International Conference on Microservices (arXiv 2308.15281, CC-BY): multivocal review of 29 sources; only four documented switch-backs from microservices to a monolith, cost the most cited reason.
- tornhill2022-code-red.txt — Tornhill & Borg, 2022, arXiv 2203.04374: 39 proprietary codebases; low-quality (CodeHealth) files take ~2x development time and have 15x more defects.
- yu2015-pull-request-latency.txt — Yu, Wang, Filkov, Devanbu & Vasilescu, 2015, MSR (author copy): regression on about 40,000 merged, CI-tested pull requests from 40 GitHub projects; size, commits and discussion length dominate time to close.

## Not found (paywalled or no open copy)

- Ray et al. 2017 CACM version (FSE 2014 version used instead).
- Endrikat, Hanenberg, Robbes & Stefik 2014 "How do API documentation and static typing affect API usability?" (author links at unibz/pleiad/uchile all 404/403).
- Munir, Moayyed & Petersen 2014 "Considering rigor and relevance when evaluating TDD" (IST).
- Hannay, Dybå, Arisholm & Sjøberg 2009 pair programming meta-analysis (only a course-site copy; Simula/SINTEF pages have no PDF).
- Arisholm, Gallis, Dybå & Sjøberg 2007 pair programming experiment (TSE).
- Rigby & Bird 2013 "Convergent contemporary software peer review practices" (preprint on request only).
- Halkjelsvik & Jørgensen 2012 Psych Bulletin review (open-access 2018 book by the same authors used instead).
- Forsgren et al. 2021 "The SPACE of developer productivity" (ACM Queue/CACM block automated download).
- Villamizar et al. 2015 monolith vs microservices (10CCC, IEEE only).
- Taibi, Lenarduzzi & Pahl 2017 microservices migration (IEEE Cloud Computing).
- Kemerer & Paulk 2009 PSP reviews (TSE; author copy link dead).
- Stray, Sjøberg & Dybå 2016 daily stand-up study (SINTEF repository unreachable).
