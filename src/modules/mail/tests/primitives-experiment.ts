// Run by hand (npx tsx src/modules/mail/tests/primitives-experiment.ts): which filesystem primitives are exclusive under
// contention on this machine. It decided core/mutex.ts: on Windows a rename works on the file a handle points at, so
// renaming one token FILE had 2+ winners in 40 of 40 rounds; exclusive create, mkdir and the rename of distinct
// prepared DIRECTORIES onto one target had exactly one. About 160 short-lived processes; a minute or two.
// Which primitives are exclusive under contention on this platform? Each round, N children race on one target.
import { execFile } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const N = 6,
  ROUNDS = 40;
const d = mkdtempSync(join(tmpdir(), 'vk-atomic-'));
const child = (code: string, at: number) =>
  new Promise((res) =>
    execFile(
      process.execPath,
      ['-e', `const at=${at}; while(Date.now()<at){} ${code}`],
      { windowsHide: true },
      (e, out) => res(String(out).trim()),
    ),
  );
async function trial(label: string, prep: (r: number) => void, code: (r: number, i: number) => string) {
  let both = 0,
    none = 0;
  for (let r = 0; r < ROUNDS; r++) {
    prep(r);
    const at = Date.now() + 700;
    const outs = await Promise.all(Array.from({ length: N }, (_, i) => child(code(r, i), at)));
    const ok = outs.filter((o) => o === 'ok').length;
    if (ok > 1) both++;
    if (ok === 0) none++;
  }
  console.log(label.padEnd(44), `rounds with >1 winner: ${both}/${ROUNDS}, with 0: ${none}`);
}
const q = (p: string) => JSON.stringify(p);
// 1. rename of one token file to distinct names (the rename-token lock)
await trial(
  'rename free -> held.i (file token)',
  (r) => {
    rmSync(join(d, 'f' + r), { recursive: true, force: true });
    mkdirSync(join(d, 'f' + r));
    writeFileSync(join(d, 'f' + r, 'free'), '');
  },
  (r, i) =>
    `try{require('fs').renameSync(${q(join(d, 'f' + r, 'free'))},${q(join(d, 'f' + r, 'held.' + i))});console.log('ok')}catch(e){console.log(e.code)}`,
);
// 2. exclusive create of one file
await trial(
  "openSync(path, 'wx')",
  (r) => {
    rmSync(join(d, 'x' + r), { recursive: true, force: true });
    mkdirSync(join(d, 'x' + r));
  },
  (r) =>
    `try{require('fs').openSync(${q(join(d, 'x' + r, 'lock'))},'wx');console.log('ok')}catch(e){console.log(e.code)}`,
);
// 3. mkdir of one directory
await trial(
  'mkdirSync(path)',
  (r) => {
    rmSync(join(d, 'm' + r), { recursive: true, force: true });
    mkdirSync(join(d, 'm' + r));
  },
  (r) => `try{require('fs').mkdirSync(${q(join(d, 'm' + r, 'held'))});console.log('ok')}catch(e){console.log(e.code)}`,
);
// 4. rename of distinct prepared dirs (each with a marker) onto one target name
await trial(
  'rename tmp_i/ -> held/ (prepared dirs)',
  (r) => {
    rmSync(join(d, 'p' + r), { recursive: true, force: true });
    mkdirSync(join(d, 'p' + r));
    for (let i = 0; i < N; i++) {
      mkdirSync(join(d, 'p' + r, 't' + i));
      writeFileSync(join(d, 'p' + r, 't' + i, 'owner.' + i), '');
    }
  },
  (r, i) =>
    `try{require('fs').renameSync(${q(join(d, 'p' + r, 't' + i))},${q(join(d, 'p' + r, 'held'))});console.log('ok')}catch(e){console.log(e.code)}`,
);
// 5. rename a prepared dir onto an existing EMPTY dir: replaces or fails?
const e = join(d, 'empty');
mkdirSync(join(e, 'held'), { recursive: true });
mkdirSync(join(e, 't'));
writeFileSync(join(e, 't', 'owner'), '');
try {
  const { renameSync } = await import('node:fs');
  renameSync(join(e, 't'), join(e, 'held'));
  console.log('rename onto empty dir: replaced; held now has', readdirSync(join(e, 'held')));
} catch (err) {
  console.log('rename onto empty dir: fails with', (err as NodeJS.ErrnoException).code);
}
