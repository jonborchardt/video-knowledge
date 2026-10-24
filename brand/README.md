# Commonwealth of Reason: brand

The brand charter for the public site and its YouTube channels, split by what a reader needs. Version 1.0, consolidated
2026-10-23. This is the working charter; the machine-readable identity the site builds from is `src/config/site.ts`
(publisher, motto, disclosure, the six institutions and the topics each publishes). Change the charter and the config
together.

| File                               | What it holds                                                                                                                                                                       |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [charter.md](charter.md)           | What the Commonwealth is, the brand promise, tonal pillars, the lexicon, lore limits, the truth boundary, governance, acceptance criteria, the decisions register, the agent prompt |
| [institutions.md](institutions.md) | The six institutions: exact YouTube names, ceremonial names, remits, personalities, the launch questionnaire, proposed visual starting points for the five future ones              |
| [design.md](design.md)             | Visual system (palette, typography, seal, banner, thumbnails) and the motion, voice, music and Shorts standard                                                                      |
| [spending.md](spending.md)         | Commission on Spending: identity, About copy, keywords, links, artwork checklist                                                                                                    |
| [slots.json](slots.json)           | Every brand asset slot: id, size, formats, where it is used                                                                                                                         |
| `<brand>/`                         | One folder per brand (`cor/` for the Commonwealth, then each key in `commissions`): `kit.json`, the SVGs `npm run brand` writes, `accounts.json` once it has accounts               |
| [fonts/](fonts/)                   | The brand fonts (Libre Baskerville, IBM Plex Sans and Mono; OFL), used by `npm run brand`                                                                                           |

## Brand kits

DECIDED 2026-10-24. Every brand has the same kit, so a page, a video or an upload can find "the Spending seal" or "the
Commonwealth share card" without guessing. The Commonwealth and the six institutions use one set of designs; an
institution differs only in its `palette`, `emblem` and `slogan` (its own motto, which takes the Commonwealth's place
on its seal, lockups and banners; the closing card keeps the Commonwealth line).

- `slots.json` lists every slot once (`seal`, `mark-small`, `lockup-horizontal`, `stamp-record`, `youtube-banner`,
  `og-default`, `cta-record`, `avatar`, `watermark`, ...): its group, pixel size, formats and use. A slot with `grounds`
  ships one file per background (`-paper`, `-ground`: the lockups, wordmark, one-colour seal and emboss, since which
  one a surface uses depends on it); a slot with `forms` one file per shape (the stamps: `-rect` where there is room,
  `-round` where it is small). A `template` (the per-inquiry share card) is drawn per use, not exported.
- `<brand>/kit.json` is the brand's manifest: `palette` (`ground`, `accent`, `paper`, `ink`), `emblem`, `slogan`, and
  `assets` mapping each slot to its SVG (`file`, or `files` by ground or form). The folder name is the brand key: `cor`
  for the Commonwealth, otherwise the key in `commissions` (`src/config/site.ts`). Stamp inks are fixed by meaning,
  the same in every brand: red for the official acts (recorded, amended), the brand's ground for a finding, slate for
  a matter under examination.
- `npm run brand` writes every kit: `scripts/brand/draw.js` draws each slot from the kit and the names in
  `src/config/site.ts`, Remotion's headless Chrome fits the text in the real fonts (`fonts/`, OFL), and the script
  saves `<slot>.svg` (committed) and the PNG or JPG its slot names (gitignored; run it to get files to upload), plus the
  site's seal copies `public/commissions/<key>.png`. Change a drawing in `draw.js` or a value in a kit, never an SVG.
- `<brand>/accounts.json` records what each public account shows (`youtube` today; `twitter`, `bluesky` and the rest
  as a person creates them): name, handle, URL, profile text, keywords, links, and the `avatar` and `banner` as slot
  ids in the kit. It is the record of reality: update it when the account changes, never ahead of it.

Where the kit is used:

- **Site** (copies written by `npm run brand`, committed): the share card of every page is a kit `og-default`
  (`public/og/site.jpg` for the Commonwealth, `public/og/<key>.jpg` on an institution's commission and topic pages,
  through Base's `image`), and a story page shares its own `og-inquiry` card with its question on it
  (`public/og/stories/<topic>/<story slug>.jpg`; `brand/og-inquiry.json` records the questions drawn, and the kit test
  fails when one has changed since); the favicon set and the header logo are the Commonwealth's `mark-small`; an
  institution's `seal` (`public/commissions/<key>.png`) stands beside its name on the home page, About, and its
  commission, topic and story pages.
- **Video**: every render copies the story's institution's kit into the video folder's `brand/` (`src/video/brand.ts`,
  gitignored), so a scene loads a slot with `staticFile('brand/<slot>.png')`. A landscape video of a published topic ends on
  an unnarrated scene `end` (kind `close-card`, appended by `src/video/timeline.ts`): the kit's `close-card` for 4 s,
  then its `endscreen-subscribe` for the 12 s YouTube's end-screen elements sit on. Its render cache key includes
  those two SVGs, so a redrawn kit re-renders it. The channel's avatar, banner and
  watermark are uploaded from the kit by hand and recorded in `accounts.json`.

`tests/accounts.test.ts` checks that every kit has every slot with its files, the site's seal copies exist, and every
account agrees with `commissions` (the YouTube name, handle and URL) and fits its platform's profile-text limit.

When Claude builds a new page or graphic for a brand, it takes colours from the kit's `palette`, marks, stamps and
cards from its `assets`, and the rules from [design.md](design.md); a new kind of asset is a new slot in `slots.json`
and a drawing in `draw.js`, never a one-off mark.

## Status words

Every statement in the charter carries one of these, and an agent treats them differently:

- **DECIDED**: binding until superseded.
- **RECOMMENDED**: a default, not irrevocable.
- **PROPOSED**: a design candidate that needs approval.
- **OPEN**: genuinely unresolved.

Never infer that an asset, account, domain or handle exists because the charter names it. Only channels a person has
created have a handle (`commissions` in `src/config/site.ts`: `@CORSpending` today); the others are `coming soon`.

## The one rule that outranks the rest

The government is fictional; the research is real. Wherever the Commonwealth framing appears, the disclosure goes with
it ("The Commonwealth is fictional. The research is real."), and no in-world mark (APPROVED, a finding stamp) may claim
more than the verdicts do.
