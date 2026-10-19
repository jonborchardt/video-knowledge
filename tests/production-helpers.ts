// A copy of one committed topic in a temp root, so board tests can edit artifacts without touching the repo.
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from '../src/lib/io';
import { scriptDir } from '../src/lib/script';

const SKIP = ['store/transcripts', '/work', '/video/scenes', '/video/narration', '/video/frames'];
const SKIP_EXT = ['.pdf', '.mp4', '.wav', '.png'];

export function copyTopic(topic: string): { root: string; dir: (storyId: string) => string; cleanup: () => void } {
  const root = mkdtempSync(join(tmpdir(), 'vk-topic-'));
  cpSync(join(ROOT, topic), join(root, topic), {
    recursive: true,
    filter: (src) => {
      const f = src.replaceAll('\\', '/');
      return !SKIP.some((s) => f.includes(s)) && !SKIP_EXT.some((e) => f.endsWith(e));
    },
  });
  return {
    root,
    dir: (storyId) => scriptDir(topic, storyId, root),
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}
