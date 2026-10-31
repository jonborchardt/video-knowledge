// Figures in narration, assertions, quotes, chart values and passages all go through here, so a number written in
// words ("fourteen percent") is checked exactly like "14%", and "14" never matches inside "140" or "0.14".
// ponytail: cardinals up to the billions only; ordinals ("third"), fractions ("half", "quarter") and decimals spelled
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
const SCALES: Record<string, number> = { hundred: 100, thousand: 1000, million: 1_000_000, billion: 1_000_000_000 };
// A bare "one" is usually a pronoun or an article ("one trainer", "no one", "one-liner"); it is a figure only in a
// numeric phrase: "one in 238", "one percent", "one hundred", or joined to another number word ("twenty-one").
const ONE_NEXT = new Set(['in', 'percent', 'per', 'hundred', 'thousand', 'million', 'billion']);
const SEP = /^(\s+|-)$/;
// A token is punctuation, a word, punctuation: "fifteen." or "\"fifteen\"" still carries the number word.
const splitToken = (p: string) => {
  const m = p.match(/^([^A-Za-z0-9$]*)([A-Za-z]+|\$?\d[\d,]*(?:\.\d+)?)(.*)$/);
  return m ? { pre: m[1], core: m[2], post: m[3] } : { pre: '', core: p, post: '' };
};

/** Replaces English cardinal number words with digits ("two hundred and eighty-five" -> "285"), and folds a scale word
 *  after a digit figure into it ("1.5 million" -> "1500000"); everything else stays byte for byte. */
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
      while (k > 0 && SEP.test(run[k - 1])) k--; // separators after the last number word stay
      out.push(String(total + current), ...run.slice(k));
    } else out.push(...run);
    run = [];
    total = 0;
    current = 0;
    value = false;
    lastUnit = null;
  };
  const nextCore = (i: number) => splitToken(parts[i + 2] ?? '').core.toLowerCase();
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (SEP.test(p) || p === '') {
      if (run.length) run.push(p);
      else out.push(p);
      continue;
    }
    const { pre, core, post } = splitToken(p);
    const w = core.toLowerCase();
    const next = nextCore(i);
    if (pre) {
      flush();
      out.push(pre);
    }
    // A digit figure followed by a scale word: "601 million" -> "601000000".
    const digits = core.match(/^(\$?)(\d[\d,]*(?:\.\d+)?)$/);
    if (digits && !post && next in SCALES && !splitToken(parts[i + 2]).pre) {
      flush();
      const scaled = Math.round(Number(digits[2].replaceAll(',', '')) * SCALES[next]);
      out.push(`${digits[1]}${scaled}${splitToken(parts[i + 2]).post}`);
      i += 2;
      continue;
    }
    if (w === 'one' && !value && !(next && ONE_NEXT.has(next))) {
      flush();
      out.push(core);
    } else if (w in UNITS) {
      // "twenty nine" joins; "three seven" (two unit words, no tens before) is two numbers, like spelled digits.
      if (value && lastUnit !== null && !(lastUnit >= 20 && UNITS[w] < 10)) flush();
      current += UNITS[w];
      lastUnit = UNITS[w];
      value = true;
      run.push(core);
    } else if (w === 'a' && next && next in SCALES) {
      current = 1;
      value = true;
      run.push(core);
    } else if (w in SCALES) {
      if (!value) {
        flush();
        out.push(core);
      } else {
        if (w === 'hundred') current *= 100;
        else {
          total += current * SCALES[w];
          current = 0;
        }
        lastUnit = null;
        run.push(core);
      }
    } else if (w === 'and' && value && next && (next in UNITS || next in SCALES)) {
      run.push(core);
    } else {
      flush();
      out.push(core);
    }
    if (post) {
      flush(); // punctuation ends a number run: "fifteen." -> "15."
      out.push(post);
    }
  }
  flush();
  return out.join('');
}

/** Digit figures with thousands separators removed, after number words become digits. */
export const nums = (text: string) =>
  [...wordsToDigits(text).matchAll(/\d[\d,]*(?:\.\d+)?/g)].map((m) => m[0].replaceAll(',', ''));

/** Words as spoken: a numeral takes longer than one word ("1,018,350" is six), a currency sign and a percent sign
 *  are a word each. ponytail: digits * 0.7 is a flat rate; a real TTS reports its own timing. */
export function spokenWords(text: string): number {
  let n = 0;
  for (const token of text.split(/\s+/).filter(Boolean)) {
    const m = token.match(/(\$?)(\d[\d,]*(?:\.\d+)?)(%?)/);
    if (!m) n += 1;
    else
      n +=
        Math.max(1, Math.ceil(m[2].replaceAll(',', '').replace('.', '').length * 0.7)) +
        (m[1] ? 1 : 0) +
        (m[3] ? 1 : 0);
  }
  return n;
}

/** True when `figure` occurs as a whole number in the text: not inside a longer figure ("140"), not after a decimal
 *  point ("0.14") and not as the integer part of a decimal ("14" in "14.5"); only a figure of four or more digits may
 *  drop its decimals ("1018350" for "$1,018,350.20"), so a narration may truncate the cents of a large amount. */
export function hasFigure(haystack: string, figure: string): boolean {
  const hay = wordsToDigits(haystack).replaceAll(',', '');
  const plain = figure.replaceAll(',', '');
  const f = plain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const after = plain.replace(/\..*$/, '').length >= 4 ? '(?!\\d)' : '(?!\\.?\\d)';
  return new RegExp(`(^|[^\\d.])${f}${after}`).test(hay);
}
