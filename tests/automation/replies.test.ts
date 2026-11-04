// The reply grammar (spec §7.2): a person's own text, read forgivingly; pure, the clock and timezone passed in.
import { describe, expect, it } from 'vitest';
import { batchIdIn, correctionIdIn, parseReply, parseWhen, requestIdIn } from '../../src/orchestration/run/replies';
import { DEFAULTS } from '../../src/shared/automation';
import { ownText } from '../../src/modules/mail';

const a = {
  ...DEFAULTS,
  schedule: { ...DEFAULTS.schedule, timezone: 'America/Los_Angeles' },
  approvals: { ...DEFAULTS.approvals, scheduleLeadMinutes: 30 },
};
// a Tuesday, 10:00 Pacific (PST)
const now = new Date('2026-11-10T18:00:00Z');
const ok = (text: string, kind?: 'release' | 'draft' | 'topics' | 'correction') => {
  const r = parseReply(text, a, now, kind);
  if ('problem' in r) throw new Error(`${r.problem}: ${r.hint}`);
  return r.decision;
};
const bad = (text: string, kind?: 'release' | 'draft' | 'topics' | 'correction') => {
  const r = parseReply(text, a, now, kind);
  if ('decision' in r) throw new Error(`parsed ${JSON.stringify(r.decision)}`);
  return r;
};

describe('ids', () => {
  it('finds an id in the subject or the own text, never in the quote only', () => {
    expect(requestIdIn('Re: Release request rq-0123456789ab')).toBe('rq-0123456789ab');
    expect(requestIdIn(ownText('OK\n\n> rq-0123456789ab'))).toBeNull();
    expect(requestIdIn('rq-0123456789abc')).toBeNull();
    expect(batchIdIn('topics pb-0123456789ab')).toBe('pb-0123456789ab');
    expect(correctionIdIn('ar-0123456789ab')).toBe('ar-0123456789ab');
  });
});

