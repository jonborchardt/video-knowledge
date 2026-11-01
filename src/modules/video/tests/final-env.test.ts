// The Azure credential boundary: the key lives only in the narration worker process (azure-worker.ts, which imports
// the SDK and loads .env itself); the parent that imports the renderer tree, and so agent-written components, never
// reads it. `video final` and `narrate --voice azure` go through the worker per sentence.
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { ROOT } from '../../../shared/io';
import { type Boundary, forgetAzureKeys, workerEnv, workerSpeak } from '../tts/azure';
import { runWorker } from '../tts/azure-worker';

const tmp = mkdtempSync(join(tmpdir(), 'vk-azure-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));
const saved = { key: process.env.AZURE_SPEECH_KEY, region: process.env.AZURE_SPEECH_REGION };
afterEach(() => {
  if (saved.key === undefined) delete process.env.AZURE_SPEECH_KEY;
  else process.env.AZURE_SPEECH_KEY = saved.key;
  if (saved.region === undefined) delete process.env.AZURE_SPEECH_REGION;
  else process.env.AZURE_SPEECH_REGION = saved.region;
});

describe('the Azure boundary', () => {
  it('the provider file imports no SDK; only the worker does', () => {
    const provider = readFileSync(join(ROOT, 'src', 'modules', 'video', 'tts', 'azure.ts'), 'utf8');
    const worker = readFileSync(join(ROOT, 'src', 'modules', 'video', 'tts', 'azure-worker.ts'), 'utf8');
    expect(provider).not.toMatch(/microsoft-cognitiveservices-speech-sdk/);
    expect(provider).not.toMatch(/=\s*process\.env\.AZURE_SPEECH_KEY/); // never read here, only forgotten
    expect(worker).toMatch(/microsoft-cognitiveservices-speech-sdk/);
    expect(worker).toMatch(/loadDotEnv\(\)/);
  });
  it('workerEnv lets the worker load .env and keeps the agent markers out of it', () => {
    const e = workerEnv({ PATH: '/bin', VK_NO_DOTENV: '1', VK_AGENT: '1', VK_WRITABLE: 'x', VK_SHELL: '', CI: '1' });
    expect(e.PATH).toBe('/bin');
    expect(e.VK_NO_DOTENV).toBeUndefined();
    expect(e.VK_AGENT).toBeUndefined();
    expect(e.VK_WRITABLE).toBeUndefined();
  });
  it('workerSpeak runs the worker in its own process, hands it an .env-loading environment, and collects boundaries', async () => {
    const out = join(tmp, 'one.wav');
    const bs: Boundary[] = [];
    await workerSpeak('<speak>hello there world</speak>', out, (b) => bs.push(b), {
      argv: (ssmlFile, outFile) => [
        process.execPath,
        [join(ROOT, 'tests', 'automation', 'fake-tts-worker.mjs'), ssmlFile, outFile],
      ],
      env: { PATH: process.env.PATH, VK_NO_DOTENV: '1', VK_AGENT: '1' },
    });
    expect(existsSync(out)).toBe(true);
    expect(bs.map((b) => b.text)).toEqual(['hello', 'there', 'world']);
    const seen = JSON.parse(readFileSync(out + '.env.json', 'utf8')) as Record<string, string>;
    expect(seen.VK_NO_DOTENV).toBeUndefined();
    expect(seen.VK_AGENT).toBeUndefined();
    expect(existsSync(out + '.ssml')).toBe(false); // the ssml hand-off file is cleaned up
  });
  it('workerSpeak surfaces the worker’s failure as an error carrying its message', async () => {
    const out = join(tmp, 'two.wav');
    await expect(
      workerSpeak('<speak>x</speak>', out, () => {}, {
        argv: () => [
          process.execPath,
          ['-e', 'console.error("azure speech failed: No free synthesizer"); process.exit(1)'],
        ],
        env: { PATH: process.env.PATH },
      }),
    ).rejects.toThrow(/No free synthesizer/);
  });
  it('the worker reads the ssml file, writes the wav through the injected speak and prints the boundaries', async () => {
    const ssml = join(tmp, 'w.ssml');
    const out = join(tmp, 'w.wav');
    writeFileSync(ssml, '<speak>a b</speak>');
    let printed = '';
    await runWorker(
      [ssml, out],
      async (text, outFile, onBoundary) => {
        expect(text).toBe('<speak>a b</speak>');
        writeFileSync(outFile, 'wav');
        onBoundary({ text: 'a', offset: 0, duration: 1, type: 'WordBoundary' });
      },
      (s) => void (printed += s),
    );
    expect(readFileSync(out, 'utf8')).toBe('wav');
    expect(JSON.parse(printed).boundaries).toEqual([{ text: 'a', offset: 0, duration: 1, type: 'WordBoundary' }]);
  });
  it('forgetAzureKeys removes the key and region from the process and nothing else', () => {
    process.env.AZURE_SPEECH_KEY = 'k';
    process.env.AZURE_SPEECH_REGION = 'r';
    process.env.VK_FINAL_TEST_OTHER = 'keep';
    forgetAzureKeys();
    expect(process.env.AZURE_SPEECH_KEY).toBeUndefined();
    expect(process.env.AZURE_SPEECH_REGION).toBeUndefined();
    expect(process.env.VK_FINAL_TEST_OTHER).toBe('keep');
    delete process.env.VK_FINAL_TEST_OTHER;
  });
  it('the video CLI forgets the Azure keys right after loading .env, before any stage', () => {
    const cli = readFileSync(join(ROOT, 'src', 'modules', 'video', 'cli.ts'), 'utf8');
    const load = cli.indexOf('loadDotEnv();');
    const forget = cli.indexOf('forgetAzureKeys();');
    expect(load).toBeGreaterThan(0);
    expect(forget).toBeGreaterThan(load);
    expect(cli.slice(load, forget).split('\n').length).toBeLessThan(4);
  });
});
