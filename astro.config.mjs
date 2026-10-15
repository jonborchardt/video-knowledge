import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// Published as a GitHub Pages project site: https://jonborchardt.github.io/video-knowledge/
export default defineConfig({
  site: 'https://jonborchardt.github.io',
  base: '/video-knowledge',
  vite: { plugins: [tailwindcss()] },
});
