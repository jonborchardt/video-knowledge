# Charter: world bible and editorial governance

Version 1.0, consolidated 2026-10-23. Status words (DECIDED, RECOMMENDED, PROPOSED, OPEN) are explained in
[README.md](README.md).

## 1. Executive identity

### 1.1 What the Commonwealth is

DECIDED. Commonwealth of Reason (COR) is both the parent media brand and the fictional nation in which the media
institutions exist. It publishes real, research-backed investigations disguised aesthetically as the work of an
elaborate civil service: public inquiries, reports, exhibits, findings, advisories, and public information films.

The central conceit is not that the government is incompetent. It is that an extremely assured, respectable,
self-important bureaucracy is devoting its full ceremonial machinery to everyday questions: whether heat pumps actually
save money, whether an MLM business model delivers promised income, whether AI coding claims hold up, whether a health
claim survives scrutiny, or whether a synthesized composition is any good.

- DECIDED motto: **All matters thoroughly considered.**
- DECIDED abbreviated parent ID: **COR**.
- DECIDED brand hierarchy:

```
Commonwealth of Reason                         fictional state / publisher
  └── Institution                              YouTube channel / site section
       └── Series (optional)                   recurring editorial format
            └── Public inquiry / story          investigated question or artistic work
                 ├── Long-form video
                 ├── Short(s)
                 ├── Report / findings
                 └── Exhibits / source material
```

The Commonwealth is not described as a subsidiary bureau, ministry, or department. It stands above its institutional
publishers. The audience must encounter one coherent shared nation, with institutional differentiation, rather than six
arbitrary channels sharing a prefix.

### 1.2 Brand promise

DECIDED: The government is fictional; the research is real. Evidence, source quotations, data provenance, financial
disclosures, and corrections must be genuine. The institutional certainty is aesthetic and procedural, not permission
for false certainty about facts.

A new viewer should understand what a video investigates within seconds, even if they have never encountered the
fictional world. The fiction adds flavor and memorability. It must not get between a viewer and a useful answer.

Internal test: if the viewer ignores every fictional flourish, is this still a useful, well-sourced video? If no,
revise.

### 1.3 Tonal pillars

- **Institutional assurance.** The Commonwealth speaks like an established sovereign administration. Not timid,
  chronically puzzled, or incapable of reaching decisions.
- **Disproportionate seriousness.** The funniest choice is often to treat a modest consumer question with the pageantry
  of a parliamentary inquiry.
- **Evidence discipline.** Claims are attributed, uncertainty is quantified or explained, and findings can be
  conditional, inconclusive, or amended.
- **Dry restraint.** Wit emerges from framing, bureaucratic language, seals, stamps, elaborate procedural dignity, and
  the contrast with ordinary subject matter. Avoid relentless jokes.
- **Public usefulness.** Reports should make decisions easier for citizens/viewers.
- **Cross-institution consistency.** Shared typography, insignia conventions, credits, numbering, and document grammar
  tie the universe together; institutions have distinct remits.

Avoid: fake scientific authority, manufactured consensus, fabricated witnesses, false government endorsement,
heavy-handed political parody, goofy cartoon civil servants, long lore exposition, and paper-themed visuals so complex
they obscure a graph.

## 2. World-building constitution

### 2.1 Institutional vocabulary

An editorial toolkit, not a compulsory script template.

| Plain-media concept    | Commonwealth treatment                           | Use                                         |
| ---------------------- | ------------------------------------------------ | ------------------------------------------- |
| Publisher/network      | Commonwealth of Reason                           | Parent identity                             |
| Channel                | Commission, Bureau, Office, Society              | Real institutional type in fictional nation |
| Video topic/story      | Public inquiry / case / matter                   | Evidence-led work                           |
| Research article       | Report / published findings                      | Accessible source-linked analysis           |
| Source                 | Exhibit / cited record                           | Real source with attributable provenance    |
| Chart or data table    | Exhibit / comparative schedule                   | Only when it conveys actual data            |
| Video                  | Public information film / record of proceedings  | Optional ceremonial designation             |
| Video description link | Entered into the Public Record                   | Destination to a real working URL           |
| Update/correction      | Amended finding / erratum                        | Transparent dated correction                |
| Playlists              | Published Inquiries / Findings of the Commission | Viewer-facing navigation                    |
| Editorial verdict      | Finding of the Commission                        | Must reflect the evidence                   |

DECIDED public website metaphor: **The Official Public Record**. A useful evidence archive, not a generic marketing
homepage. Visitors from a video land on the specific inquiry page, visibly branded for its institution.

DECIDED underlying content identities: publisher, institution, optional series, inquiry, evidence, video, Short,
publication. Each has a stable machine identity; channel names and mutable handles are never primary identifiers.

### 2.2 Case numbers and procedural marks

RECOMMENDED: immutable internal story IDs paired with a display number scoped to an institution (`Public Inquiry 0001`
is an illustrative format only). Publication state, not drafting state, reserves numbers. Numbering survives amendments
and corrections.

