// Turning a cited passage into something a viewer can read on screen without changing its words: keep the column of a
// two-column PDF extraction that holds the highlight, drop page furniture and footnotes, flow the lines, and keep a
// window of words around the highlight. Browser-safe; the Excerpt scene calls it at render time.
export interface ExcerptWindow {
  before: string; // words before the highlight (may start with an ellipsis)
  match: string | null; // the highlight as it appears in the passage, null when it is not found
  after: string;
}

const squash = (s: string) => s.replace(/\s+/g, ' ').trim();
const FURNITURE = /FTC\.GOV|^\s*\d{1,3}\s*$|^\s*Page \d+/i;
const FOOTNOTE = /^\s*\d{1,2} [A-Z"]/; // "31 This MLM's data..." (two-digit footnotes at the page foot)
const TWO_COL = /^(.{20,}?)\s{4,}(\S.*)$/; // text, a wide gap, text: one line of two columns
const has = (text: string, needle: string) => squash(text).toLowerCase().includes(squash(needle).toLowerCase());

/** The passage as flowing text. On a page with two-column lines (pdftotext -layout), each line keeps the side that
 *  holds the highlight; a line indented past column 30 belongs to the right side, a long unindented line is body text
 *  across the full width, a short unindented line is the left side. Footnote and header lines are dropped.
 *  ponytail: heuristics tuned to the corpus's PDF extractions; a passage with no highlight keeps every line. */
export function flowPassage(passage: string, highlight: string | null): string {
  const lines = passage.split('\n').filter((l) => l.trim() && !FURNITURE.test(l) && !FOOTNOTE.test(l));
  const cols = lines.map((l) => l.match(TWO_COL));
  if (!highlight || cols.filter(Boolean).length < 3) return squash(lines.join(' '));
  const left = lines.map((l, i) => (cols[i] ? cols[i]![1] : l.search(/\S/) < 30 ? l : ''));
  const right = lines.map((l, i) => (cols[i] ? cols[i]![2] : l.search(/\S/) >= 30 ? l : ''));
  const side = has(right.join(' '), highlight) ? 'right' : has(left.join(' '), highlight) ? 'left' : null;
  if (!side) return squash(lines.join(' '));
  // Where the right column starts (median over the two-column lines): a long unindented line with a gap of any width
  // near that column is two columns too, with a narrow gap; otherwise it is body text across the page.
  const prose = (s: string) => s.replace(/[^a-z]/gi, '').length >= 15;
  const starts = lines
    .flatMap((l, i) => (cols[i] && prose(cols[i]![1]) && prose(cols[i]![2]) ? [l.indexOf(cols[i]![2])] : []))
    .sort((a, b) => a - b);
  const boundary = starts[Math.floor(starts.length / 2)] ?? 40;
  const kept = lines.map((l, i) => {
    if (cols[i]) return side === 'right' ? cols[i]![2] : cols[i]![1];
    const indent = l.search(/\S/);
    if (indent >= 30) return side === 'right' ? l : '';
    const from = Math.max(0, boundary - 4);
    const gap = l.slice(from, boundary + 3).search(/\s{2,}/);
    if (gap >= 0 && l.trim().length > boundary + 5) {
      const at = from + gap;
      return side === 'right' ? l.slice(at) : l.slice(0, at);
    }
    return l.trim().length > 70 ? l : side === 'left' ? l : '';
  });
  return squash(kept.join(' '));
}

/** Up to `words` words either side of the highlight, cut on word boundaries with ellipses. */
export function excerptWindow(passage: string, highlight: string | null, words = 45): ExcerptWindow {
  const text = flowPassage(passage, highlight);
  const want = highlight ? squash(highlight) : '';
  const at = want ? text.toLowerCase().indexOf(want.toLowerCase()) : -1;
  const cut = (s: string, n: number, fromEnd: boolean) => {
    const ws = s.split(' ').filter(Boolean);
    if (ws.length <= n) return s;
    return fromEnd ? '… ' + ws.slice(-n).join(' ') : ws.slice(0, n).join(' ') + ' …';
  };
  if (at < 0) return { before: cut(text, words * 2, false), match: null, after: '' };
  return {
    before: cut(text.slice(0, at).trim(), words, true),
    match: text.slice(at, at + want.length),
    after: cut(text.slice(at + want.length).trim(), words, false),
  };
}
