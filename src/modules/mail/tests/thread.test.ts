// The thread core: the person's own words above the quote, addresses, thread membership, question ids.
import { describe, expect, it } from 'vitest';
import { htmlToText } from '../core/transport';
import { address, ownText, questionIdsIn } from '../core/thread';

describe('ownText', () => {
  it('keeps the lines above a quoted block and drops the signature', () => {
    expect(ownText('OK\r\n\r\n-- \r\nJon\r\n')).toBe('OK');
    expect(ownText('OK\n\n> Release request rq-0123456789ab\n> ...')).toBe('OK');
    expect(ownText('OK\n\nOn Tue, 10 Nov 2026 at 09:00, Commonwealth <bot@x.org> wrote:\n> hi')).toBe('OK');
    expect(ownText('OK\n\nOn Tue, 10 Nov 2026 at 09:00, Commonwealth of Reason\n<bot@x.org> wrote:\n> hi')).toBe('OK');
    expect(ownText('OK\n\nFrom: Commonwealth <bot@x.org>\nSent: Tuesday\nTo: jon\nSubject: x\n\nrequest')).toBe('OK');
    expect(ownText('OK\n\n-----Original Message-----\nFrom: x')).toBe('OK');
    expect(ownText('Sent from my iPhone\n\nOK')).toBe('OK');
  });
  it('reads the common real-world reply shapes', () => {
    // a phone: the answer, the mobile signature, the quoted question
    expect(
      ownText('Use B\n\nSent from my iPhone\n\n> On Nov 3, 2026, at 09:00, Commonwealth <bot@x> wrote:\n> A or B?'),
    ).toBe('Use B');
    // Outlook: the rule and the header block below the answer
    expect(
      ownText(
        'Use B\n\n________________________________\nFrom: Commonwealth <bot@x>\nSent: Tuesday\nTo: Jon\nSubject: q\n\nA or B?',
      ),
    ).toBe('Use B');
    // an HTML-only client, through the transport's text extraction first
    const html =
      '<div dir="ltr">Use B</div><br><div class="gmail_quote">On Tue, Nov 3, 2026 at 9:00 Commonwealth &lt;bot@x&gt; wrote:<br><blockquote>A or B?</blockquote></div>';
    expect(ownText(htmlToText(html))).toBe('Use B');
    // a forward: the forwarded header block is quoted material
    expect(
      ownText(
        'Use B\n\n---------- Forwarded message ---------\nFrom: Someone <s@x>\nDate: Tue\nSubject: q\nTo: Jon\n\nbody',
      ),
    ).toBe('Use B');
    // a bottom-posted reply has no own words above the quote: empty, by the documented contract (reply above the quote)
    expect(ownText('> A or B?\nUse B')).toBe('');
  });
});

describe('address, questionIdsIn', () => {
  it('address strips the display name and case', () => {
    expect(address('Jon B <Jon@Example.test>')).toBe('jon@example.test');
    expect(address('  jon@example.test ')).toBe('jon@example.test');
  });
  it('questionIdsIn finds every distinct qn- id in order', () => {
    expect(questionIdsIn('Re: [CoR] which one qn-0123456789ab')).toEqual(['qn-0123456789ab']);
    expect(questionIdsIn('qn-aaaaaaaaaaaa and qn-bbbbbbbbbbbb and qn-aaaaaaaaaaaa')).toEqual([
      'qn-aaaaaaaaaaaa',
      'qn-bbbbbbbbbbbb',
    ]);
    expect(questionIdsIn('qn-0123456789abc no id here')).toEqual([]);
  });
});
