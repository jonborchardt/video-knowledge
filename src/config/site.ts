// Site identity. The author details mirror the blog (jonborchardt/blog src/config/author.ts).
export const site = {
  name: 'Video knowledge',
  description: 'What YouTube videos and blog posts claim, checked against the evidence.',
  locale: 'en-US',
  url: 'https://jonborchardt.github.io/video-knowledge/', // astro.config's site + base; used where Astro's href() is not available (the review package)
  blog: { name: 'Always Shippable', url: 'https://jonborchardt.github.io/blog/' },
  nav: [
    { label: 'Blog', href: 'https://jonborchardt.github.io/blog/' },
    { label: 'About', href: '/about/' },
  ],
  repo: 'https://github.com/jonborchardt/video-knowledge',
};

export const author = {
  name: 'Jonathan Borchardt',
  tagline: 'Always shippable, always improving',
  links: {
    GitHub: 'https://github.com/jonborchardt',
    LinkedIn: 'https://www.linkedin.com/in/borchardt/',
    YouTube: 'https://www.youtube.com/@JonathanBorchardt',
  },
};
