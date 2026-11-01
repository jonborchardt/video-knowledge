// Channel credentials per commission (register D18): a commission with its own OAuth client file resolves to it,
// one without falls back to the single default; the consent flow writes the refresh token into the commission's
// file and leaves the default untouched.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readJson } from '../../../shared/io';
import { credentialsVar, loadCredentials, saveRefreshToken } from '../youtube';

let root = '';
afterEach(() => root && rmSync(root, { recursive: true, force: true }));
const client = (id: string) => JSON.stringify({ installed: { client_id: id, client_secret: `${id}-secret` } });

describe('loadCredentials per commission', () => {
  it('a commission with its own path resolves to its file; one without falls back to the default', () => {
    root = mkdtempSync(join(tmpdir(), 'vk-creds-'));
    writeFileSync(join(root, 'default.json'), client('default'));
    writeFileSync(join(root, 'spending.json'), client('spending'));
    const env = {
      YOUTUBE_OAUTH_CREDENTIALS_PATH: './default.json',
      YOUTUBE_OAUTH_CREDENTIALS_PATH_SPENDING: './spending.json',
    };
    expect(credentialsVar('spending')).toBe('YOUTUBE_OAUTH_CREDENTIALS_PATH_SPENDING');
    expect(credentialsVar('public-health')).toBe('YOUTUBE_OAUTH_CREDENTIALS_PATH_PUBLIC_HEALTH');
    const s = loadCredentials(root, env, { requireToken: false, commission: 'spending' });
    expect(s.clientId).toBe('spending');
    expect(s.store).toBe(join(root, 'spending.json'));
    const d = loadCredentials(root, env, { requireToken: false, commission: 'public-health' });
    expect(d.clientId).toBe('default');
    expect(d.store).toBe(join(root, 'default.json'));
    expect(loadCredentials(root, env, { requireToken: false }).clientId).toBe('default');
    expect(() =>
      loadCredentials(
        root,
        { ...env, YOUTUBE_OAUTH_CREDENTIALS_PATH_SPENDING: './nope.json' },
        { requireToken: false, commission: 'spending' },
      ),
    ).toThrow(/YOUTUBE_OAUTH_CREDENTIALS_PATH_SPENDING names .\/nope.json/);
  });
  it('the consent flow stores the token in the commission file and leaves the default untouched', () => {
    root = mkdtempSync(join(tmpdir(), 'vk-creds-'));
    writeFileSync(join(root, 'default.json'), client('default'));
    writeFileSync(join(root, 'spending.json'), client('spending'));
    const env = {
      YOUTUBE_OAUTH_CREDENTIALS_PATH: './default.json',
      YOUTUBE_OAUTH_CREDENTIALS_PATH_SPENDING: './spending.json',
    };
    const s = loadCredentials(root, env, { requireToken: false, commission: 'spending' });
    saveRefreshToken(s.store!, 'tok-spending'); // what authorize does once the browser answers
    expect(readJson<{ refresh_token?: string; installed: { client_id: string } }>(join(root, 'spending.json'))).toEqual(
      {
        installed: { client_id: 'spending', client_secret: 'spending-secret' },
        refresh_token: 'tok-spending',
      },
    );
    expect(readJson<{ refresh_token?: string }>(join(root, 'default.json'))!.refresh_token).toBeUndefined();
    expect(loadCredentials(root, env, { commission: 'spending' }).refreshToken).toBe('tok-spending');
    expect(() => loadCredentials(root, env, { commission: 'public-health' })).toThrow(/no refresh token/);
  });
});
