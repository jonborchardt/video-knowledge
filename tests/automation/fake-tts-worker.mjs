#!/usr/bin/env node
// Stands in for the Azure narration worker: writes a fake wav, dumps its environment beside it, prints boundaries.
//   node fake-tts-worker.mjs <ssmlFile> <outFile>
import { readFileSync, writeFileSync } from 'node:fs';
const [ssmlFile, outFile] = process.argv.slice(2);
const ssml = readFileSync(ssmlFile, 'utf8');
writeFileSync(outFile, Buffer.from('RIFF-fake'));
writeFileSync(outFile + '.env.json', JSON.stringify(process.env));
const words = ssml
  .replace(/<[^>]+>/g, ' ')
  .trim()
  .split(/\s+/);
process.stdout.write(
  JSON.stringify({
    boundaries: words.map((text, i) => ({ text, offset: i * 5_000_000, duration: 4_000_000, type: 'WordBoundary' })),
  }) + '\n',
);
