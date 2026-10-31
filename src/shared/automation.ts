// automation.json: the automation policy (spec: docs/superpowers, Milestone 2 §8). Every feature is off until a person
// turns it on; the key set is closed (an unknown key is a problem, so a plan that needs one adds it here first); agent
// permissions are never configuration (they are code, src/orchestration/run/roles.ts). Secrets live in .env, never here.
// Pure: no module import, no side effect; `loadAutomation` reads one file.
import { join } from 'node:path';
import { ROOT, readJson } from './io';

export const AUTOMATION_FILE = 'automation.json';

export type AgentRole =
  | 'writer'
  | 'reviewer'
  | 'graphics'
  | 'extraction'
  | 'collect'
  | 'discovery'
  | 'proposalReview'
  | 'draftReview'
  | 'notes';
export const AGENT_ROLES: AgentRole[] = [
  'writer',
  'reviewer',
  'graphics',
  'extraction',
  'collect',
  'discovery',
  'proposalReview',
  'draftReview',
  'notes',
];

export type DraftPolicy = 'person' | 'shadow' | 'agent';

export interface Automation {
  enabled: {
    tick: boolean;
    work: boolean;
    production: boolean;
    discovery: boolean;
    maintenance: boolean;
    social: boolean;
  };
  clone: string | null;
  git: { commitOn: 'main' | 'produce-branch' };
  schedule: {
    tickMinutes: number;
    discovery: { weekday: string; hour: number };
    maintenance: { everyDays: number };
    timezone: string;
  };
  production: {
    weekday: string;
    hour: number;
    storiesPerWeek: number;
    perInstitutionPerWeek: number;
    maxAwaitingApproval: number;
  };
  runs: {
    maxConcurrentStoryRuns: number;
    maxConcurrentTopicRuns: number;
    maxParallelAgents: number;
    loopCap: number;
    graphicsRevisions: number;
    qaFixes: number;
    noProgressAttempts: number;
    timeoutsPerStep: number;
    validationRounds: number;
    stepTimeoutMinutes: Record<string, number>;
    agentTimeoutMinutes: number;
    lockStaleMinutes: number;
    retryBackoffMinutes: number[];
    stuckAfterMinutes: number;
    minFreeGb: number;
  };
  agents: {
    command: string;
    effort: string;
    models: Record<AgentRole, string>;
    budgetUsd: { perAgent: number; perRun: number; perTopic: number; perWeek: number };
  };
  review: { draft: DraftPolicy; draftReviewRounds: number };
  approvals: { to: string; from: string; approverName: string; expiresDays: number; scheduleLeadMinutes: number };
  notifications: { to: string; digest: { weekday: string; hour: number } };
  topics: {
    proposalsPerInstitution: number;
    minOverall: number;
    minSources: number;
    minStudies: number;
    minDecided: number;
  };
  launch: { push: boolean; deployTimeoutMinutes: number; social: { video: boolean; shorts: boolean } };
}

const models = Object.fromEntries(AGENT_ROLES.map((r) => [r, 'opus'])) as Record<AgentRole, string>;

export const DEFAULTS: Automation = {
  enabled: { tick: false, work: false, production: false, discovery: false, maintenance: false, social: false },
  clone: null,
  git: { commitOn: 'main' },
  schedule: {
    tickMinutes: 15,
    discovery: { weekday: 'friday', hour: 7 },
    maintenance: { everyDays: 30 },
    timezone: 'America/Los_Angeles',
  },
  production: { weekday: 'monday', hour: 6, storiesPerWeek: 1, perInstitutionPerWeek: 1, maxAwaitingApproval: 2 },
  runs: {
    maxConcurrentStoryRuns: 1,
    maxConcurrentTopicRuns: 1,
    maxParallelAgents: 4,
    loopCap: 60,
    graphicsRevisions: 3,
    qaFixes: 3,
    noProgressAttempts: 3,
    timeoutsPerStep: 3,
    validationRounds: 2,
    stepTimeoutMinutes: { default: 30, render: 240, spike: 300, narrate: 60, final: 300 },
    agentTimeoutMinutes: 90,
    lockStaleMinutes: 10,
    retryBackoffMinutes: [15, 60, 240],
    stuckAfterMinutes: 180,
    minFreeGb: 20,
  },
  agents: {
    command: 'claude',
    effort: 'high',
    models,
    budgetUsd: { perAgent: 8, perRun: 80, perTopic: 150, perWeek: 200 },
  },
  review: { draft: 'person', draftReviewRounds: 2 },
  approvals: { to: '', from: '', approverName: '', expiresDays: 7, scheduleLeadMinutes: 30 },
  notifications: { to: '', digest: { weekday: 'monday', hour: 8 } },
  topics: { proposalsPerInstitution: 2, minOverall: 0.6, minSources: 40, minStudies: 12, minDecided: 0.5 },
  launch: { push: true, deployTimeoutMinutes: 40, social: { video: true, shorts: false } },
};

