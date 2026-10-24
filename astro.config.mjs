import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// Two deploy targets while both run: Cloudflare serves https://commonwealthofreason.com/ at the root (the default,
// wrangler.jsonc); DEPLOY_TARGET=pages builds the GitHub Pages mirror at https://jonborchardt.github.io/video-knowledge/.
const pages = process.env.DEPLOY_TARGET === 'pages';

// The working pages (production board, story ideas, scripts, the admin index) live in src/admin/ and are routed only
// by the dev server: a build never emits them, so nothing admin-like reaches the public site.
const admin = {
  name: 'admin-pages',
  hooks: {
    'astro:config:setup': ({ command, injectRoute }) => {
      if (command !== 'dev') return;
      injectRoute({ pattern: '/admin', entrypoint: './src/admin/index.astro' });
      injectRoute({ pattern: '/production', entrypoint: './src/admin/production.astro' });
      injectRoute({ pattern: '/[topic]/stories', entrypoint: './src/admin/stories.astro' });
      injectRoute({ pattern: '/[topic]/scripts/[slug]', entrypoint: './src/admin/script.astro' });
      // the review page's media: the packaged build streamed from disk, never copied into public/ or dist/
      injectRoute({ pattern: '/[topic]/review-media/[file]/[...path]', entrypoint: './src/admin/media.ts' });
      injectRoute({ pattern: '/[topic]/review-action/[action]/[...path]', entrypoint: './src/admin/review-action.ts' });
    },
  },
};

export default defineConfig({
  site: pages ? 'https://jonborchardt.github.io' : 'https://commonwealthofreason.com',
  base: pages ? '/video-knowledge' : '/',
  integrations: [sitemap(), admin],
  vite: { plugins: [tailwindcss()] },
});
