import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { contentGraph, movedRedirects } from './src/lib/content-graph.ts';
import { publicTopicNames } from './src/lib/topics.ts';

// Two deploy targets while both run: Cloudflare serves https://commonwealthofreason.com/ at the root (the default,
// wrangler.jsonc); DEPLOY_TARGET=pages builds the GitHub Pages mirror at https://jonborchardt.github.io/video-knowledge/.
const pages = process.env.DEPLOY_TARGET === 'pages';

// The working pages (the admin index with the production board, story ideas, scripts, the review page) live in
// src/admin/ and are routed only by the dev server: a build never emits them, so nothing admin-like reaches the site.
const admin = {
  name: 'admin-pages',
  hooks: {
    'astro:config:setup': ({ command, injectRoute }) => {
      if (command !== 'dev') return;
      injectRoute({ pattern: '/admin', entrypoint: './src/admin/index.astro' });
      injectRoute({ pattern: '/[topic]/stories', entrypoint: './src/admin/stories.astro' });
      injectRoute({ pattern: '/[topic]/register', entrypoint: './src/admin/register.astro' });
      injectRoute({ pattern: '/[topic]/scripts/[slug]', entrypoint: './src/admin/script.astro' });
      injectRoute({ pattern: '/[topic]/review/[...path]', entrypoint: './src/admin/review.astro', prerender: false });
      // the review page's media: the packaged build streamed from disk, never copied into public/ or dist/
      injectRoute({
        pattern: '/[topic]/review-media/[file]/[...path]',
        entrypoint: './src/admin/media.ts',
        prerender: false,
      });
      injectRoute({
        pattern: '/[topic]/review-action/[action]/[...path]',
        entrypoint: './src/admin/review-action.ts',
        prerender: false,
      });
    },
  },
};

// A topic with no live story builds no page, so its moved.json emits no redirect either.
const g = contentGraph();
const liveTopics = publicTopicNames().filter((t) => g.nodes.get(t)?.public);

export default defineConfig({
  site: pages ? 'https://jonborchardt.github.io' : 'https://commonwealthofreason.com',
  base: pages ? '/video-knowledge' : '/',
  // A story whose id changed keeps its old matter URL as a redirect page (topics/<topic>/moved.json).
  // Astro prefixes the base to the old path but not to the destination.
  redirects: Object.fromEntries(
    Object.entries(movedRedirects(liveTopics)).map(([from, to]) => [from, `${pages ? '/video-knowledge' : ''}${to}`]),
  ),
  integrations: [sitemap(), admin],
  vite: { plugins: [tailwindcss()] },
});
