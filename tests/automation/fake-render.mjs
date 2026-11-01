#!/usr/bin/env node
// A stand-in for `npm run video -- spike` in the crash test: one marker per storyboard scene under video/scenes/,
// written only when missing (as Remotion's chunk cache keeps a rendered scene), with a sleep per scene so a kill
// lands mid-render; at the end the prepared build report is copied in, as a finished spike leaves one.
//   node fake-render.mjs <story dir> <sleep ms> <build report template>
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [dir, sleepMs, template] = process.argv.slice(2);
const sb = JSON.parse(readFileSync(join(dir, 'storyboard.json'), 'utf8'));
const scenes = join(dir, 'video', 'scenes');
mkdirSync(scenes, { recursive: true });
for (const s of sb.scenes) {
  const marker = join(scenes, `${s.id}.marker`);
  if (existsSync(marker)) continue;
  await new Promise((r) => setTimeout(r, Number(sleepMs)));
  writeFileSync(marker, `${s.id} rendered at ${Date.now()}\n`);
}
copyFileSync(template, join(dir, 'video', 'build-report.json'));
process.stdout.write('RESULT: PASSED\n');
