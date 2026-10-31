// `video final` is the one renderer-loading verb that holds a secret (the Azure key for its narration); after the
// narration it forgets the key so the render, QA and package phases, and anything they spawn, run without it.
import { afterEach, describe, expect, it } from 'vitest';
import { forgetAzureKeys } from '../tts/azure';

const saved = { key: process.env.AZURE_SPEECH_KEY, region: process.env.AZURE_SPEECH_REGION };
afterEach(() => {
  if (saved.key === undefined) delete process.env.AZURE_SPEECH_KEY;
  else process.env.AZURE_SPEECH_KEY = saved.key;
  if (saved.region === undefined) delete process.env.AZURE_SPEECH_REGION;
  else process.env.AZURE_SPEECH_REGION = saved.region;
});

describe('forgetAzureKeys', () => {
  it('removes the Azure key and region from the process and nothing else', () => {
    process.env.AZURE_SPEECH_KEY = 'k';
    process.env.AZURE_SPEECH_REGION = 'r';
    process.env.VK_FINAL_TEST_OTHER = 'keep';
    forgetAzureKeys();
    expect(process.env.AZURE_SPEECH_KEY).toBeUndefined();
    expect(process.env.AZURE_SPEECH_REGION).toBeUndefined();
    expect(process.env.VK_FINAL_TEST_OTHER).toBe('keep');
    delete process.env.VK_FINAL_TEST_OTHER;
  });
});
