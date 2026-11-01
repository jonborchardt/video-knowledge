// npm run topics -- <command> [args]
//   validate [<slug>] [--review] [--fresh]   problems of a proposal (or of its review with --review; --fresh: every
//                                            proposal without a review, the discovery agent's new ones); exit 2 on any
//   show [<slug>]                            the ranked proposals with the reviewer's overall and verdict, or one in full
//   context <commission key>                 the institution's remit, the existing topics and their story questions, and
//                                            every earlier proposal with its status: what the briefs read
//   approve <slug> --by <name> [--note <text>] [--via <channel:id>]
//   reject <slug> --by <name> --note <why> [--via <channel:id>]
//                                            a person's decision (an automated: actor is refused); idempotent on the same
//                                            decision (exit 0 printing it); refused without a review or with an invalid file
//   park <slug> --why <text> [--by <actor>]  code's or the topic runner's parking; automated: allowed; idempotent
//   batch [--dry-run]                        parks every weak proposed proposal with the reason, lists the top
//                                            topics.proposalsPerInstitution strong ones per institution; without --dry-run
//                                            writes one batch id (APPROVAL_SECRET) into each listed file and prints the
//                                            batch as JSON for the adapter
//   sent <batch id> --message-id <id>        records the batch mail's Message-ID on every proposal of the batch
// Exit 2 refuses and writes nothing. Nothing here researches or writes under topics/.
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { commissions } from '../../config/site';
import { loadAutomation } from '../../shared/automation';
import { ROOT, loadDotEnv, readJson, toJson, writeJsonAtomic } from '../../shared/io';
import { Refusal } from '../../shared/refusal';
import { secretFromEnv } from '../../shared/request';
import type { Proposal, ProposalReview } from '../../shared/types';
import { loadStories } from '../stories';
import { batchOf, decideProposal, parkProposal } from './decisions';
import {
  PROPOSALS_DIR,
  existingOf,
  loadProposals,
  proposalPath,
  rank,
  reviewPath,
  validateProposal,
  validateReview,
} from './proposals';

loadDotEnv();
const [cmd, ...rest] = process.argv.slice(2);
const flag = (name: string) => {
  const i = rest.indexOf(name);
  return i >= 0 ? rest[i + 1] : undefined;
};
const has = (name: string) => rest.includes(name);
const FLAGS_WITH_VALUE = new Set(['--by', '--note', '--via', '--why', '--message-id']);
const positional = rest.filter(
  (x, i) => !x.startsWith('--') && !(i > 0 && rest[i - 1].startsWith('--') && FLAGS_WITH_VALUE.has(rest[i - 1])),
);
const usage = () => {
  console.error(
    readFileSync(new URL(import.meta.url), 'utf8')
      .split('\n')
      .slice(0, 18)
      .map((l) => l.replace(/^\/\/ ?/, ''))
      .join('\n'),
  );
  process.exit(1);
};
if (!cmd) usage();
const root = ROOT;
const a = loadAutomation(root);
const now = () => new Date().toISOString();

const load = (slug: string): { proposal: Proposal; review: ProposalReview | null } => {
  const proposal = readJson<Proposal>(proposalPath(slug, root));
  if (!proposal) throw new Refusal(`no ${PROPOSALS_DIR}/${slug}.json`);
  return { proposal, review: readJson<ProposalReview>(reviewPath(slug, root)) };
};
const problemsOf = (slug: string, proposal: Proposal, review: ProposalReview | null, withReview: boolean) => {
  const out = validateProposal(proposal, existingOf(root, slug), a.topics);
  if (withReview) out.push(...(review ? validateReview(review, proposal) : ['no review file']));
  return out;
};
const save = (p: Proposal) => {
  const path = proposalPath(p.slug, root);
  mkdirSync(dirname(path), { recursive: true });
  writeJsonAtomic(path, p);
};
const via = (): Proposal['via'] | undefined => {
  const v = flag('--via');
  if (!v) return undefined;
  const [channel, ...detail] = v.split(':');
  return { channel, ...(detail.length ? { messageId: detail.join(':') } : {}) };
};

