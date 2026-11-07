---
name: log-todo
description: Use when the user types "/log-todo ..." or asks to log, file, note or jot a bug, todo, idea or gap for later in this repo (not now), to mark a logged todo done or dropped, to reclassify one, to merge duplicates, or to see the todo list or index.
---

# log-todo

A private, gitignored register in `todo/`: one markdown file per todo, uniform frontmatter, a derived `INDEX.md`. The
design is `docs/superpowers/specs/2026-11-06-log-todo-design.md`. You never write outside `todo/`, never delete or
renumber a file, and never read source code to size an item: the areas list, CLAUDE.md and the request are enough.

## Verbs

The first word is a verb only when it is one of these **and** the rest fits the shape; otherwise the whole text is
logged ("done with the board filter" is a todo, not a close).

| verb | shape | does |
| --- | --- | --- |
| `log` (default) | any text, pasted images, paths | files one or more todos (below) |
| `done <id>`, `drop <id>` | an id | sets `status`, `updated`, adds a dated Note |
| `dup <id> <of>` | two ids | `status: duplicate`, `duplicate_of`, appends `<id>`'s What to `<of>` as a checklist item, dated Note on both |
| `reclassify <id> key=value ...` | area, priority, effort, type, depends_on, related | sets them, `classified: user`, a dated Note with the old values |
| `show [<id> \| <area>]` | nothing, an id or an area | prints from `--json`; writes nothing |
| `reindex` | nothing | runs the script; use it after a hand edit |

Every writing verb ends with `node .claude/skills/log-todo/index.mjs`. Its exit 1 names the file and line to fix.

## log

1. `node .claude/skills/log-todo/index.mjs --json`: the areas and every todo (id, title, area, status). Never read all the files.
2. Split the text into distinct todos only when it plainly holds more than one. Items that must land together are one
   todo with a checklist in What. **Question 1** (only if the split is ambiguous): "One todo or two: X and Y?"
3. Dedupe against the JSON. Same subject as an **open** todo: **question 2**, "Merge into NNNN (title)?" Yes: append the
   text to its What as a checklist item plus a dated Note, bump `updated`, file nothing; its classification stays (say so
   in the reply if the new text argues for a higher priority). Same subject as a done or dropped todo: a new todo with
   `related: [that id]`, no question.
4. Classify each todo: `type`, `area` (an existing area whenever one fits; if none does, append `name: description` to
   `todo/areas.md` before writing the todo and say so), `priority` (P1 fix now, P2 next, P3 someday), `effort` in days
   from `0.25, 0.5, 1, 2, 3, 5` (an educated guess), `depends_on` and `related` by id. Values the text gives (`p1`,
   `area: video`, `2 days`, `depends on 7`, `blocks 9`) are taken as given. `classified: user` when the text gave any of
   area, priority or effort, else `auto`; the first Note names which of the three were given and which guessed.
   Two items combined into one take the higher priority and the summed effort.
5. Screenshots. A pasted image: transcribe it into `## Screenshot` (the page or command, the exact error text, the UI
   state); its pixels cannot be saved. A path: copy it to `todo/assets/<id>-<a|b|c>.<ext>`, link it, read it once and
   transcribe it too. Text that mentions a screenshot with neither: **question 3**, "Paste the screenshot or give me its
   path."
6. Write `todo/NNNN-<slug>.md`: id = highest existing + 1, four digits; slug = the title in kebab case, about 40 chars.
   Run the script. Reply one line per todo: `NNNN  title  area  P?  effort d` plus the guess you are least sure of.

No other question is ever asked.

## The file

```markdown
---
id: 12
title: Board tab loses its filter after a Copy click
status: open
type: bug
area: admin
priority: P2
effort: 0.5
depends_on: []
related: []
duplicate_of: null
classified: auto
created: 2026-11-06
updated: 2026-11-06
---

## What

The text, lightly tidied, one paragraph; a combined todo has a checklist here, one box per item.

## Why it matters / what it blocks

One or two lines, your reading. Omit the section when it adds nothing.

## Screenshot

Transcription; a link to `assets/0012-a.png` when a path was given. Omit when there is none.

## Notes

- 2026-11-08: area evidence -> stories (Jon)
```

Every key, in this order, every file; `status` `open|done|dropped|duplicate`; `type` `bug|feature|chore|question`
(`question` is a decision to make, not code); `duplicate_of` an id exactly when `status: duplicate`; dates `YYYY-MM-DD`.
No personal data: the folder is private, the habit must match the public store.

## Common mistakes

- Grepping the code to size an item. Guess from the area and the request.
- Writing INDEX.md or a table by hand. Only the script writes it.
- Deleting a file to undo a mistake. Use `drop` or `dup`; ids are forever.
- A new area for every item. Choose an existing one unless nothing fits.
- A fourth question. Guess, mark `auto`, name the shaky guess in the reply.