// Keys whose values are an open map (any string key, numbers) rather than a fixed shape.
const OPEN_MAPS = new Set(['runs.stepTimeoutMinutes', 'agents.models']);
// Enumerations and lower bounds the type alone does not state.
const ENUMS: Record<string, { values: string[]; say: string }> = {
  'review.draft': { values: ['person', 'shadow', 'agent'], say: 'person, shadow or agent' },
  'git.commitOn': { values: ['main', 'produce-branch'], say: 'main or produce-branch' },
};
const AT_LEAST_ONE = new Set([
  'production.storiesPerWeek',
  'production.perInstitutionPerWeek',
  'production.maxAwaitingApproval',
  'runs.maxConcurrentStoryRuns',
  'runs.maxConcurrentTopicRuns',
  'runs.maxParallelAgents',
  'runs.loopCap',
  'schedule.tickMinutes',
]);
const NEVER_KEYS: Record<string, string> = {
  'agents.allowedTools': 'agent tools are code: src/orchestration/run/roles.ts',
  'agents.toolsByRole': 'agent tools are code: src/orchestration/run/roles.ts',
};

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

function check(path: string, value: unknown, template: unknown, out: string[]): void {
  if (path in NEVER_KEYS) return void out.push(`${path}: unknown key (${NEVER_KEYS[path]})`);
  if (path in ENUMS) {
    if (typeof value !== 'string' || !ENUMS[path].values.includes(value))
      out.push(`${path}: expected ${ENUMS[path].say}`);
    return;
  }
  if (template === null) {
    if (value !== null && typeof value !== 'string') out.push(`${path}: expected a string or null`);
    return;
  }
  if (Array.isArray(template)) {
    if (!Array.isArray(value) || value.some((v) => typeof v !== 'number')) out.push(`${path}: expected numbers`);
    return;
  }
  if (isObject(template)) {
    if (!isObject(value)) return void out.push(`${path}: expected an object`);
    if (OPEN_MAPS.has(path)) {
      for (const [k, v] of Object.entries(value))
        if (typeof v !== (path === 'agents.models' ? 'string' : 'number'))
          out.push(`${path}.${k}: expected a ${path === 'agents.models' ? 'string' : 'number'}`);
      return;
    }
    for (const [k, v] of Object.entries(value)) {
      const sub = path ? `${path}.${k}` : k;
      if (sub in NEVER_KEYS) out.push(`${sub}: unknown key (${NEVER_KEYS[sub]})`);
      else if (!(k in template)) out.push(`${sub}: unknown key`);
      else check(sub, v, (template as Record<string, unknown>)[k], out);
    }
    return;
  }
  const want = typeof template;
  if (typeof value !== want) return void out.push(`${path}: expected a ${want}`);
  if (want === 'number' && AT_LEAST_ONE.has(path) && (value as number) < 1) out.push(`${path}: expected at least 1`);
  if (want === 'number' && !Number.isFinite(value as number)) out.push(`${path}: expected a finite number`);
}

/** Every way a parsed automation.json (or a partial one) departs from the shape: wrong types, unknown keys, values
 *  outside their range. Empty means valid. */
export function automationProblems(x: unknown): string[] {
  const out: string[] = [];
  if (!isObject(x)) return [`${AUTOMATION_FILE}: expected an object`];
  check('', x, DEFAULTS, out);
  return out;
}

function merge<T>(base: T, over: unknown, path = ''): T {
  if (!isObject(base) || !isObject(over) || Array.isArray(base)) return (over === undefined ? base : over) as T;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(over)) {
    const sub = path ? `${path}.${k}` : k;
    out[k] = OPEN_MAPS.has(sub) ? { ...(out[k] as object), ...(v as object) } : merge(out[k], v, sub);
  }
  return out as T;
}

/** The policy in force: the file's values merged under the defaults. Throws, listing every problem, on an invalid
 *  file; the defaults when the file is absent. `file` lets a test pass the parsed content instead of a file. */
export function loadAutomation(root = ROOT, file: unknown = readJson(join(root, AUTOMATION_FILE))): Automation {
  if (file === null || file === undefined) return structuredClone(DEFAULTS);
  const problems = automationProblems(file);
  if (problems.length) throw new Error(`${AUTOMATION_FILE}: ${problems.join('; ')}`);
  return merge(structuredClone(DEFAULTS), file);
}