function main() {
  switch (cmd) {
    case 'validate': {
      const slug = positional[0];
      if (has('--fresh') || !slug) {
        const fresh = loadProposals(root).filter((x) => !x.review);
        const lines = fresh.flatMap((x) =>
          validateProposal(x.proposal, existingOf(root, x.proposal.slug), a.topics).map(
            (p) => `${x.proposal.slug}: ${p}`,
          ),
        );
        if (lines.length) throw new Refusal(lines.join('\n'));
        console.log(
          `RESULT: PASSED (${fresh.length} proposal${fresh.length === 1 ? '' : 's'} without a review, all valid)`,
        );
        break;
      }
      const { proposal, review } = load(slug);
      const problems = problemsOf(slug, proposal, review, has('--review'));
      if (problems.length) throw new Refusal(problems.join('\n'));
      console.log(`RESULT: PASSED (${slug}${has('--review') ? ' and its review' : ''})`);
      break;
    }
    case 'show': {
      const slug = positional[0];
      if (slug) {
        const { proposal, review } = load(slug);
        console.log(toJson({ proposal, review }).trimEnd());
        break;
      }
      const ranked = rank(loadProposals(root), a.topics);
      if (!ranked.length) {
        console.log('no proposals');
        break;
      }
      for (const r of ranked) {
        const flags = [r.unreviewed ? 'unreviewed' : '', r.weak && !r.unreviewed ? 'weak' : '']
          .filter(Boolean)
          .join(' ');
        console.log(
          `${r.overall.toFixed(2)}  ${r.slug.padEnd(28)} ${r.institution.padEnd(16)} ${r.status.padEnd(9)} proposer ${r.proposerOverall.toFixed(2)} reviewer ${r.unreviewed ? '  -' : r.reviewerOverall.toFixed(2)}${flags ? `  [${flags}]` : ''}`,
        );
        console.log(`      ${r.question}`);
        const review = loadProposals(root).find((x) => x.proposal.slug === r.slug)?.review;
        if (review) console.log(`      reviewer: ${review.verdict.split(/(?<=\.)\s/)[0]}`);
        if (r.status === 'parked') console.log(`      parked: ${r.parkedWhy}`);
      }
      break;
    }
    case 'context': {
      const key = positional[0];
      const c = key ? commissions[key] : undefined;
      if (!c) throw new Refusal(`no commission ${key ?? ''}; one of ${Object.keys(commissions).join(', ')}`);
      const lines = [
        `Institution: ${key} (${c.name}; ${c.fullName})`,
        `Remit: ${c.remit}`,
        ...(c.slogan ? [`Slogan: ${c.slogan}`] : []),
        `Channel: ${c.handle ?? 'none yet'}`,
        `Its topics: ${c.topics.join(', ') || 'none yet'}`,
        '',
        'Existing topics (every institution) and the questions their stories ask:',
      ];
      const existing = existingOf(root);
      for (const t of existing.topics) {
        const owner = Object.entries(commissions).find(
          ([, x]) => x.topics.includes(t) || x.fixtureTopics?.includes(t),
        )?.[0];
        lines.push(`- ${t}${owner ? ` (${owner})` : ' (unclaimed)'}`);
        for (const s of loadStories(t, root)?.stories ?? []) lines.push(`    ${s.question}`);
      }
      const proposals = loadProposals(root);
      lines.push('', 'Earlier proposals (never propose one of these again, nor the same subject under another slug):');
      if (!proposals.length) lines.push('- none');
      for (const { proposal: p } of proposals)
        lines.push(
          `- ${p.slug} (${p.institution}, ${p.status}${p.status === 'rejected' ? `: ${p.note ?? ''}` : p.status === 'parked' ? `: ${p.parkedWhy ?? ''}` : ''}): ${p.question}`,
        );
      console.log(lines.join('\n'));
      break;
    }
    case 'approve':
    case 'reject': {
      const slug = positional[0];
      if (!slug) throw new Refusal(`${cmd} needs a slug`);
      const by = flag('--by') ?? '';
      const { proposal, review } = load(slug);
      const problems = problemsOf(slug, proposal, review, true);
      if (problems.length && !problems.includes('no review file'))
        throw new Refusal(`${slug} is invalid: ${problems.join('; ')}`);
      const d = decideProposal(proposal, review, {
        status: cmd === 'approve' ? 'approved' : 'rejected',
        by,
        at: now(),
        note: flag('--note'),
        via: via(),
      });
      if ('problem' in d) throw new Refusal(d.problem);
      if (d.changed) save(d.proposal);
      console.log(d.message);
      break;
    }
    case 'park': {
      const slug = positional[0];
      if (!slug) throw new Refusal('park needs a slug');
      const { proposal } = load(slug);
      const d = parkProposal(proposal, flag('--why') ?? '', flag('--by') ?? 'automated: topics park', now());
      if ('problem' in d) throw new Refusal(d.problem);
      if (d.changed) save(d.proposal);
      console.log(d.message);
      break;
    }
    case 'batch': {
      const dry = has('--dry-run');
      const secret = dry ? null : secretFromEnv();
      if (!dry && !secret) throw new Refusal('a batch id needs APPROVAL_SECRET in .env (or --dry-run)');
      const all = loadProposals(root);
      // an invalid proposed proposal is left out and named: the discovery job validated it earlier, a hand-written one may not be
      const invalid = all
        .filter((x) => x.proposal.status === 'proposed')
        .map((x) => ({
          slug: x.proposal.slug,
          problems: problemsOf(x.proposal.slug, x.proposal, x.review, !!x.review),
        }))
        .filter((x) => x.problems.length);
      const valid = all.filter((x) => !invalid.some((i) => i.slug === x.proposal.slug));
      const batch = batchOf(valid, a.topics, secret, now());
      if (dry) {
        const byInst = new Map<string, string[]>();
        for (const l of batch.listed) byInst.set(l.institution, [...(byInst.get(l.institution) ?? []), l.slug]);
        console.log(
          `dry run: ${batch.listed.length} listed, ${batch.parked.length} would be parked, ${batch.unreviewed.length} unreviewed, ${invalid.length} invalid`,
        );
        for (const [inst, slugs] of byInst) console.log(`  ${inst}: ${slugs.join(', ')}`);
        for (const p of batch.parked) console.log(`  parked ${p.slug}: ${p.why}`);
        for (const s of batch.unreviewed) console.log(`  unreviewed ${s}: no review yet, neither listed nor parked`);
        for (const i of invalid) console.log(`  invalid ${i.slug}: ${i.problems[0]}`);
        break;
      }
      for (const p of batch.files) save(p);
      const out = {
        id: batch.id,
        at: batch.at,
        listed: batch.listed,
        parked: batch.parked,
        unreviewed: batch.unreviewed,
      };
      console.log(JSON.stringify({ ...out, invalid: invalid.map((i) => i.slug) }, null, 1));
      break;
    }
    case 'sent': {
      const id = positional[0];
      const mid = flag('--message-id');
      if (!id || !mid) throw new Refusal('sent needs <batch id> --message-id <id>');
      let n = 0;
      for (const { proposal } of loadProposals(root))
        if (proposal.batch?.id === id && proposal.batch.messageId !== mid) {
          save({ ...proposal, batch: { ...proposal.batch, messageId: mid } });
          n++;
        }
      console.log(`${id}: message id recorded on ${n} proposal${n === 1 ? '' : 's'}`);
      break;
    }
    default:
      usage();
  }
}

try {
  if (!existsSync(root)) throw new Refusal(`no root ${root}`);
  main();
} catch (e) {
  if (e instanceof Refusal) {
    console.error(`refused: ${e.message}`);
    process.exit(2);
  }
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
}
