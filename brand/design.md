# Design system and production standard

Version 1.0, consolidated 2026-10-23. Where the site implements a token, the file is named; the site's stylesheet is
`src/styles/global.css`, the video look is `src/video/remotion/theme.ts`.

## 1. Shared visual design system

### 1.1 General direction

RECOMMENDED, from the selected Commission concept: official state print design, engraved seals, academic/editorial
typography, ceremonial letterhead, archival ledgers, public records, selective stamping, fine-line borders, measured
spacing, strong diagrammatic clarity. A respectable archival government with modern production competence: neither a
comedy prop department nor a photorealistic impersonation of a real government.

**Layer A, Commonwealth-wide tokens**

- Recurring parent mark: Commonwealth seal or wordmark. The seal design is OPEN; the site uses a wordmark.
- Parent name: COMMONWEALTH OF REASON. Motto: ALL MATTERS THOROUGHLY CONSIDERED.
- Shared principles: formal grid, hierarchy, fine rules, institutional identification, report numbers, editorial
  legibility, evidence provenance.
- Shared motion grammar: formal entrance, deliberate pacing, restrained stamps and docket marks, measured document
  transitions.
- Shared sound grammar: brief ceremonial identity cue, then music tailored to institution and story. No anthem or
  signature melody exists yet.

**Layer B, institution identity.** Each institution may choose its own emblem, secondary color, supporting typographic
voice, short slogan, and graphic subject symbols. Six identical navy-and-gold seals are not assumed. The Commission is
the design reference, not a mandate to clone it.

**Layer C, story design.** The story stays legible and distinctive: show a heat pump, a dollar chart, an income
disclosure, a code excerpt, a forest plot, a historical document, a musical composition when that is the subject. The
bureaucracy is a recognizable frame around it.

### 1.2 Commission on Spending palette: Treasury Navy

RECOMMENDED. The site's base tokens (`--navy`, `--gold`, `--paper`, `--slate` in `global.css`) are these values.

| Token        | Hex       | Purpose                                      |
| ------------ | --------- | -------------------------------------------- |
| navy         | `#172A45` | Primary institutional background             |
| archivalGold | `#C5A46A` | Fine rules, seal engraving, highlights       |
| paper        | `#F2EBDD` | Archival neutral, readable document backdrop |
| slate        | `#444E59` | Body annotations, subdued technical details  |

Generated artwork may vary slightly from the tokens; these are the source values for scalable assets. Accessible
contrast takes priority over historical texture.

Explored alternatives, NOT chosen and not assigned to future institutions: Civil Service Green, State Burgundy, Bureau of
Records (slate/terracotta), Imperial Ledger (charcoal/gold).

### 1.3 Typography

RECOMMENDED: **Libre Baskerville** for institutional/report display and ceremonial headings, **IBM Plex Sans** for
charts, captions, labels, explanatory paragraphs, and data (the site adds IBM Plex Mono for citations and counts).
Explored and not chosen: Cinzel + Source Sans 3, IBM Plex Serif + IBM Plex Sans, Cormorant Garamond + Inter, Archivo
Black + IBM Plex Mono.

- An elegant serif may establish institution or chapter; dense moving data needs a clear sans serif.
- Prefer tabular lining numerals for comparisons and amounts.
- Do not engrave every on-screen statistic.
- Captions, charts, and phone-sized frames work without zooming.
- Use licensed, redistributable fonts; never assume a font exists on the rendering system.

### 1.4 Commission seal and profile mark

RECOMMENDED, first produced concept: a circular navy and gold seal with a balanced scale, a ledger or stack of documents
on one side and a stack of coins on the other, in a laurel ring. It works at avatar size and at high resolution on cover
sheets.

Profile mark rule: symbol first, small text second. The full institutional name is unreadable on mobile avatars; omit it
at avatar scale. Keep a single-color and minimal-size derivative.

Earlier alternates, none approved over the balance scale: Examined Coin (magnifier), CSE Monogram, Pillar of Prudence,
Commonwealth Auditor (heraldic bird).

### 1.5 Commission banner

RECOMMENDED: official letterhead / national treasury: navy perimeter, gold rules, cream field, large formal Commission
name, balance-scale seal, public-inquiry documents, fine ledger details, fictional neoclassical architecture. Center what
must survive YouTube cropping.

Banner copy: small parent COMMONWEALTH OF REASON; main ceremonial name COMMISSION ON SENSIBLE EXPENDITURE; slogan AN
INQUIRY INTO WHAT THINGS ACTUALLY COST.; motto ALL MATTERS THOROUGHLY CONSIDERED. The YouTube display name stays
Commonwealth of Reason: Commission on Spending.

Delivery: 16:9, at least 2048 x 1152 px, 2560 x 1440 preferred, at most 6 MB; essential words and marks inside the
central safe area; preview desktop, TV, and mobile crops.