describe('parseReply', () => {
  it('OK stands alone on the first line (punctuation allowed, later lines free)', () => {
    expect(ok('OK')).toEqual({ verdict: 'ok' });
    expect(ok('OK!')).toEqual({ verdict: 'ok' });
    expect(ok('ok.\n\nthanks')).toEqual({ verdict: 'ok' });
    expect(ok('  Ok  \n> quoted')).toEqual({ verdict: 'ok' });
  });
  it('a conditional, contradictory or uncertain OK never publishes: it asks for a plain OK', () => {
    for (const text of [
      'OK, but hold off',
      'OK, not yet',
      'OK if we fix the title',
      'OK?',
      'OK, looks great!',
      'okay',
    ]) {
      const r = bad(text);
      expect(r.problem, text).toMatch(/plain OK|could not read/);
      expect(r.hint, text).toMatch(/\bOK\b/);
    }
    expect(bad('OK, but hold off').problem).toMatch(/"OK, but hold off"/);
    // a later own-text line that contradicts the OK (a hold, a negation, a condition) never publishes either
    for (const text of [
      'OK\nhold off',
      'OK\n\nActually, do not publish yet',
      "OK\ndon't publish until Thursday",
      'OK\nbut wait for the new thumbnail',
      'OK\nnot yet',
      'OK!\nStop, I found a typo',
    ]) {
      const r = bad(text);
      expect(r.problem, text).toMatch(/contradicts|not a plain OK/);
      expect(r.hint, text).toMatch(/\bOK\b/);
    }
    // ordinary trailing lines and the recognised extra lines stand
    expect(ok('OK\nthanks, Jon')).toEqual({ verdict: 'ok' });
    expect(ok('OK\nPAID OK\nNOTES: 1 agree')).toMatchObject({ verdict: 'ok', paid: 'all' });
    expect(ok('OK\n\nLooking forward to it. Jon')).toEqual({ verdict: 'ok' });
    expect(bad('OK at Thursday 15:00, but only if the title is fixed').problem).toMatch(/could not read the time/);
  });
  it('anything else is a problem whose hint names OK', () => {
    const r = bad('looks fine, go');
    expect(r.problem).toMatch(/could not read the reply/);
    expect(r.hint).toMatch(/\bOK\b/);
    expect(r.hint).toMatch(/CHANGES:/);
    expect(bad('').problem).toMatch(/could not read/);
  });
  it('OK at <when>: tomorrow 15:00 across the DST change in Los Angeles', () => {
    // Saturday 2026-10-31 10:00 PDT; Sunday 1 Nov the clocks go back at 02:00
    const sat = new Date('2026-10-31T17:00:00Z');
    const r = parseReply('OK at tomorrow 15:00', a, sat);
    expect(r).toEqual({ decision: { verdict: 'schedule', at: '2026-11-01T23:00:00.000Z' } }); // 15:00 PST
    expect(parseWhen('2026-11-01 15:00', 'America/Los_Angeles', sat)).toBe(Date.parse('2026-11-01T23:00:00Z'));
    expect(parseWhen('15:00', 'America/Los_Angeles', sat)).toBe(Date.parse('2026-10-31T22:00:00Z')); // today, PDT
  });
  it('OK at Thursday 15:00 is the coming Thursday; a weekday whose time has passed is next week', () => {
    expect(ok('OK at Thursday 15:00')).toEqual({ verdict: 'schedule', at: '2026-11-12T23:00:00.000Z' });
    expect(ok('OK at Tuesday 9am')).toEqual({ verdict: 'schedule', at: '2026-11-17T17:00:00.000Z' });
    expect(ok('OK at tomorrow 9am')).toEqual({ verdict: 'schedule', at: '2026-11-11T17:00:00.000Z' });
    expect(ok('OK at in 2 hours')).toEqual({ verdict: 'schedule', at: '2026-11-10T20:00:00.000Z' });
    expect(ok('OK at 2026-12-01 09:30')).toEqual({ verdict: 'schedule', at: '2026-12-01T17:30:00.000Z' });
  });
  it('a time under the lead is refused with the earliest accepted time', () => {
    const r = bad('OK at in 10 minutes');
    expect(r.problem).toMatch(/less than 30 minutes ahead/);
    expect(r.hint).toMatch(/OK at 2026-11-10 10:30 \(America\/Los_Angeles\)/);
    expect(bad('OK at someday').problem).toMatch(/could not read the time "someday"/);
  });
  it('CHANGES: with placed notes', () => {
    const d = ok('CHANGES:\n[1:05 sc20 s31] the number is wrong\nthe music is loud\n\n> quoted');
    expect(d.verdict).toBe('changes');
    expect(d.notes).toEqual([
      { text: 'the number is wrong', seconds: 65, scene: 'sc20', sentence: 's31' },
      { text: 'the music is loud' },
      { text: '> quoted' },
    ]);
    expect(ok('changes: trim the hook').notes).toEqual([{ text: 'trim the hook' }]);
    expect(ok('CHANGES:\n- say when the survey ran\n* keep the pounds\n2. [sc3] shorter').notes).toEqual([
      { text: 'say when the survey ran' },
      { text: 'keep the pounds' },
      { text: 'shorter', scene: 'sc3' },
    ]); // a list bullet is how a mail writes one note per line
    expect(bad('CHANGES:').problem).toMatch(/at least one note/);
  });
  it('PAID OK anywhere, alone or numbered', () => {
    expect(ok('OK\nPAID OK').paid).toBe('all');
    expect(ok('OK\npaid ok 3, 1').paid).toEqual([1, 3]);
    expect(ok('OK\nPAID OK 1\nPAID OK 1').paid).toEqual([1]);
    expect(ok('OK').paid).toBeUndefined();
    expect(ok('CHANGES: x\nPAID OK')).toMatchObject({ verdict: 'changes', paid: 'all', notes: [{ text: 'x' }] });
  });
  it('NOTES: shadow marks', () => {
    expect(ok('OK\nNOTES: 1 agree, 2 disagree').shadowMarks).toEqual([
      { n: 1, mark: 'agree' },
      { n: 2, mark: 'disagree' },
    ]);
  });
  it('topic batches', () => {
    expect(ok('APPROVE ALL', 'topics').topics).toEqual({ approve: 'all', reject: [] });
    expect(ok('approve heat-pumps\nREJECT ev-range: too thin', 'topics').topics).toEqual({
      approve: ['heat-pumps'],
      reject: [{ slug: 'ev-range', note: 'too thin' }],
    });
    expect(ok('REJECT ALL: not this month', 'topics').topics).toEqual({
      approve: [],
      reject: { all: 'not this month' },
    });
    expect(bad('OK', 'topics').hint).toMatch(/APPROVE <slug>/);
  });
});
