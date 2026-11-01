// The reply grammar (spec §7.2, phase 3): a person's own text above the quote, read forgivingly: the first non-empty
// line decides (OK, OK at <when>, CHANGES:), with PAID OK, NOTES: and the topic lines anywhere. Pure: no file, no
// clock but the one passed in; the timezone is automation.json's.
import type { Automation } from '../../shared/automation';

export interface ReplyNote {
  text: string;
  seconds?: number;
  scene?: string;
  sentence?: string;
}
export interface Decision {
  verdict: 'ok' | 'schedule' | 'changes' | 'topics';
  at?: string; // ISO, schedule
  notes?: ReplyNote[];
  paid?: 'all' | number[];
  topics?: { approve: string[] | 'all'; reject: { slug: string; note: string }[] | { all: string } };
  shadowMarks?: { n: number; mark: 'agree' | 'disagree' }[];
}

const ID = (prefix: string) => new RegExp(`\\b${prefix}-[0-9a-f]{12}\\b`);
export const requestIdIn = (text: string): string | null => ID('rq').exec(text)?.[0] ?? null;
export const batchIdIn = (text: string): string | null => ID('pb').exec(text)?.[0] ?? null;
export const correctionIdIn = (text: string): string | null => ID('ar').exec(text)?.[0] ?? null;

/** The person's own lines: everything before the first quote marker (a `>` block, `On … wrote:` on one line or
 *  wrapped over two, Outlook's `From:` header block or its rule, `-----Original Message-----`) and before a
 *  signature (`-- `, `Sent from my …`). */
