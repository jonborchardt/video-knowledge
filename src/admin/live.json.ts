// /admin/live.json (dev server only, astro.config.mjs): the live view as JSON for the admin page's poll. Read-only:
// nothing here writes, and the response is never cached. Read through src/orchestration/index.ts only.
import type { APIRoute } from 'astro';
import { liveView } from '../orchestration';
import { ROOT } from '../shared/io';

export const prerender = false;

export const GET: APIRoute = () =>
  new Response(JSON.stringify(liveView(ROOT)), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