Generated reference assets (not final vectors, not in this repository; obtain them from the design session):
`CORSpending_banner_2560x1440.png` (2.1 MB), `CORSpending_profile.png` (800 x 800), `commonwealth_of_reason_commission_banner.png`
(1672 x 941, below the recommended size; rebuild before use), `wide_mockup_branding_image_layout_for_a_youtube_ch.png`
(composition mockup only).

### 1.6 Thumbnail direction

RECOMMENDED default, Investigative Cover: the real subject, a concise question/claim, a visible comparative datum if it
matters, a small Commission emblem, optional case number. Variants for story fit: Stamped Case File, Two Sides of the
Ledger, The Finding (one number), retro Public Information Film.

Rules for all channels: subject recognition and curiosity first, institution second; minimal text, none duplicating the
title; no sensationalized conclusions (never SCAM, PROVEN, SAVES $X when the evidence is conditional); mobile-first and
checked small; one dominant visual and one claim/question; the icon, accent color, and edge treatment identify the
institution even unread.

## 2. Motion and audiovisual production standard

Working design defaults for the script/storyboard/render pipeline, not proof the software already implements them.

### 2.1 Opening sequence

RECOMMENDED: 0-5 seconds show the audience's question, an engaging visual, or a concrete finding; never a long crest
animation. Then a brief institutional mark or verbal framing ("The Commission has opened an inquiry into..."), the
decision being tested (for whom, and what would change the answer), the evidence flow, the finding (result, conditions,
limits, implications), and the close pointing at the public evidence archive, ending, when real, with "The matter is now
part of the public record." A question about household costs does not lose its first 20 seconds to the fictional
constitution.

### 2.2 On-screen document grammar

Inquiry docket (question, story number, date, institution); exhibit card (a source, chart, comparison, quote, or
calculation with attribution); finding card (result, range/conditions, status, evidence strength); amendment notice
(what changed, why, when); Public Record card (link/QR/reference to a real destination). Not every video has Exhibits
A-D; let the viewer follow the logic.

### 2.3 Motion language

RECOMMENDED: measured, deliberate motion. Pages slide into registry slots, lines are ruled, a seal appears once when
useful, charts build in sequence, comparisons are inspectable. Reserve grand ceremonial animation for title reveals and
high-impact findings. Avoid constant rubber stamps, floating parchment, fake ink jitter, unreadable annotations, fast
vintage-film effects. Support reduced motion and captions where the format permits.

Charts: axes, ranges, units, sample sizes, and assumptions legible. Navy, gold, cream, and restrained semantic colors;
semantic data color outweighs brand uniformity. Never omit uncertainty or cut a scale for drama. Paper and engraving
never compromise contrast or get mistaken for a historic document being cited.

### 2.4 Voice, narration, humor

RECOMMENDED narrator: composed, precise, diplomatically certain about procedure. British-style ceremonial turns of phrase
are permitted without an affected accent or constant archaic comedy. No human official character or voice casting is
approved.

Writing seeds (not locked copy):

- "The Commission has received numerous claims concerning the alleged economy of heat-pump installations. The figures,
  as always, require examination."
- "The advertised savings are substantial. The conditions required to obtain them are rather more substantial."
- "The Commission finds that the answer depends on energy prices, installation costs, and the system being replaced."

One dry aside per substantial section is often enough. Humor never replaces rigorous conclusions or implies knowledge
the sources lack. Narration licensing is recorded in the live repository (`video final` re-narrates with the commercial
voice); never presume a synthetic voice's commercial rights.

### 2.5 Music and sound

RECOMMENDED: a short ceremonial identity accent at the start or end, then an institution/story-specific original score
that supports comprehension and implies no conclusion the evidence lacks. Commission on Spending: stately plucked
strings/piano/percussion motifs, a documentary pulse during calculations, perhaps one dry brass flourish; not a
political thriller. Society of Synthetic Arts: greater freedom; music may be the subject and source artifact, and music
as evidence/art is distinguished from underscore. Verify exported assets, licences, and sync in the live pipeline
(`music/README.md`).

### 2.6 Shorts

Smallest viable institutional badge, one question, one useful insight, a clear link to the long-form inquiry, no full
ceremonial intro. Every Short carries the qualifications of the extracted claim; a conditional result never becomes an
absolute one. Formats: PUBLIC ADVISORY, ONE FIGURE FROM THE RECORD, THE COMMISSION FINDS, EXHIBIT IN BRIEF, CLAIM UNDER
EXAMINATION.

### 2.7 Trailer and homepage

RECOMMENDED Commission trailer: "The Commission Has Opened an Inquiry", a solemn narrator introducing whether a costly
heat pump actually saves money, ceremony against practical mathematics, 40-60 seconds subject to testing. Explored:
Notice to All Citizens; Welcome to the Commonwealth; The Evidence Has Been Received; Annual Report on Questionable
Expenditure.

Returning-subscriber featured video: the latest published inquiry or the strongest relevant new one. Eventual homepage
shelves: Latest Public Inquiries; Sounds Good on Paper (only if adopted and populated); Findings of the Commission;
Public Information Shorts. Never display empty sections to complete a fictional bureaucracy.
