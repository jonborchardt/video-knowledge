import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// Two deploy targets while both run: Cloudflare serves https://commonwealthofreason.com/ at the root (the default,
// wrangler.jsonc); DEPLOY_TARGET=pages builds the GitHub Pages mirror at https://jonborchardt.github.io/video-knowledge/.
const pages = process.env.DEPLOY_TARGET === 'pages';
export default defineConfig({
  site: pages ? 'https://jonborchardt.github.io' : 'https://commonwealthofreason.com',
  base: pages ? '/video-knowledge' : '/',
  integrations: [sitemap()],
  vite: { plugins: [tailwindcss()] },
});