Candidate artifacts: PUBLIC INQUIRY, FINDINGS, EXHIBIT A, ENTERED INTO THE PUBLIC RECORD, AMENDED, APPROVED FOR
PUBLICATION, UNDER EXAMINATION.

RECOMMENDED recurring closing phrase: **The matter is now part of the public record.** A brand signature, not a claim
that an unpublished page exists; adapt or omit when there is no companion page.

Other candidate lines: "The Commission has examined the evidence." "A matter of considerable public expenditure." "The
figures have been reviewed." "Expenditure approved. Subject to conditions." (only when genuinely accurate as a finding).

Never use APPROVED, VERIFIED, or other verdict-like marks as decoration where they could mislead a viewer about the
evidence.

### 2.3 Fictional depth and future lore

DECIDED: lore stays lightweight at launch. Richer fiction is a possibility, not a dependency.

PROPOSED future additions: a coat of arms, a seal register, a capital's architecture, recurring offices and civil
servants, an official gazette, interdepartmental rivalries, ceremonial public notices, an annual report, correspondence
between institutions. These grow from published works, not before them.

Boundary: fictional officials, quotations, histories, and buildings must be recognizably fictional in context. No
real-government lookalike identity that could imply actual authority or endorsement. Real contact and legal publisher
identity remain discoverable.

## 3. Publishing and editorial governance

### 3.1 Truth boundary

DECIDED, non-negotiable:

- Fictional institutions may investigate; they may not invent citations, interviews, authorities, survey samples,
  experts, or evidence.
- Findings track the evidence. A confident presentation can say a result is conditional, unresolved, or dependent on
  assumptions.
- Attribute external imagery, clips, research, and quotations correctly; never fabricate public-domain or
  commercial-use status.
- Never give the impression that the fictional government is real or endorses products.
- Identify the real publisher/contact and disclose sponsorship, affiliate arrangements, and material conflicts.
- Corrections are transparent, dated, and traceable.
- No unsupported defamatory allegations in scam or belief investigations.
- Appropriate disclaimers and uncertainty for medical, financial, and other consequential topics.
- Creative direction never alters calculated numbers or sources for drama.

### 3.2 Evidence-to-video pipeline

The internal system remains **Video Knowledge**; there is no rename of the repository, CLI, schemas, story IDs, or
published research artifacts. Production phases stay logically distinct:

```
Source collection / attribution
  -> canonical claims / evidence evaluation
  -> story selection + institution routing
  -> factual script with cited claims
  -> storyboard and visual narrative
  -> institutional style application
  -> licensed narration / sound and music
  -> timeline + render
  -> automated QA / evidence consistency
  -> human review and publication authorization
  -> public video + Shorts + companion report/exhibits
  -> post-publish metadata/link audit + amendments
```

A story may originate in a shared research dataset but has one clear primary publishing institution. Cross-promotion is
permitted; duplicate publication across institutions is not the default.

### 3.3 Agent decision policy

When generating a script, scene, image prompt, title card, sound cue, thumbnail, or report:

1. Resolve publisher = COR.
2. Resolve the institution by topic and explicit editorial decision, not only keywords.
3. Load the institution's locked display name and ceremonial name separately.
4. Inherit common tokens and institution overrides; with no approved override, use restrained Commonwealth defaults and
   mark the choice for review.
5. Start with the concrete story claim/question; add institutional framing second.
6. Select only evidence-backed numbers, direct quotations, and sources. Maintain traceability.
7. Use document motifs sparingly, in service of comprehension.
8. Adapt the media grammar: research documentary, consumer calculation, technical teardown, or generative arts
   performance.
9. Make uncertainty visible when it affects the finding.
10. Include correction/sourcing pathways in metadata and companion pages.
11. Flag unpublished URLs, undeclared sponsorship, uncertain licenses, and invented lore for human review.
12. Never publish or reserve accounts without human authorization.

## 4. Website and cross-channel architecture

DECIDED direction: one Commonwealth domain and one research/content platform organized into institution-branded
sections. The canonical domain today is commonwealthofreason.com (`site.url` in `src/config/site.ts`); the exact path
taxonomy stays OPEN.

The site resembles a public archive of inquiries but acts like a useful modern product:

- A clear title and current finding, including limitations.
- The companion video and Shorts.
- Source-indexed report and original data where available.
- Exhibit A: sources/research; Exhibit B: comparisons/data; Exhibit C: an interactive calculator if one exists;
  Exhibit D: the public information film if useful.
- Prominent dates, version/correction history, institution, and story identifier.
- Clear commercial disclosures and publisher/contact identity.
- Links among related inquiries, institutions, and source artifacts.

Optional future additions (calculators, comparisons, affiliate links, referrals) need explicit disclosure and
editorial independence. No monetization model may dictate a factual verdict.

## 5. Acceptance criteria for a generated video

Reject a video if any of the following fails.

**World and brand**

- Institution matches subject and uses the exact current public display name where needed.
- The shared Commonwealth universe is recognizable but does not dominate story substance.
- Motto, institutional seals, and report language are used consistently.
- No false affiliation with any real government.
- Fictional characters and in-universe documents are clearly fictional.

