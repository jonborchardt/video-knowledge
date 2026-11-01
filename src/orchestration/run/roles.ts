// The agent permission table, as code (spec §4.6): what each role may edit (exact paths from its subject), which
// fixed repo verbs it may run (none for content roles), and what every role is denied. Widening a grant is a
// reviewed commit here, never a configuration edit. Protection, not isolation: these rules bound what the harness
// lets the model do; the tree guard (guard.ts) and the per-verb child environments (steps.ts) are the other layers.
import type { AgentRole } from '../../shared/automation';
import { scriptDir, storySlug } from '../../shared/io';

export interface Subject {
  topic: string;
  storyId?: string;
  slug?: string;
}

export interface RoleGrant {
  /** gitignore-style path patterns relative to the repo root the role may create or edit. */
  writable: string[];
  /** Patterns in `writable` that may only be created, never modify an existing file. */
  newFilesOnly: string[];
  /** Patterns in `writable` whose edits may only add lines. */
  additiveOnly: string[];
  /** What the role's fixed verbs write (derived files): the guard accepts them, the agent gets no Edit rule for them. */
  derived: string[];
  /** Bash rules, in Claude Code's syntax; empty for every content role. */
  shell: string[];
  web: boolean;
}

const rel = (p: string) => p.replaceAll('\\', '/');
const storyRel = (s: Subject): string => {
  if (!s.storyId) throw new Error(`role grant needs a story for ${s.topic}`);
  return rel(scriptDir(s.topic, s.storyId, '')).replace(/^\/+/, '');
};
const SCENES = 'src/modules/video/remotion/scenes';
const BESPOKE = 'src/modules/video/bespoke';

export function grantFor(role: AgentRole, s: Subject): RoleGrant {
  const none = { newFilesOnly: [], additiveOnly: [], derived: [], shell: [], web: true };
  switch (role) {
    case 'writer':
      return {
        ...none,
        writable: [
          'script.json',
          'storyboard.json',
          'article.json',
          'cta.json',
          'video/render.json',
          'video/music.json',
        ].map((f) => `${storyRel(s)}/${f}`),
      };
    case 'reviewer':
      return {
        ...none,
        writable: [
          'script-review.json',
          'article-review.json',
          'shorts-review.json',
          'video/visual-review.json',
          'video/draft-review.json',
        ]
          .map((f) => `${storyRel(s)}/${f}`)
          .concat([`topics/${s.topic}/story-review.json`]),
      };
    case 'draftReview':
      return { ...none, writable: [`${storyRel(s)}/video/draft-review.json`] };
    case 'graphics': {
      const writer = grantFor('writer', s).writable;
      return {
        writable: [
          ...writer,
          `${SCENES}/*.tsx`,
          `${BESPOKE}/${s.topic}-${storySlug(s.storyId ?? '')}.ts`,
          `${SCENES}/index.ts`,
          `${BESPOKE}/index.ts`,
        ],
        newFilesOnly: [`${SCENES}/*.tsx`],
        additiveOnly: [`${SCENES}/index.ts`, `${BESPOKE}/index.ts`],
        derived: [`${storyRel(s)}/video/render-check.json`, `${storyRel(s)}/video/frames/*`], // what check and frames write
        shell: ['Bash(npm run video -- frames *)', 'Bash(npm run video -- check *)'],
        web: false,
      };
    }
    case 'extraction':
      return {
        ...none,
        writable: ['h*.json', 'sv_*.json', 'merges.json', 'distinct.json'].map((f) => `topics/${s.topic}/work/${f}`),
      };
    case 'collect':
      return {
        ...none,
        writable: [
          `topics/${s.topic}/videos.txt`,
          `topics/${s.topic}/blogs.txt`,
          `topics/${s.topic}/sources/*.txt`,
          `topics/${s.topic}/work/sv_*.json`,
        ],
        shell: ['Bash(npm run evidence -- search *)', 'Bash(npm run evidence -- fetch-doc *)'],
      };
    case 'discovery':
      return { ...none, writable: [`proposals/${s.slug ?? ''}.json`] };
    case 'proposalReview':
      return { ...none, writable: [`proposals/${s.slug ?? ''}.review.json`] };
    case 'notes':
      return { ...none, writable: [], web: false };
  }
}

export const CONTENT_ROLES: AgentRole[] = (
  [
    'writer',
    'reviewer',
    'graphics',
    'extraction',
    'collect',
    'discovery',
    'proposalReview',
    'draftReview',
    'notes',
  ] as AgentRole[]
).filter((r) => grantFor(r, { topic: 't', storyId: 's', slug: 'x' }).shell.length === 0);

/** The `--disallowedTools` rules every role gets: the secrets and the machinery. Deny beats allow in Claude Code. */
const DENIED_BASE = [
  'Read(.env)',
  'Read(.env.*)',
  'Read(.secrets/**)',
  'Edit(package.json)',
  'Edit(package-lock.json)',
  'Edit(automation.json)',
  'Edit(production.json)',
  'Edit(tsconfig*)',
  'Edit(astro.config.mjs)',
  'Edit(vitest.config.*)',
  'Edit(eslint.config.*)',
  'Edit(.npmrc)',
  'Edit(.gitignore)',
  'Edit(.claude/**)',
  'Edit(.git/**)',
  'Edit(.github/**)',
  'Edit(tests/**)',
  'Edit(node_modules/**)',
  'Edit(.automation/**)',
  'Edit(topics/**/run/**)',
  'Edit(topics/*/store/**)',
  'Edit(brand/**)',
  'Edit(public/**)',
  'Edit(music/**)',
];
// What a graphics agent may not touch under src/: everything but remotion/scenes/ and bespoke/.
const MODULES = [
  'article',
  'brand',
  'evidence',
  'packaging',
  'publishing',
  'script',
  'shorts',
  'stories',
  'storyboard',
  'website',
];
const DENIED_GRAPHICS_SRC = [
  'Edit(src/shared/**)',
  'Edit(src/config/**)',
  'Edit(src/orchestration/**)',
  'Edit(src/pages/**)',
  'Edit(src/components/**)',
  'Edit(src/layouts/**)',
  'Edit(src/admin/**)',
  'Edit(src/tools/**)',
  'Edit(src/lib/**)',
  'Edit(src/styles/**)',
  ...MODULES.map((m) => `Edit(src/modules/${m}/**)`),
  'Edit(src/modules/video/*.ts)',
  'Edit(src/modules/video/kinds.ts)',
  'Edit(src/modules/video/tts/**)',
  'Edit(src/modules/video/briefs/**)',
  'Edit(src/modules/video/tests/**)',
  'Edit(src/modules/video/remotion/*.ts)',
  'Edit(src/modules/video/remotion/*.tsx)',
  'Edit(src/modules/video/remotion/theme.ts)',
  'Edit(src/modules/video/remotion/Video.tsx)',
];

export function deniedFor(role: AgentRole): string[] {
  return role === 'graphics' ? [...DENIED_BASE, ...DENIED_GRAPHICS_SRC] : [...DENIED_BASE, 'Edit(src/**)'];
}
