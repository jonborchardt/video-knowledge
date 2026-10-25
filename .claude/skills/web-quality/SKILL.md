---
name: web-quality
description: Use when creating or changing anything a site visitor sees or loads (src/pages, src/components, src/layouts, src/styles, src/config/site.ts, public/, astro.config.mjs, client scripts), when reviewing such a change, when a web-quality test fails (tests/web-quality.test.ts, tests/browser/), or when asked for a web standards, accessibility (WCAG 2.2 AA), responsive, performance, SEO, security or cross-browser audit of the site.
---

# Web quality

An engineering gate for the public site (Astro static build, Tailwind v4 tokens, client JS limited to the
interactions CLAUDE.md lists). The gate is code, not this page: `tests/web-quality.test.ts` (static, every page,
part of `npm test`), `tests/dist.test.ts`, `tests/browser/site.test.ts` (real browsers) and `npm run lint`. This
skill says when to run them, how to read them, and what still needs a person.

**A green gate is not WCAG conformance or good Core Web Vitals.** Never report it as either. Report what ran.

## Modes

| Mode                       | When                                                         | Do                                                                                                                                                                                                                                                   |
| -------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Development             | Writing or reviewing site code                               | Apply [standards.md](reference/standards.md) as you design. Reuse tokens from `src/styles/global.css` and existing components; marks and colours from the brand kit (CLAUDE.md, Names). Native elements first.                                         |
| 2. Changed-code check      | Before you call a site change done                           | `npm run quality` (build, static gate, browser suite on one page per template in Chromium). Triage, repair, re-run. Then `npm run validate`.                                                                                                         |
| 3. Full audit              | Asked for an audit ("/web-quality audit", "audit the site")  | `npm run quality -- --audit` (every page, Chromium + Firefox + WebKit, `npm audit`), then the manual pass in [enforcement-matrix.md](reference/enforcement-matrix.md). Report with [report.md](reference/report.md).                                    |

Admin pages (`src/admin/`, dev server only, never built) are out of scope for the gate; apply Mode 1 to them by
judgment and say so in the report.

## Triage: every finding is one of four

1. **New, caused by this change** → fix it (below). It fails the gate.
2. **Regression** (an exception's selector or page that used to pass now fails differently, a budget crossed) → fix it.
3. **Existing debt**, unrelated to the change → leave it, report it. If it blocks the gate and the person agrees, add an
   exception to `tests/web-quality.json`: one `check`, one `rule`, the narrowest `page` regex, a `target` regex over the
   selector where possible, and a `reason` saying what fixing it needs. Never a blanket pattern.
4. **Approved exception** → already listed; the gate skips it. When it stops matching, the gate fails until you delete it,
   so the list only shrinks unless someone adds to it in review.

## Repair, don't just report

Find the root cause in the shared component, not the page (a fix in `ClaimCard.astro` fixes every topic page). Make the
smallest standards-based change in scope, rebuild, re-run the failing check, then the whole gate. Do not redesign,
change the palette, remove features or loosen a test or budget to get green; a visual or product trade-off goes to the
person as a question with the finding attached.

## Diagnosing browser findings

- `overflow-x`: open the page at the width with every `<details>` open and the failing tab selected, then find the first
  element whose right edge passes its parent's content box. Usual causes here: a single-line flex row whose items' min
  widths add up past the column (add `flex-wrap`), a grid with an implicit `auto` column (use `grid-cols-[minmax(0,1fr)]`),
  a table without an `overflow-x-auto` region.
- axe findings carry the axe rule id; its help URL is `https://dequeuniversity.com/rules/axe/4.14/<rule>` (the version of `axe-core` in package.json).
- The browser suite serves `dist/` with `astro preview`; rebuild after every source change. Results with messages land in
  `.web-quality/browser.json`.

## Common mistakes

- Calling a change done without `npm run quality`, or reporting checks that did not run as passed. Say "not run".
- Adding an exception for something the change itself introduced.
- Treating lab CLS or a passing axe run as field Core Web Vitals or full WCAG conformance.
- Inventing new colours, spacing or components when a token or component exists.
