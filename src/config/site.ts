// Site identity. The public site is Commonwealth of Reason, a fictional state whose institutions (commissions, bureaus,
// offices, a society) publish real research. Each institution is a YouTube channel that owns some topics. The repo and
// the production tooling keep the name video-knowledge. The charter behind every value here is brand/.
export const site = {
  name: 'Commonwealth of Reason',
  motto: 'All matters thoroughly considered.',
  // The truth boundary: the state is fiction, the evidence is not. Said once per surface (the site footer, a video
  // description), not repeated through the copy: the fiction is obvious and the pages stay in character.
  disclosure: 'The Commonwealth is fictional. The research is real.',
  publicRecord: 'The Official Public Record', // what the site calls itself where it is linked to
  description:
    'The Official Public Record of the Commonwealth of Reason: public inquiries into what videos and posts claim, judged against the evidence.',
  locale: 'en-US',
  url: 'https://commonwealthofreason.com/', // the canonical public URL; used where Astro's href() is not available (the review package)
  nav: [
    { label: 'Inquiries', href: '/inquiries/' },
    { label: 'Institutions', href: '/institutions/' },
    { label: 'About', href: '/about/' },
  ],
  repo: 'https://github.com/jonborchardt/video-knowledge',
};

/** An institution of the Commonwealth: a YouTube channel and the topics (public inquiries) it publishes. A topic no
 *  institution claims is not shown on the site. Videos are branded with the full name (`fullName`) or the handle.
 *  Only a channel a person has created gets a `handle`; the rest are `coming soon` and never get an invented one
 *  (brand/institutions.md). The display names are DECIDED and fit YouTube's 50 characters. */
export interface Commission {
  name: string;
  fullName: string; // the exact YouTube display name (at most 50 characters)
  ceremonialName: string; // the formal name, for report covers, banners and credits where space allows
  remit: string; // one line, viewer-facing
  slogan?: string; // RECOMMENDED only where the charter has one
  handle?: string; // only once the channel exists
  youtube?: string;
  channelId?: string; // the public UC... id, for the Studio links on /admin
  topics: string[];
}

export const commissions: Record<string, Commission> = {
  spending: {
    name: 'Commission on Spending',
    fullName: 'Commonwealth of Reason: Commission on Spending',
    ceremonialName: 'Commission on Sensible Expenditure',
    remit: 'What things actually cost: household economics, big purchases, energy bills, prices and real savings.',
    slogan: 'An inquiry into what things actually cost.',
    handle: '@CORSpending',
    youtube: 'https://www.youtube.com/@CORSpending',
    channelId: 'UCc5kWuv226H1gjz7e4bj_0Q',
    topics: ['heat-pumps', 'inflation-2026'],
  },
  'dubious-returns': {
    name: 'Bureau of Dubious Returns',
    fullName: 'Commonwealth of Reason: Bureau of Dubious Returns',
    ceremonialName: 'Bureau of Dubious Returns',
    remit: 'Get-rich-quick schemes, MLMs and other promised returns, checked against the realized ones.',
    topics: ['get-rich-quick'],
  },
  'code-pending': {
    name: 'Office of Code Pending',
    fullName: 'Commonwealth of Reason: Office of Code Pending',
    ceremonialName: 'Office of Code Pending',
    remit: 'AI coding tools, agentic software engineering and developer practice, measured rather than demoed.',
    topics: ['ai-coding', 'software-practices'],
  },
  plausibility: {
    name: 'Plausibility Commission',
    fullName: 'Commonwealth of Reason: Plausibility Commission',
    ceremonialName: 'Plausibility Commission',
    remit: 'Science, nutrition and health claims, and what the studies can and cannot support.',
    topics: ['organic-food'],
  },
  'public-beliefs': {
    name: 'Bureau of Public Beliefs',
    fullName: 'Commonwealth of Reason: Bureau of Public Beliefs',
    ceremonialName: 'Bureau of Public Beliefs',
    remit: 'Social beliefs, fringe movements and popular convictions: what people hold true, and how it stands up.',
    topics: ['sovereign-citizens', 'world-war-3'],
  },
  'synthetic-arts': {
    name: 'Society of Synthetic Arts',
    fullName: 'Commonwealth of Reason: Society of Synthetic Arts',
    ceremonialName: 'Society of Synthetic Arts',
    remit: 'Generative music and visual art, exhibited with their methods on show.',
    topics: [],
  },
};

export const commissionOf = (topic: string): Commission | null =>
  Object.values(commissions).find((c) => c.topics.includes(topic)) ?? null;

/** The institution's kind, wherever it sits in its name: "the Commission", "the Bureau", ... */
export const commissionBody = (c: Commission): string =>
  ['Commission', 'Bureau', 'Office', 'Society'].find((w) => c.name.split(' ').includes(w))!;

/** The key of a commission in `commissions`: its stable id and the slug of its page, `/commissions/<key>/`. */
export const commissionKey = (c: Commission): string => Object.entries(commissions).find(([, v]) => v === c)![0];

export const author = {
  name: 'Jonathan Borchardt',
  blog: { name: 'Always Shippable', url: 'https://jonborchardt.github.io/blog/' }, // linked from About, not the footer
  links: {
    GitHub: 'https://github.com/jonborchardt',
    LinkedIn: 'https://www.linkedin.com/in/borchardt/',
  },
};
