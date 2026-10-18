// Matching script words to the provider's word boundaries. Browser-safe (the quote scene aligns at render time).

export const normWord = (w: string) => w.toLowerCase().replace(/[^a-z0-9]/g, '');

/** One token per spoken word. edge-tts groups a numeral with the word before it ("asked 601", "47 percent"); the
 *  boundary's span is split between the tokens in proportion to their letters, so "601" starts after "asked" rather
 *  than with it. A single-word boundary is returned as is. */
export function tokens<T extends { text: string; start?: number; end?: number }>(words: T[]): T[] {
  return words.flatMap((w) => {
    const parts = w.text.split(/\s+/).filter(Boolean);
    if (parts.length <= 1) return [w];
    const total = parts.reduce((n, p) => n + p.length, 0);
    const span = (w.end ?? 0) - (w.start ?? 0);
    let at = w.start ?? 0;
    return parts.map((p) => {
      const start = at;
      at += (span * p.length) / total;
      return { ...w, text: p, start, end: at };
    });
  });
}

/** The nth (1-based) token equal to `word`, or null. */
export function findWord<T extends { text: string }>(words: T[], word: string, nth = 1): T | null {
  const want = normWord(word);
  let seen = 0;
  for (const t of tokens(words)) if (normWord(t.text) === want && ++seen === nth) return t;
  return null;
}

/** Align a text line to the spoken tokens: one token per word of the line when the line is a contiguous run of the
 *  spoken words (punctuation ignored), else null. */
export function alignLine<T extends { text: string }>(line: string, words: T[]): T[] | null {
  const want = line.split(/\s+/).map(normWord).filter(Boolean);
  const toks = tokens(words);
  const have = toks.map((t) => normWord(t.text));
  if (!want.length || want.length > have.length) return null;
  for (let i = 0; i + want.length <= have.length; i++)
    if (want.every((w, k) => have[i + k] === w)) return toks.slice(i, i + want.length);
  return null;
}
