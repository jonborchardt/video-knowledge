# System model

A structured model of how video-knowledge works, for an agent (or a person) making a one-page infographic of the whole
system in the spirit of Stone Librande's _One-Page Designs_ (GDC 2010): one coherent visual of the system's parts and
how they interact, generated from a structured model rather than drawn from memory.

The JSON here is the model. The picture is derived from it. When the two disagree, the JSON wins; when the JSON and the
code disagree, the code wins (each file names its `authority`).

## Files

| file             | what it holds                                                                                                               | authority                                                                   |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `system.json`    | the overview: identity, the one-line loop, the seven layers, the four flows, a map of the other files                       | editorial summary of CLAUDE.md and the module READMEs                       |
| `modules.json`   | the 15 capabilities (name, responsibility, paths, CLI, briefs, read API, the objects each owns) and the boundary rules       | derived from `src/modules/README.md`, each README, `tests/boundaries.json`  |
| `objects.json`   | every artifact in the column of the stage that makes it: owner, writer, validity rule, file; 33 edges between them          | derived from `src/admin/objects.ts` (the admin Objects tab)                 |
| `externals.json` | every external connection: direction, protocol, secrets, verbs, guards, the flag that enables it, its readiness integration | `docs/OPERATIONS.md` section 2, `readiness.ts`, the env names the code reads |
| `actors.json`    | the person's acts, the nine agent roles and exactly what each writes, the automation planes, the test doubles               | `roles.ts`, `automation.ts`                                                 |
| `flow.json`      | the state machines: 12 research stages, 13 production stages, 14 board columns, the halt kinds, the 25-step workflow        | `research.ts`, `production.ts`, `runner.ts`, `src/admin/index.astro`        |
| `tech.json`      | runtimes, frameworks, libraries, the test and quality gates                                                                 | `package.json`, `wrangler.jsonc`, the CI workflow                           |
| `rules.json`     | the invariants, grouped: authority, agents, evidence, state, boundaries, secrets, site; each names where it is enforced      | CLAUDE.md Rules                                                             |

Regenerate the two derived files after a change to the admin catalog:

```sh
npx tsx -e "import {cols,edges,moduleCatalog} from './src/admin/objects.ts'; console.log(JSON.stringify({cols,edges,modules:moduleCatalog()},null,2))" > /tmp/objects.json
```

then fold `cols`/`edges` into `objects.json` and `modules` into `modules.json`, keeping their `about` and `rules`
blocks.

## The admin draws it

The dev server's `/admin#model` tab (`src/admin/SystemModel.astro`) renders this model as one SVG: the module band from
the catalog, the loop from `system.json` `loop` (each step tied to the columns it writes), the objects and their
relations from `src/admin/objects.ts`, each service of `externals.json` attached to the objects in its `attachesTo` with
its readiness dots, and each person's act with a `short` and a `gates` edge (or `at` object) from `actors.json` as a
gold diamond on that edge. `tests/admin-reference.test.ts` checks that every id those fields name exists.

## Brief for the infographic agent

Audience: a technical reader meeting the system for the first time (an engineer, a collaborator, a future maintainer).
They should be able to answer, from the page alone: what goes in, what comes out, who decides what, where the machine
stops and a person acts, what talks to the outside world, and why it is safe to leave running.

What a compelling one-page design of this system shows:

1. **The loop, left to right.** Discover, research, stories, produce, approve, publish, maintain (`system.json`
   `oneLineLoop`, `flow.json` `workflow`). The person's steps (`you: true`) are the beats; draw them as a distinct
   shape on the main line, because the whole architecture exists to put a human at exactly those points.
2. **Three kinds of actor in three visual registers.** A person, an agent (`claude -p` under a role grant), and code
   (a CLI verb). `actors.json`. Every arrow into an artifact is labelled with which of the three wrote it; a reader
   should see at a glance that agents only ever write into the artifact band, never into the machinery.
3. **The artifact band.** The columns of `objects.json` are the spine: Proposals, Identity, Research, Stories, Script
   stage, Video, Publishing, Operations. Each box carries its validity rule in a few words. The 33 edges are the
   relationships; the ones that carry a sha (approval binds a build, request binds a manifest) deserve a lock icon.
4. **The module ring.** `modules.json`: 13 capability modules plus shared and orchestration. Orchestration sits
   above them and touches each only through `index.ts` (read) and `cli.ts` as a child process (write). The website
   reads through read APIs. No module imports another's code. Draw the boundary test as the thing that makes this
   true, not a convention.
5. **The outside edge.** `externals.json`: YouTube Data API, Google OAuth, the mailbox (SMTP out, IMAP in), Azure
   Speech, edge-tts, X, Cloudflare, GitHub, the Claude CLI, the watcher checkout, the study search hosts. For each: the
   direction, the secret family, the verb, the flag that lets it run unattended, and its readiness state. The three
   readiness states (implemented, verified, enabled) are a small legend worth its own corner.
6. **The stage machines as strips.** `flow.json`: research stages, production stages, board columns. The halt kinds
   are the exits; `stopped` (red) is the short list where only a person can continue.
7. **The rules as labels, not a sidebar.** `rules.json`: put each rule on the arrow or the box it governs ("agents
   never hold a secret" on the agent band; "0.5 cap on AI guesses" on the verdict box; "only a person goes live" on
   the go-live arrow; "state is files, derived at read" on the artifact band).
8. **The tech as a footer strip.** `tech.json`: runtime, site, video, automation, quality. Small type; it is context,
   not the story.

Keep: the naming (the repo is video-knowledge, the site is Commonwealth of Reason, channels are commissions; the
disclosure line appears once). Keep the counts honest to the JSON. Nothing exploratory is in these files; every item is
built and tested as of 2026-11-02 except the one marked `implemented: false` (scheduled tasks, a person's act) and the
"later milestone" (business optimisation) in `src/modules/README.md`.

The page may be an HTML artifact, an SVG, or a Markdown document with embedded diagrams. If it is more than one page,
the overview page shows the loop, the actors, the artifact band and the outside edge; the subsystem pages (research,
production, release, maintenance) each take one flow from `system.json` `flows`.
