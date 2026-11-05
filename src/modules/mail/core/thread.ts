// The thread core: the person's own words above the quote, addresses, thread membership, question ids, and the
// correlation rule that decides which sent mail a received one answers (Revision log 6): the sender must be the
// person; then In-Reply-To, a question id in the subject, a question id in the own text, References (the latest);
// a tier with more than one distinct hit is ambiguous and matches nothing. Pure: the caller supplies the lookup.
import type { Correlation, InMail } from './types';

/** The person's own lines: everything before the first quote marker (a `>` block, `On … wrote:` on one line or
 *  wrapped over two, Outlook's `From:` header block or its rule, `-----Original Message-----`, a forwarded-message
 *  rule) and before a signature (`-- `, `Sent from my …`). A bottom-posted reply therefore yields nothing: the
 *  person is asked to reply above the quote. */
export function ownText(body: string): string {
  const lines = body.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const t = l.trim();
    if (/^>/.test(t)) break;
    if (/^-+\s*Original Message\s*-+$/i.test(t)) break;
    if (/^-+\s*Forwarded message\s*-+$/i.test(t)) break;
    if (/^_{5,}$/.test(t)) break;
    if (/^On\b.*\bwrote:\s*$/.test(t)) break;
    if (/^On\b/.test(t) && /\bwrote:\s*$/.test(lines[i + 1]?.trim() ?? '')) break;
    if (/^From:\s/.test(t) && lines.slice(i + 1, i + 5).some((x) => /^(Sent|Date|To):\s/.test(x.trim()))) break;
    if (/^-- ?$/.test(l)) break;
    if (/^Sent from my\b/i.test(t)) continue;
    out.push(l);
  }
  return out.join('\n').trim();
}

/** The bare address, lower-cased: `Jon <Jon@Example.test>` is `jon@example.test`. */
export const address = (s: string): string => (/<([^>]+)>/.exec(s)?.[1] ?? s).trim().toLowerCase();

const escaped = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** A mail's source safe to keep: each address in any case becomes its stand-in, and the display name the address
 *  headers give it becomes the stand-in's name wherever it appears (a quote line repeats it).
 *  ponytail: a name in an encoded body part or a signature's first name stays; read a fixture before committing it. */
export function sanitizedSource(raw: string, people: Record<string, string>): string {
  const headers = raw.split(/\r?\n\r?\n/, 1)[0];
  const fields = headers.match(/^(?:From|To|Cc|Bcc|Reply-To|Sender):.*(?:\r?\n[ \t].*)*/gim) ?? [];
  let out = raw;
  for (const [addr, standIn] of Object.entries(people)) {
    const local = standIn.split('@')[0];
    const named = new RegExp(`(?:^[^:]*:|,)\\s*(?:"([^"]+)"|([^",<>]+?))\\s*<${escaped(addr)}>`, 'gi');
    for (const f of fields)
      for (const m of f.matchAll(named)) {
        const name = (m[1] ?? m[2]).trim();
        if (name) out = out.replaceAll(name, local[0].toUpperCase() + local.slice(1));
      }
    out = out.replace(new RegExp(escaped(addr), 'gi'), standIn);
  }
  return out;
}

const QN = /\bqn-[0-9a-f]{12}\b/g;
/** Every distinct question id in `text`, in order of first appearance. */
export const questionIdsIn = (text: string): string[] => [...new Set(text.match(QN) ?? [])];

/** What correlate needs of a sent mail. */
export interface Correlatable {
  messageId: string;
  kind: string;
  id?: string;
  inReplyTo?: string;
  createdAt: string;
}
export type Lookup<E extends Correlatable = Correlatable> = (pred: (e: E) => boolean) => E[];

const distinct = <E extends Correlatable>(es: E[]): E[] => [...new Map(es.map((e) => [e.messageId, e])).values()];
const label = (e: Correlatable) => e.id ?? e.messageId;

export function correlate<E extends Correlatable>(
  m: Pick<InMail, 'from' | 'inReplyTo' | 'references' | 'subject' | 'text'>,
  lookup: Lookup<E>,
  person: string,
): Correlation {
  if (/^(mailer-daemon|postmaster)@/i.test(address(m.from))) return { thread: null, why: 'bounce' };
  if (address(m.from) !== address(person)) return { thread: null, why: 'not-from-person' };
  const decide = (es: E[]): Correlation | null => {
    const hits = distinct(es);
    if (hits.length === 1) return { thread: hits[0].messageId };
    if (hits.length > 1) return { thread: null, why: `ambiguous:${hits.map(label).join(',')}` };
    return null;
  };
  if (m.inReplyTo) {
    const r = decide(lookup((e) => e.messageId === m.inReplyTo));
    if (r) return r;
  }
  for (const text of [m.subject, ownText(m.text)]) {
    const ids = questionIdsIn(text);
    if (!ids.length) continue;
    const hits = lookup((e) => e.kind === 'question' && !!e.id && ids.includes(e.id));
    // a follow-up reuses its parent's subject, id included: an id alone cannot tell the parent from what followed
    const kids = hits.length === 1 ? lookup((e) => e.kind === 'question' && e.inReplyTo === hits[0].messageId) : [];
    const r = decide([...hits, ...kids]);
    if (r) return r;
  }
  const refs = lookup((e) => m.references.includes(e.messageId));
  if (refs.length) {
    const latest = distinct(refs).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    return { thread: latest.messageId };
  }
  return { thread: null, why: 'no-thread' };
}
