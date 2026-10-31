// The review page's actions, POSTed by its native forms and answered with a redirect back to the page (post, redirect,
// get). Dev server only (astro.config.mjs injects it when command === 'dev'). Every action names the build the person
// judged and is refused unless it is still the current one; a POST from any other origin is refused outright, since a
// web page could otherwise post to localhost and publish. Decisions run the publish verbs as a child process (`npm run
// publish -- approve|request-changes`, waited for); the long verbs run the CLI as a job (src/modules/website/review-job.ts). What a person may do is reviewView's `can`, the same reasons the page shows.
import type { APIRoute } from 'astro';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { ROOT } from '../shared/io';
import { approverProblem } from '../shared/approver';
import { Refusal } from '../shared/refusal';
import { startJob, type ReviewView, parseNotes, reviewView, storyIdOfPath } from '../modules/website';
import { scriptDir } from '../shared/io';
import { href } from '../lib/url';

/** The request comes from a page this server served: its Origin header is the server's own origin. */
export const sameOrigin = (req: Request) => req.headers.get('origin') === new URL(req.url).origin;

const ACTIONS = ['approve', 'request-changes', 'accept-draft', 'upload', 'push', 'sync', 'verify', 'go-live'] as const;
type Action = (typeof ACTIONS)[number];
const CAN: Partial<Record<Action, keyof ReviewView['can']>> = {
  approve: 'approve',
  'request-changes': 'requestChanges',
  'accept-draft': 'acceptDraft',
  upload: 'upload',
  'go-live': 'goLive',
};

/** `npm run publish -- <args>` in `root`, waited for: the CLI does every check and the ledger write. */
export const runPublish = (args: string[], root: string) =>
  spawnSync(
    process.execPath,
    [
      join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
      join(ROOT, 'src', 'modules', 'publishing', 'cli.ts'),
      ...args,
    ],
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
  );
const PLACE = { seconds: '--at', scene: '--scene', sentence: '--sentence' } as const;

interface Opts {
  root?: string;
  start?: typeof startJob;
  run?: (args: string[], root: string) => { status: number | null; stdout: string; stderr: string };
}
export async function handle(
  req: Request,
  params: { topic?: string; action?: string; path?: string },
  { root = ROOT, start = startJob, run = runPublish }: Opts = {},
): Promise<Response> {
  if (!sameOrigin(req)) return new Response('forbidden: not this server’s page', { status: 403 });
  const { topic = '', action = '', path = '' } = params;
  const storyId = storyIdOfPath(topic, path, root);
  if (!storyId || !ACTIONS.includes(action as Action)) return new Response('not found', { status: 404 });
  const back = (key: 'ok' | 'error', text: string) =>
    new Response(null, {
      status: 303,
      headers: { location: `${href(`/${topic}/review/${path}`)}?${key}=${encodeURIComponent(text)}` },
    });
  const form = await req.formData().catch(() => new FormData()); // not a form: no name, so refused below
  const field = (k: string) => String(form.get(k) ?? '').trim();
  const by = field('by');
  const view = reviewView(topic, storyId, root);
  try {
    if (approverProblem(by) || by.startsWith('automated:') || by.startsWith('-'))
      throw new Refusal('every action here is a person’s: type your name');
    if (field('build') !== view.pkg?.mp4Sha)
      throw new Refusal(`the build changed since this page was loaded (now ${view.pkg?.mp4Sha ?? 'none'}): reload it`);
    if (form.has('title') && field('title') !== view.title)
      throw new Refusal(`the title changed since this page was loaded (now "${view.title}"): reload it`);
    const can = CAN[action as Action];
    if (can && view.can[can] !== true) throw new Refusal(String(view.can[can]));
    if ((action === 'push' || action === 'sync' || action === 'verify') && !view.state?.id)
      throw new Refusal('nothing uploaded yet');
    const job = (label: string, args: string[]) => {
      start(scriptDir(topic, storyId, root), label, args, root);
      return back('ok', `${label} started`);
    };
    // the verb's first line on success; its refusal (exit 2) bare, as the page showed it when the verb ran in process
    const verb = (args: string[]) => {
      const r = run(args, root);
      if (r.status === 0) return back('ok', r.stdout.split('\n')[0].trim());
      if (r.status === 2) throw new Refusal(r.stderr.trim().replace(/^refused: /, ''));
      throw new Error(`npm run publish -- ${args[0]} failed (exit ${r.status ?? 'none'}): ${r.stderr.trim()}`);
    };
    switch (action as Action) {
      // the build is the current one (refused above otherwise), which is the one the verbs take
      case 'approve':
        return verb(['approve', topic, storyId, '--by', by, '--checked', String(form.getAll('check').length)]);
      case 'request-changes':
        return verb([
          'request-changes',
          topic,
          storyId,
          '--by',
          by,
          ...parseNotes(field('notes'), view).flatMap(({ text, ...at }) => [
            '--note',
            text,
            ...Object.entries(at).flatMap(([k, v]) => [PLACE[k as keyof typeof PLACE], String(v)]),
          ]),
        ]);
      case 'accept-draft':
        return job('video final', ['video', 'final', topic, storyId, '--approved-by', by]);
      case 'upload':
      case 'push':
      case 'sync':
      case 'verify':
        return job(action, ['publish', action, topic, storyId, '--by', by]);
      case 'go-live': {
        const when = field('when');
        if (field('confirm') !== 'yes') throw new Refusal('tick the confirmation to publish');
        if (when !== 'now' && when !== 'at') throw new Refusal('choose now or a time');
        const at = when === 'at' ? new Date(field('at')) : null;
        if (at && Number.isNaN(at.getTime())) throw new Refusal('the schedule time is not a date');
        return job('go-live', [
          'publish',
          'go-live',
          topic,
          storyId,
          '--by',
          by,
          ...(at ? ['--at', at.toISOString()] : []),
        ]);
      }
    }
  } catch (e) {
    if (e instanceof Error) return back('error', e.message);
    throw e;
  }
}

export const POST: APIRoute = ({ request, params }) => handle(request, params);