**Research integrity**

- Every material claim has source/evidence traceability.
- Data units, dates, assumptions, ranges, and counterarguments are correct.
- Narration reflects limitations, study quality, and uncertainties.
- Any alleged misconduct has appropriately strong sourcing and review.
- No presentation technique implies a certainty the evidence lacks.

**Screen, sound and publishing**

- Subject-first hook; the intro does not overstay.
- Figures and charts are readable on small screens.
- Decorative marks and paper textures do not mask content.
- Voice, media, music, and visual assets have appropriate usage rights.
- Captions and accessibility are addressed.
- Titles and thumbnails are compelling but not misleading.
- Public Record links exist and lead to the correct institution/story when cited.
- Shorts preserve conditional claims from the full inquiry.
- Commercial/legal attribution and correction links are accurate.
- Final human authorization exists before publishing.

## 6. Decisions, recommendations, and open items register

**Decided**

- The parent fictional nation/publisher is Commonwealth of Reason, internally COR.
- Its motto is All matters thoroughly considered.
- Six institutional public YouTube names are exactly those in [institutions.md](institutions.md).
- First channel is the Commission, with created handle @CORSpending.
- The Commission's ceremonial name is Commission on Sensible Expenditure while its YouTube name ends in Commission on
  Spending.
- The world is confidently bureaucratic and mildly pompous, not hapless or uncertain.
- Published investigation and evidence must be real, verifiable, honest, and correctable.
- The Official Public Record is the shared website metaphor; evidence belongs with each inquiry.
- Video Knowledge remains the internal engineering/production name unless separately changed.
- The goal is a reusable multi-institution system, initially proving one channel rather than launching six.
- Six permanent YouTube channels, one per institution, and no general-purpose Commonwealth channel (reconsidered and
  confirmed 2026-10-24): one production method does not mean one audience, so each channel builds its own subscribers
  and commercial fit. No plan to merge or split them later. The site, the research and production platform and the
  shared design system stay one; each institution's channel is its own upload destination.

**Recommended, not irrevocably approved**

- Commission Treasury Navy palette, Libre Baskerville + IBM Plex Sans typography.
- Balanced Ledger emblem and official engraved-letterhead banner.
- Commission slogan An Inquiry Into What Things Actually Cost.
- Closing phrase The matter is now part of the public record.
- Audience-first channel description and keyword block ([spending.md](spending.md)).
- Investigative Cover thumbnail as default; source-first story presentation.
- The Commission Has Opened an Inquiry trailer.
- Brief ceremonial intro and restrained, evidentiary motion graphics.
- A shared parent grammar with distinctive future institution marks and palettes.
- correspondence@... as a future mailbox naming idea, subject to actual domain creation.

**Open, never silently assumed**

- Approval of finalized visual assets versus current generated references.
- Final Commonwealth parent seal / coat of arms.
- Exact path taxonomy, legal publisher attribution.
- The five future channel handles and whether all are available; their launch order, cadence and upload credentials.
- Whether other social platforms (X, Bluesky, ...) use one Commonwealth account or one per institution.
- Complete palettes, seals, banners, descriptions, slogans, playlists and voices for future channels.
- Whether Sounds Good on Paper, Catch Included, Commonly Untrue, and Pattern Behavior are adopted as series.
- Replacement series name for Office of Code Pending; whether Plausibility Commission needs a distinct series name.
- Actual first ten video lineup, publication order, and topic allocation.
- Real channel metadata presently saved in YouTube, apart from owner-reported handle creation.
- Commercial rights to final narration, scores, artwork, and other assets.
- Fictional capital, founding year, constitution, timeline, civil servants, and inter-office lore.
- Real email/contact details, ownership/administration roles, disclosures, and account security.

## 7. Compact prompt for video-making agents

Supplement with the story dossier, approved content, the actual production tools, platform constraints, and the
institution's configured tokens.

> You are producing media for the Commonwealth of Reason, a fictional nation whose official commissions, bureaus,
> offices, and societies publish real research-backed investigations and creative work. Follow this charter, resolve the
> chosen institution's exact name and locked style assets, and foreground the viewer's actual question. Write with formal
> confidence, deliberate institutional decorum, and occasional dry bureaucratic humor. Make the official machinery
> slightly grander than the modest matter at hand. The Commonwealth's motto is All matters thoroughly considered. Do not
> invent evidence, quotations, authorities, government affiliation, or statistical conclusions. Clearly separate factual
> findings from fictional framing. Use the public inquiry/exhibit/findings design grammar where useful, without obscuring
> charts, sources, or storytelling. Use real publisher links and corrections only when available. Make titles,
> thumbnails, narration, sound, scenes, and companion pages feel like artifacts from one coherent Commonwealth, while
> each institution remains distinct. If an identity or handle has not been approved, flag it rather than inventing it.

(The source copy of this charter ended mid-sentence after this paragraph; nothing beyond it was received.)
