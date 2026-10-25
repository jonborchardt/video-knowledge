# Standards checklist (Mode 1: apply while designing and reviewing)

Each line names the standard it comes from. "Gate" marks what the automated gate already fails on, so review effort goes
to the rest. Repo conventions come first: CLAUDE.md (Rules: site pages, Names, brand kit) wins over a generic preference.

## A. Web standards (WHATWG HTML, CSS, DOM)

- Valid content models: no block content (`div`, `p`) in phrasing-only parents (`summary`, `button`, `a` in phrasing
  context, `span`); `figcaption` first or last in its `figure`; one `h1`. Gate: html-validate (standard + a11y presets).
- Unique ids, labelled controls, `type` on every `button`. Gate.
- Document basics in `Base.astro` only: `lang`, `charset`, viewport, title, description. Gate (dist.test.ts).
- Native elements over ARIA (`<section aria-label>` not `div role=region`, `<details>` for disclosures, `<a>` to
  navigate, `<button>` to act). Gate where html-validate's `prefer-native-element` sees it.
- No deprecated or engine-specific APIs; capability detection (`matchMedia`, `'x' in el`), never UA sniffing.

## B. Responsive (WCAG 1.4.10 Reflow, 1.4.4 Resize Text, 1.4.12 Text Spacing)

- Intrinsic layout: `grid-cols-[minmax(0,1fr)]` for single-column grids that hold text, `flex-wrap` on rows whose items
  cannot shrink below their content (badges are `whitespace-nowrap`), `overflow-wrap: anywhere` is already set on
  headings and `dd`. Tables go in an `overflow-x-auto` `<section aria-label tabindex="0">`.
- No fixed pixel widths on content; widths from the container tokens (`max-w-prose|wide|page`). Gate (dist.test.ts
  forbids inline 3-digit px widths).
- Gate (browser): no horizontal scroll at 320, 375, 768, 1024, 1440 and a 48px sweep between, every tab, every
  `<details>` open, at 200% text (640px) and with WCAG text spacing (320px).
- Not gated: orientation, safe areas (`env(safe-area-inset-*)` for anything fixed to an edge), touch-only behaviour.

## C. Accessibility (WCAG 2.2 AA)

- Keyboard: everything reachable and operable by keyboard, logical order, no traps, focus visible (the global
  `:focus-visible` ring; never `outline: none` without a replacement). Gate (browser): skip link first, 40 Tab stops
  checked for ring, trap and off-screen focus; tabs answer arrow keys.
- Names: every control and icon named or hidden (`aria-hidden="true"` on decorative SVG, `alt=""` on decorative
  images). Gate (dist.test.ts, axe).
- Contrast: 4.5:1 text, 3:1 large text and UI boundaries, in both themes. Gate (axe, light 320/1280, dark 1280).
  Opacity modifiers on text (`text-*/70`) are the usual failure.
- Target size 24x24 CSS px for standalone controls (2.5.8). Gate (axe `target-size`).
- Status messages via `role="status"` (claim filter); dynamic content announced, not only shown.
- Motion: everything respects `prefers-reduced-motion` (global rule in `global.css`). Gate (browser).
- Not gated: reading order vs visual order, meaningful sequence, link purpose in context, error identification and
  suggestion (no public forms today), screen-reader output.

## D. Performance (Core Web Vitals: LCP <= 2.5 s, INP <= 200 ms, CLS <= 0.1 at p75, field)

- Budgets per page, gzipped, in `tests/web-quality.json` (JS 20 KB, CSS 15 KB, HTML 60 KB; topic pages have a ratchet
  ceiling). Gate. A budget is raised only with a reason in review, never to get green.
- No new client framework or hydration; plain `<script>` per CLAUDE.md. Images with `width`/`height` (gate), `loading`
  lazy below the fold, the right size from `npm run brand`.
- Lab CLS < 0.1 at 375 and 1440 is gated; lab LCP and INP are not, and nothing here measures the field.

## E. SEO and discoverability

- Every public page: unique title and description, canonical, og/twitter card, JSON-LD, in the sitemap; 404 noindex
  without canonical; internal links resolve and use `href()`. Gate (dist.test.ts).
- Admin pages never built (gate). Meaningful link text (no "click here"): review.
- Content is in the HTML at build time; tabs hide with `hidden`, never by fetching.

## F. Security and privacy

- No `innerHTML`/`insertAdjacentHTML`/`set:html` with data that is not committed repo content; JSON-LD escapes `<`.
  Gate (ESLint `astro/no-set-html-directive`, `no-restricted-syntax`; each allowed use carries a reasoned disable).
- No inline event handlers or `javascript:` URLs; third-party loads only from the allowlist in `tests/web-quality.json`.
  Gate.
- Security headers in `public/_headers` (Cloudflare). Gate. No HSTS or script CSP yet: a deploy decision.
- `npm audit --omit=dev --audit-level=high` in CI and `--audit`. Storage: `localStorage` only for the theme, wrapped in
  `try` (blocked storage must not break the page). No analytics or trackers.

## G. Cross-browser (current Chrome, Edge, Firefox, Safari; iOS Safari, Android Chrome)

- Prefer Baseline "widely available" features; check MDN/caniuse for anything newer and give it a fallback.
- Gate (CI and `--audit`): load, reflow, keyboard and topic-page interaction tests in Chromium, Firefox and WebKit.
  WebKit on Linux/Windows approximates Safari; iOS Safari and Android Chrome are not run (manual).

## H. Progressive enhancement

- Content and navigation work without JavaScript: tabs are plain sections until the script assigns roles; links are
  links. JavaScript only adds the interactions CLAUDE.md lists.
- A script that fails must not hide content (the pre-paint tab style is removed by the tab script).

## I. Design system

- Tokens in `src/styles/global.css` (`--color-*`, `--radius-*`, `--container-*`, `--text-display|featured|title`,
  `eyebrow`), brand marks from the kit (the `public/` assets `npm run brand` writes, e.g. `Stamp`, the seals). No raw hex in a
  component, no new font, no one-off component that duplicates an existing one (`VerdictBadge`, `SourceLink`, `Stamp`).
- Interactive states: hover, `:focus-visible`, `aria-pressed`/`aria-selected`/`aria-current` styles as the existing
  components do them.

## J. UX and interaction

- Every action gives feedback (status line, pressed state, URL hash for tabs); deep links and Back work.
- No surprise navigation, no layout shift on interaction, no motion the reader did not ask for.
- Destructive actions (admin pages only) confirm and keep the reader's input when a request fails.
