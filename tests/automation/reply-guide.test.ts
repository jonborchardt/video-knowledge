// Every mail opens with what a reply to it does (REPLY_GUIDE), so the person never answers the wrong one.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { FakeMailer } from './fake-mailer';
import { REPLY_GUIDE } from '../../src/orchestration/run/notify';

const root = mkdtempSync(join(tmpdir(), 'vk-guide-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));

describe('reply guide', () => {
  it('a draft request says to reply OK or CHANGES:, a halt says no reply is read', async () => {
    const mail = new FakeMailer(root);
    const out = { from: 'a@example.test', to: 'j@example.test', subject: 's', text: 'the body' };
    await mail.sendTracked(out, 'draft-request');
    await mail.sendTracked(out, 'halt');
    expect(mail.sent[0].text).toBe(`${REPLY_GUIDE['draft-request']}\n\nthe body`);
    expect(REPLY_GUIDE['draft-request']).toMatch(/^ACTION NEEDED\. Reply OK/);
    expect(mail.sent[1].text.startsWith('NO REPLY NEEDED')).toBe(true);
  });
});
