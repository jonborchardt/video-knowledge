// Correlation (plan Revision log 6, Jon's final correction): the lookup returns every candidate; a tier with more
// than one distinct hit is ambiguous, matched to nothing; In-Reply-To wins over an id in the subject; the sender
// must be the person.
import { describe, expect, it } from 'vitest';
import { type Correlatable, correlate } from '../core/thread';

const qa: Correlatable = {
  messageId: '<a@x>',
  kind: 'question',
  id: 'qn-aaaaaaaaaaaa',
  createdAt: '2026-11-01T00:00:00.000Z',
};
const qb: Correlatable = {
  messageId: '<b@x>',
  kind: 'question',
  id: 'qn-bbbbbbbbbbbb',
  createdAt: '2026-11-02T00:00:00.000Z',
};
const rr: Correlatable = { messageId: '<r@x>', kind: 'release-request', createdAt: '2026-11-01T12:00:00.000Z' };
const all = [qa, qb, rr];
const lookup = (pred: (e: Correlatable) => boolean) => all.filter(pred);
const person = 'jon@example.test';
const mail = (over: Partial<Parameters<typeof correlate>[0]>) => ({
  from: 'Jon <Jon@Example.test>',
  inReplyTo: null,
  references: [] as string[],
  subject: 'Re: something',
  text: 'Use B',
  ...over,
});

describe('correlate', () => {
  it('a stranger never answers, even with a question id in the subject', () => {
    expect(correlate(mail({ from: 'mallory@example.test', subject: 'Re: qn-aaaaaaaaaaaa' }), lookup, person)).toEqual({
      thread: null,
      why: 'not-from-person',
    });
  });
  it('In-Reply-To decides over an id in the subject', () => {
    expect(correlate(mail({ inReplyTo: '<b@x>', subject: 'Re: [CoR] q qn-aaaaaaaaaaaa' }), lookup, person)).toEqual({
      thread: '<b@x>',
    });
  });
  it('two question ids in the subject with no thread header is ambiguous', () => {
    expect(correlate(mail({ subject: 'qn-aaaaaaaaaaaa and qn-bbbbbbbbbbbb' }), lookup, person)).toEqual({
      thread: null,
      why: 'ambiguous:qn-aaaaaaaaaaaa,qn-bbbbbbbbbbbb',
    });
  });
  it('an id in the own text decides; one only in the quote does not', () => {
    expect(correlate(mail({ text: 'see qn-aaaaaaaaaaaa\n\n> quoted qn-bbbbbbbbbbbb' }), lookup, person)).toEqual({
      thread: '<a@x>',
    });
  });
  it('References naming several sent mails picks the latest created', () => {
    expect(correlate(mail({ references: ['<a@x>', '<b@x>'] }), lookup, person)).toEqual({ thread: '<b@x>' });
  });
  it('a reply to a request threads to the request', () => {
    expect(correlate(mail({ inReplyTo: '<r@x>' }), lookup, person)).toEqual({ thread: '<r@x>' });
  });
  it('an In-Reply-To nothing sent falls through to the id tiers', () => {
    expect(correlate(mail({ inReplyTo: '<zz@elsewhere>', subject: 'Re: qn-aaaaaaaaaaaa' }), lookup, person)).toEqual({
      thread: '<a@x>',
    });
  });
  it('nothing matches: no-thread', () => {
    expect(correlate(mail({}), lookup, person)).toEqual({ thread: null, why: 'no-thread' });
  });
});
