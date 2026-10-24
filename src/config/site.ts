// Site identity. The public site is Commonwealth of Reason; its YouTube channels are commissions, each owning some
// topics. The repo and the production tooling keep the name video-knowledge.
export const site = {
  name: 'Commonwealth of Reason',
  motto: 'All matters thoroughly considered.',
  // The truth boundary: the state is fiction, the evidence is not. Shown wherever the fiction is (site footer, About,
  // video descriptions) so nobody reads a commission as a real government body.
  disclosure: 'The Commonwealth is fictional. The research is real.',
  publicRecord: 'The Official Public Record', // what the site calls itself where it is linked to
  description: 'What YouTube videos and blog posts claim, checked against the evidence.',
  locale: 'en-US',
  url: 'https://commonwealthofreason.com/', // the canonical public URL; used where Astro's href() is not available (the review package)
  nav: [{ label: 'About', href: '/about/' }],
  repo: 'https://github.com/jonborchardt/video-knowledge',
};

/** A YouTube channel under the Commonwealth of Reason umbrella and the topics that publish to it. A topic without a
 *  commission is published on the site only. Videos are branded with the full name (`fullName`) or the handle.
 *  Only channels a person has created go here: the other institutions (Bureau of Dubious Returns, Office of Code
 *  Pending, Plausibility Commission, Bureau of Public Beliefs, Society of Synthetic Arts) have names but no handles. */
export interface Commission {
  name: string;
  fullName: string; // the exact YouTube display name (at most 50 characters)
  ceremonialName: string; // the formal name, for report covers, banners and credits where space allows
  handle: string;
  youtube: string;
  topics: string[];
}

export const commissions: Record<string, Commission> = {
  spending: {
    name: 'Commission on Spending',
    fullName: 'Commonwealth of Reason: Commission on Spending',
    ceremonialName: 'Commission on Sensible Expenditure',
    handle: '@CORSpending',
    youtube: 'https://www.youtube.com/@CORSpending',
    topics: ['heat-pumps'],
  },
};

export const commissionOf = (topic: string): Commission | null =>
  Object.values(commissions).find((c) => c.topics.includes(topic)) ?? null;

export const author = {
  name: 'Jonathan Borchardt',
  links: {
    GitHub: 'https://github.com/jonborchardt',
    LinkedIn: 'https://www.linkedin.com/in/borchardt/',
  },
};
