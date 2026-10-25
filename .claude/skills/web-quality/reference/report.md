# Report format

Use this shape for Mode 2 (short: only the sections with content) and Mode 3 (all sections). Severity:

- **Blocker**: a secret or personal data exposed, the build or a page broken, a script error that stops a page working.
- **Error**: a failed automated check (the gate is red).
- **Warning**: listed debt (an exception, a budget ratchet), a detected issue awaiting confirmation.
- **Advisory**: an optional improvement.

```markdown
## Web quality: <scope> (<mode>, <date>)

**Gate: PASSED | FAILED | NOT RUN** (`npm run quality[ -- --audit]`, RESULT line quoted)

| Check | Ran | Result |
| ----- | --- | ------ |
| Static: html-validate, budgets, headers, third-party (all pages) | yes | pass |
| dist.test.ts (metadata, links, SEO) | yes | pass |
| Browser: reflow, keyboard, interactions (<engines>, <pages>) | yes | 1 fail |
| axe WCAG 2.2 A/AA (Chromium) | yes | pass with 2 listed exceptions |
| Lab CLS | yes | pass |
| npm audit (shipped deps) | no: Mode 2 | not run |

### Findings
| Severity | New / existing / regression | Rule | Where (file or URL) | What | Status |
| -------- | --------------------------- | ---- | ------------------- | ---- | ------ |

### Fixed in this change
- <file>: <what and why, which check now passes>

### Not run, and why
### Needs a person
- <the Manual column items relevant to the change, from enforcement-matrix.md>
```

Never write "passes WCAG", "accessible" or "good Core Web Vitals" without the qualifier "automated checks";
a check that did not run is "not run", never "pass".
