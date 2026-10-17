// Figures in narration, assertions, quotes, chart values and passages all go through here, so a number written in
// words ("fourteen percent") is checked exactly like "14%", and "14" never matches inside "140" or "0.14".
// ponytail: cardinals up to the millions only; ordinals ("third"), fractions ("half", "quarter") and decimals spelled
// with "point" are left as words, so they can neither pass nor smuggle a figure.

const UNITS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};
const SCALES: Record<string, number> = { hundred: 100, thousand: 1000, million: 1_000_000 };
// A bare "one" is usually a pronoun or an article ("one trainer", "no one", "one-liner"); it is a figure only in a
// numeric phrase: "one in 238", "one percent", "one hundred", or joined to another number word ("twenty-one").
const ONE_NEXT = new Set(['in', 'percent', 'per', 'hundred', 'thousand', 'million']);

/** Replaces English cardinal number words with digits ("two hundred and eighty-five" -> "285"); everything else stays. */
export function wordsToDigits(text: string): string {
  const parts = text.split(/(\s+|-)/); // keep the separators so untouched text is returned byte for byte
  const out: string[] = [];
  let run: string[] = []; // separators and words of the number run being built, in case it is not one
  let total = 0;
  let current = 0;
  let value = false; // the run has a value (so "and" may continue it)
  let lastUnit: number | null = null; // the last unit word, to split "three seven"
  const flush = () => {
    if (value) {
      let k = run.length;
      while (k > 0 && /^(\s+|-)$/.test(run[k - 1])) k--; // separators after the last number word stay
      out.push(String(total + current), ...run.slice(k));
    } else out.push(...run);
    run = [];
    total = 0;
    current = 0;
    value = false;
    lastUnit = null;
  };
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    const w = p.toLowerCase();
    const next = parts[i + 2]?.toLowerCase();
    if (/^(\s+|-)$/.test(p) || p === '') {
      if (run.length) run.push(p);
      else out.push(p);
      continue;
    }
    if (w === 'one' && !value && !(next && ONE_NEXT.has(next))) {
      flush();
      out.push(p);
    } else if (w in UNITS) {
      // "twenty nine" joins; "three seven" (two unit words, no tens before) is two numbers, like spelled digits.
      if (value && lastUnit !== null && !(lastUnit >= 20 && UNITS[w] < 10)) flush();
      current += UNITS[w];
      lastUnit = UNITS[w];
      value = true;
      run.push(p);
    } else if (w === 'a' && next && next in SCALES) {
      current = 1;
      value = true;
      run.push(p);
    } else if (w in SCALES) {
      if (!value) {
        flush();
        out.push(p);
        continue;
      }
      if (w === 'hundred') current *= 100;
      else {
        total += current * SCALES[w];
        current = 0;
      }
      lastUnit = null;
      run.push(p);
    } else if (w === 'and' && value && next && (next in UNITS || next in SCALES)) {
      run.push(p);
    } else {
      flush();
      out.push(p);
    }
  }
  flush();
  return out.join('');
}

/** Digit figures with thousands separators removed, after number words become digits. */
export const nums = (text: string) =>
  [...wordsToDigits(text).matchAll(/\d[\d,]*(?:\.\d+)?/g)].map((m) => m[0].replaceAll(',', ''));

/** True when `figure` occurs as a whole number in the text: not inside a longer figure ("140") or after a decimal
 *  point ("0.14"). "1018350" does refer to "1018350.20": a narration may truncate the cents. */
export function hasFigure(haystack: string, figure: string): boolean {
  const hay = wordsToDigits(haystack).replaceAll(',', '');
  const f = figure.replaceAll(',', '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\d.])${f}(?!\\d)`).test(hay);
}
