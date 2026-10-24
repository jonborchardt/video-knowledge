// The review page's actions, POSTed by its native forms and answered with a redirect back to the page (post, redirect,
// get). Dev server only (astro.config.mjs injects it when command === 'dev'). Every action names the build the person
// judged and is refused unless it is still the current one; a POST from any other origin is refused outright, since a
// web page could otherwise post to localhost and publish. Decisions go through the publish verbs; the long verbs run the
// CLI as a job (src/lib/review-job.ts). What a person may do is reviewView's `can`, the same reasons the page shows.
import type { APIRoute } from 'astro';
import { ROOT } from '../lib/io';
import { approverProblem } from '../lib/release';
import { Refusal, recordApproved, recordChangesRequested } from '../lib/publish';
import { startJob } from '../lib/review-job';
import { type ReviewView, parseNotes, reviewView, storyIdOfPath } from '../lib/review-view';
import { scriptDir } from '../lib/script';
import { href } from '../lib/url';

/** The request comes from a page this server served: its Origin header is the server's own origin. */
export const sameOrigin = (req: Request) => req.headers.get('origin') === new URL(req.url).origin;

const ACTIONS = ['approve', 'request-changes', 'accept-draft', 'upload', 'push', 'sync', 'go-live'] as const;
type Action = (typeof ACTIONS)[number];
const CAN: Partial<Record<Action, keyof ReviewView['can']>> = {
  approve: 'approve',
  'request-changes': 'requestChanges',
  'accept-draft': 'acceptDraft',
  upload: 'upload',
  'go-live': 'goLive',
};

interface Opts {
  root?: string;
  start?: typeof startJob;
}
export async function handle(
  req: Request,
  params: { topic?: string; action?: string; path?: string },
  { root = ROOT, start = startJob }: Opts = {},
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
  const form = await req.formData();
  const field = (k: string) => String(form.get(k) ?? '').trim();
  const by = field('by');
  const view = reviewView(topic, storyId, root);
  try {
    const problem = approverProblem(by);
    if (problem || by.startsWith('automated:')) throw new Refusal('every action here is a person’s: type your name');
    if (field('build') !== view.pkg?.mp4Sha)
      throw new Refusal(`the build changed since this page was loaded (now ${view.pkg?.mp4Sha ?? 'none'}): reload it`);
    const can = CAN[action as Action];
    if (can && view.can[can] !== true) throw new Refusal(String(view.can[can]));
    if ((action === 'push' || action === 'sync') && !view.state?.id) throw new Refusal('nothing uploaded yet');
    const job = (label: string, args: string[]) => {
      start(scriptDir(topic, storyId, root), label, args, root);
      return back('ok', `${label} started`);
    };
    switch (action as Action) {
      case 'approve':
        return back(
          'ok',
          recordApproved(topic, storyId, { by, root, build: field('build'), checked: form.getAll('check').length })
            .message,
        );
      case 'request-changes':
        return back(
          'ok',
          recordChangesRequested(topic, storyId, {
            by,
            root,
            build: field('build'),
            notes: parseNotes(field('notes'), view),
          }).message,
        );
      case 'accept-draft':
        return job('video final', ['video', 'final', topic, storyId, '--approved-by', by]);
      case 'upload':
      case 'push':
      case 'sync':
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
    if (e instanceof Refusal || e instanceof Error) return back('error', e.message);
    throw e;
  }
}

export const POST: APIRoute = ({ request, params }) => handle(request, params);