export function ownText(body: string): string {
  const lines = body.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const t = l.trim();
    if (/^>/.test(t)) break;
    if (/^-+\s*Original Message\s*-+$/i.test(t)) break;
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

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/** The wall clock of an instant in a timezone. */
function wallClock(ms: number, timeZone: string) {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  });
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return {
    y: Number(p.year),
    m: Number(p.month),
    d: Number(p.day),
    h: Number(p.hour) % 24,
    mi: Number(p.minute),
    weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday),
  };
}
/** The instant whose wall clock in `timeZone` is the given one (DST resolved by two refinements). */
export function fromWallClock(y: number, m: number, d: number, h: number, mi: number, timeZone: string): number {
  let guess = Date.UTC(y, m - 1, d, h, mi);
  for (let i = 0; i < 3; i++) {
    const w = wallClock(guess, timeZone);
    const asUtc = Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi);
    const want = Date.UTC(y, m - 1, d, h, mi);
    if (asUtc === want) break;
    guess += want - asUtc;
  }
  return guess;
}
export function formatWallClock(ms: number, timeZone: string): string {
  const w = wallClock(ms, timeZone);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${w.y}-${pad(w.m)}-${pad(w.d)} ${pad(w.h)}:${pad(w.mi)}`;
}

/** A time of day: `15:00`, `3pm`, `9:30am`, `15`, `noon`, `midnight`. */
function timeOfDay(s: string): { h: number; mi: number } | null {
  const t = s.trim().toLowerCase();
  if (t === 'noon') return { h: 12, mi: 0 };
  if (t === 'midnight') return { h: 0, mi: 0 };
  const m = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/.exec(t);
  if (!m) return null;
  let h = Number(m[1]);
  const mi = Number(m[2] ?? '0');
  if (m[3] === 'pm' && h < 12) h += 12;
  if (m[3] === 'am' && h === 12) h = 0;
  return h < 24 && mi < 60 ? { h, mi } : null;
}

/** `<when>` after `OK at`, in the configured timezone, as an instant; null when unreadable. */
export function parseWhen(when: string, timeZone: string, now: Date): number | null {
  const w = when.trim().toLowerCase().replace(/\s+/g, ' ');
  const today = wallClock(now.getTime(), timeZone);
  const dayMs = 24 * 60 * 60 * 1000;
  let m = /^in (\d+) (hour|hours|minute|minutes|day|days)$/.exec(w);
  if (m) {
    const n = Number(m[1]);
    const unit = m[2].startsWith('hour') ? 60 * 60 * 1000 : m[2].startsWith('minute') ? 60 * 1000 : dayMs;
    return now.getTime() + n * unit;
  }
  m = /^(\d{4})-(\d{2})-(\d{2})(?:[ t](.+))?$/.exec(w);
  if (m) {
    const t = m[4] ? timeOfDay(m[4]) : { h: 9, mi: 0 };
    return t ? fromWallClock(Number(m[1]), Number(m[2]), Number(m[3]), t.h, t.mi, timeZone) : null;
  }
  m = /^(tomorrow|today)(?: (?:at )?(.+))?$/.exec(w);
  if (m) {
    const t = m[2] ? timeOfDay(m[2]) : { h: 9, mi: 0 };
    if (!t) return null;
    const base = fromWallClock(today.y, today.m, today.d, t.h, t.mi, timeZone);
    return m[1] === 'tomorrow' ? fromWallClock(...nextDay(today, timeZone, 1), t.h, t.mi, timeZone) : base;
  }
  m = /^(sun|mon|tue|wed|thu|fri|sat)[a-z]*(?: (?:at )?(.+))?$/.exec(w);
  if (m) {
    const want = WEEKDAYS.findIndex((d) => d.startsWith(m![1]));
    const t = m[2] ? timeOfDay(m[2]) : { h: 9, mi: 0 };
    if (!t) return null;
    let ahead = (want - today.weekday + 7) % 7;
    const sameDay = fromWallClock(today.y, today.m, today.d, t.h, t.mi, timeZone);
    if (ahead === 0 && sameDay <= now.getTime()) ahead = 7; // this weekday's time has passed: next week's
    const [y, mo, d] = nextDay(today, timeZone, ahead);
    return fromWallClock(y, mo, d, t.h, t.mi, timeZone);
  }
  const t = timeOfDay(w);
  if (t) {
    const at = fromWallClock(today.y, today.m, today.d, t.h, t.mi, timeZone);
    if (at > now.getTime()) return at;
    const [y, mo, d] = nextDay(today, timeZone, 1);
    return fromWallClock(y, mo, d, t.h, t.mi, timeZone);
  }
  return null;
}
/** The local date `days` after a local date. */
function nextDay(today: { y: number; m: number; d: number }, timeZone: string, days: number): [number, number, number] {
  const noon = fromWallClock(today.y, today.m, today.d, 12, 0, timeZone) + days * 24 * 60 * 60 * 1000;
  const w = wallClock(noon, timeZone);
  return [w.y, w.m, w.d];
}

const PLACED = /^\[([^\]]*)\]\s*(.*)$/;
/** A `CHANGES:` note line: `[m:ss sc20 s31] text`, any of the three places, in any order. */
export function parseNoteLine(line: string): ReplyNote {
  const m = PLACED.exec(line.trim());
  if (!m) return { text: line.trim() };
  const note: ReplyNote = { text: m[2].trim() || line.trim() };
  for (const tok of m[1].trim().split(/\s+/)) {
    const mmss = /^(\d+):([0-5]\d)$/.exec(tok);
    if (mmss) note.seconds = Number(mmss[1]) * 60 + Number(mmss[2]);
    else if (/^sc\d+$/.test(tok)) note.scene = tok;
    else if (/^s\d+$/.test(tok)) note.sentence = tok;
  }
  return note;
}

export type Parsed = { decision: Decision } | { problem: string; hint: string };

const HINT_RELEASE =
  'Reply with one of these as the first line, on its own: OK (publish now); OK at Thursday 15:00 (schedule, your time); CHANGES: then one note per line. PAID OK or PAID OK 1 on its own line approves the paid links shown. An OK with anything after it ("OK, but ...", "OK if ...", "OK?") is not applied: it is asked about instead.';
const HINT_TOPICS = 'Reply with lines like: APPROVE <slug>; REJECT <slug>: <why>; APPROVE ALL; REJECT ALL: <why>.';

/** Words that hold, negate or condition an approval when they follow an OK on a later line. A stoplist: any hit is a
 *  clarification (one mail back), never a publication. */
const CONTRADICTS =
  /\b(hold|wait|don'?t|do not|not yet|stop|cancel|never ?mind|unless|instead|actually|until|but|on second thought|no longer)\b/i;

/** Reads a person's own text. `kind` says which request it answers (what the hint lists). */
export function parseReply(
  text: string,
  a: Pick<Automation, 'schedule' | 'approvals'>,
  now: Date,
  kind: 'release' | 'draft' | 'topics' | 'correction' = 'release',
): Parsed {
  const lines = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.trim());
  const nonEmpty = lines.filter(Boolean);
  const first = nonEmpty[0] ?? '';
  const lower = first.toLowerCase();
  const paid = paidOf(lines);
  const shadowMarks = marksOf(lines);
  const extra = { ...(paid && { paid }), ...(shadowMarks && { shadowMarks }) };
  if (kind === 'topics') {
    const topics = topicsOf(lines);
    if (!topics) return { problem: 'could not read the reply', hint: HINT_TOPICS };
    return { decision: { verdict: 'topics', topics } };
  }
  // a release approval is unambiguous: OK alone on the first line (punctuation allowed), or OK at <when>; an OK with
  // anything else after it (a condition, a hold, a question) is asked about, never applied (conservative, not a
  // reading of what the words mean)
  if (/^ok[.!]*$/.test(lower)) {
    // a later own-text line that holds, negates or conditions the OK is asked about instead of applied: a closed
    // stoplist over the person's own lines (never the quote), not a reading of what they mean
    const rest = nonEmpty.slice(1).filter((l) => !/^(paid ok|notes:)/i.test(l));
    const contradiction = rest.find((l) => CONTRADICTS.test(l));
    if (contradiction)
      return {
        problem: `your reply says OK and then "${contradiction.slice(0, 60)}", which contradicts it, so nothing was published; reply OK on its own to publish, or CHANGES: with what to change`,
        hint: HINT_RELEASE,
      };
    return { decision: { verdict: 'ok', ...extra } };
  }
  const at = /^ok\s+at\s+(.+)$/i.exec(first);
  if (/^ok\b/.test(lower) && !at)
    return {
      problem: `"${first.slice(0, 60)}" is not a plain OK, so nothing was published; reply OK on its own to publish, or CHANGES: with what to change`,
      hint: HINT_RELEASE,
    };
  if (at) {
    const when = parseWhen(at[1].replace(/[.!]+$/, ''), a.schedule.timezone, now);
    if (when === null) return { problem: `could not read the time "${at[1]}"`, hint: HINT_RELEASE };
    const lead = a.approvals.scheduleLeadMinutes * 60_000;
    if (when - now.getTime() < lead) {
      const earliest = Math.ceil((now.getTime() + lead) / 300_000) * 300_000;
      return {
        problem: `${formatWallClock(when, a.schedule.timezone)} is less than ${a.approvals.scheduleLeadMinutes} minutes ahead`,
        hint: `The earliest time that would be accepted: OK at ${formatWallClock(earliest, a.schedule.timezone)} (${a.schedule.timezone}).`,
      };
    }
    return { decision: { verdict: 'schedule', at: new Date(when).toISOString(), ...extra } };
  }
  if (/^changes\b:?/i.test(first)) {
    const rest = nonEmpty.slice(1).filter((l) => !/^(paid ok|notes:)/i.test(l));
    const inline = first.replace(/^changes\b:?\s*/i, '').trim();
    const notes = [...(inline ? [inline] : []), ...rest].map(parseNoteLine).filter((n) => n.text);
    if (!notes.length) return { problem: 'CHANGES: needs at least one note line', hint: HINT_RELEASE };
    return { decision: { verdict: 'changes', notes, ...extra } };
  }
  return { problem: `could not read the reply (its first line is "${first.slice(0, 60)}")`, hint: HINT_RELEASE };
}

function paidOf(lines: string[]): 'all' | number[] | null {
  const found: number[] = [];
  let all = false;
  for (const l of lines) {
    const m = /^paid ok\b\s*:?\s*(.*)$/i.exec(l);
    if (!m) continue;
    const nums = m[1].match(/\d+/g);
    if (nums?.length) found.push(...nums.map(Number));
    else all = true;
  }
  return all ? 'all' : found.length ? [...new Set(found)].sort((x, y) => x - y) : null;
}
function marksOf(lines: string[]): { n: number; mark: 'agree' | 'disagree' }[] | null {
  const out: { n: number; mark: 'agree' | 'disagree' }[] = [];
  for (const l of lines) {
    const m = /^notes\s*:\s*(.+)$/i.exec(l);
    if (!m) continue;
    for (const part of m[1].split(/[,;]/)) {
      const x = /(\d+)\s*(agree|disagree)/i.exec(part);
      if (x) out.push({ n: Number(x[1]), mark: x[2].toLowerCase() as 'agree' | 'disagree' });
    }
  }
  return out.length ? out : null;
}
function topicsOf(lines: string[]): Decision['topics'] | null {
  const approve: string[] = [];
  const reject: { slug: string; note: string }[] = [];
  let all: 'approve' | { all: string } | null = null;
  for (const l of lines) {
    let m = /^approve all\b/i.exec(l);
    if (m) {
      all = 'approve';
      continue;
    }
    m = /^reject all\s*:\s*(.+)$/i.exec(l);
    if (m) {
      all = { all: m[1].trim() };
      continue;
    }
    m = /^approve\s+([a-z0-9-]+)\s*$/i.exec(l);
    if (m) {
      approve.push(m[1].toLowerCase());
      continue;
    }
    m = /^reject\s+([a-z0-9-]+)\s*:\s*(.+)$/i.exec(l);
    if (m) reject.push({ slug: m[1].toLowerCase(), note: m[2].trim() });
  }
  if (all === 'approve') return { approve: 'all', reject };
  if (all) return { approve, reject: all };
  if (!approve.length && !reject.length) return null;
  return { approve, reject };
}
