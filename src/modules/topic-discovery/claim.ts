// Claiming a topic for an institution (spec §15 item 1, register D8): `src/config/site.ts` stays the one source of
// which commission publishes which topic, and this edits the one array literal inside the commission's object,
// keeping the quote style. Pure over the file text; the CLI reads the approved proposal, writes the file and
// confirms the edit re-parses with the topic in exactly one commission. The typecheck is the topic runner's
// `npm run validate` at its finish.
const SLUG = /^[a-z0-9-]{3,40}$/;

/** The commission that claims `topic` in the source text, or null. */
export function claimedBy(source: string, topic: string): string | null {
  for (const m of source.matchAll(/^\s*'?([\w-]+)'?:\s*\{[\s\S]*?topics:\s*\[([^\]]*)\]/gm)) {
    const slugs = [...m[2].matchAll(/['"]([^'"]+)['"]/g)].map((x) => x[1]);
    if (slugs.includes(topic)) return m[1];
  }
  return null;
}

/** The source with `topic` appended to `commissionKey`'s `topics: [...]` literal; `changed: false` when it is there
 *  already; a problem when the key or its literal is not found, the slug is malformed, or another commission claims
 *  the topic. */
export function claimEdit(
  source: string,
  commissionKey: string,
  topic: string,
): { source: string; changed: boolean } | { problem: string } {
  if (!SLUG.test(topic)) return { problem: `the topic slug must match ${SLUG} (got ${JSON.stringify(topic)})` };
  const owner = claimedBy(source, topic);
  if (owner === commissionKey) return { source, changed: false };
  if (owner) return { problem: `${topic} is claimed by ${owner}; a topic belongs to one commission` };
  const key = /^[a-z][\w-]*$/.test(commissionKey) ? commissionKey : null;
  if (!key) return { problem: `no commission ${commissionKey}` };
  // the commission's object: from its key to the next key at the same indentation (two spaces) or the closing brace
  const start = new RegExp(`^  '?${key.replace(/[-]/g, '\\-')}'?: \\{`, 'm').exec(source);
  if (!start) return { problem: `no commission ${commissionKey} in site.ts` };
  const after = source.slice(start.index);
  const end = /\n {2}\}/.exec(after);
  const block = after.slice(0, end ? end.index + end[0].length : after.length);
  const literal = /topics:\s*\[([^\]]*)\]/.exec(block);
  if (!literal) return { problem: `commission ${commissionKey} has no topics literal in site.ts` };
  const inner = literal[1];
  const quote = /"/.test(inner) ? '"' : "'";
  const items = inner.trim();
  const replaced = `topics: [${items ? `${items.replace(/,\s*$/, '')}, ` : ''}${quote}${topic}${quote}]`;
  const edited = block.replace(literal[0], replaced);
  return { source: source.slice(0, start.index) + edited + after.slice(block.length), changed: true };
}
