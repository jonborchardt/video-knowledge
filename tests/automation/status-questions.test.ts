// `npm run run -- status` is where a session looks first: the open mail questions are on it, an answer nobody accepted
// yet told apart from a question nobody answered, and listing never acknowledges anything.
import { describe, expect, it } from 'vitest';
import type { Question, QuestionState } from '../../src/modules/mail';
import { renderStatus } from '../../src/orchestration/run/status';

const q = (over: Partial<Question & QuestionState>): Question & QuestionState => ({
  messageId: '<m@x>',
  kind: 'question',
  id: 'qn-aaaaaaaaaaaa',
  subject: '[CoR] which one qn-aaaaaaaaaaaa',
  to: 'jon@example.test',
  from: 'bot@example.test',
  createdAt: '2026-11-04T16:07:30.000Z',
  sentAt: '2026-11-04T16:07:32.000Z',
  attempts: 1,
  about: 'heat-pumps/release',
  status: 'unattended',
  late: false,
  seen: false,
  ...over,
});

describe('status and the open mail questions', () => {
  it('lists an answered, unaccepted question apart from an unanswered one, with the verb that moves each', () => {
    const out = renderStatus(
      [],
      [
        q({}),
        q({
          id: 'qn-bbbbbbbbbbbb',
          subject: '[CoR] the other qn-bbbbbbbbbbbb',
          status: 'answered',
          answers: [{ messageId: '<r@x>', from: 'jon@example.test', at: 'a', recordedAt: 'b', text: 'Use B' }],
        }),
      ],
    );
    expect(out).toMatch(/^no runs$/m);
    expect(out).toMatch(/^Mail questions/m);
    expect(out).toMatch(/qn-aaaaaaaaaaaa .*unanswered, nobody waiting.*ask --resume qn-aaaaaaaaaaaa/);
    expect(out).toMatch(/qn-bbbbbbbbbbbb .*answered, not yet accepted.*questions --ack qn-bbbbbbbbbbbb/);
    expect(out).toContain('about heat-pumps/release');
  });
  it('says nothing about mail when there is no open question', () => {
    expect(renderStatus([], [])).not.toMatch(/Mail questions/);
  });
});
