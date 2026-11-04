// Run by hand: npx tsx src/modules/mail/tests/primitives-experiment.ts [dir] [rounds=100] [contenders=8]
// Measures, on the filesystem holding `dir`, which primitives give exactly one winner when separate processes race.
// It observes outcomes only; it says nothing about why a primitive behaves as it does. A round's winner counts as
// verified only when one process reported winning and the marker left in the target is that process's.
import { execFile } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const base = process.argv[2] ?? tmpdir();
const ROUNDS = Number(process.argv[3] ?? 100);
const N = Number(process.argv[4] ?? 8);
const root = mkdtempSync(join(base, 'vk-primitives-'));
const q = (p: string) => JSON.stringify(p);
const child = (code: string, at: number) =>
  new Promise<string>((res) =>
    execFile(
      process.execPath,
      ['-e', `const fs=require('fs');const at=${at};while(Date.now()<at){}${code}`],
      { windowsHide: true },
      (e, out) => res(String(out).trim()),
    ),
  );

interface Trial {
  label: string;
  prep: (d: string) => void;
  code: (d: string, i: number) => string;
  /** The markers left behind that name a winner, when the primitive leaves any. */
  markers?: (d: string) => string[];
}
async function run(t: Trial) {
  let multi = 0;
  let none = 0;
  let mismatch = 0;
  for (let r = 0; r < ROUNDS; r++) {
    const d = join(root, `r${r}`);
    mkdirSync(d);
    t.prep(d);
    const at = Date.now() + 150 * N;
    const outs = await Promise.all(Array.from({ length: N }, (_, i) => child(t.code(d, i), at)));
    const winners = outs.flatMap((o, i) => (o === 'ok' ? [i] : []));
    if (winners.length > 1) multi++;
    if (winners.length === 0) none++;
    if (t.markers && winners.length === 1) {
      const m = t.markers(d);
      if (m.length !== 1 || m[0] !== `owner.${winners[0]}`) mismatch++;
    }
    rmSync(d, { recursive: true, force: true });
  }
  console.log(
    `${t.label.padEnd(52)} more than one winner: ${multi}/${ROUNDS}  none: ${none}/${ROUNDS}` +
      (t.markers ? `  marker not the winner's: ${mismatch}/${ROUNDS}` : ''),
  );
}
const tmps = (d: string) => {
  for (let i = 0; i < N; i++) {
    mkdirSync(join(d, `t${i}`));
    writeFileSync(join(d, `t${i}`, `owner.${i}`), '');
  }
};
const held = (d: string) => readdirSync(join(d, 'held'));
const ok = `console.log('ok')`;
const fail = `console.log(e.code)`;

console.log(`node ${process.version} ${process.platform} dir ${root}; ${N} contenders per round`);
await run({
  label: 'rename one token file to distinct names',
  prep: (d) => writeFileSync(join(d, 'free'), ''),
  code: (d, i) => `try{fs.renameSync(${q(join(d, 'free'))},${q(join(d, `held.${i}`))});${ok}}catch(e){${fail}}`,
});
await run({
  label: "openSync(path, 'wx')",
  prep: () => {},
  code: (d) => `try{fs.openSync(${q(join(d, 'lock'))},'wx');${ok}}catch(e){${fail}}`,
});
await run({
  label: 'mkdirSync(path)',
  prep: () => {},
  code: (d) => `try{fs.mkdirSync(${q(join(d, 'held'))});${ok}}catch(e){${fail}}`,
});
await run({
  label: 'rename prepared dirs onto one absent target (acquire)',
  prep: tmps,
  code: (d, i) => `try{fs.renameSync(${q(join(d, `t${i}`))},${q(join(d, 'held'))});${ok}}catch(e){${fail}}`,
  markers: held,
});
await run({
  label: 'the same with an empty held/ to clear first (recovery)',
  prep: (d) => {
    tmps(d);
    mkdirSync(join(d, 'held'));
  },
  code: (d, i) =>
    `let won=false;for(let n=0;n<500&&!won;n++){try{fs.renameSync(${q(join(d, `t${i}`))},${q(join(d, 'held'))});won=true}catch(e){try{fs.rmdirSync(${q(join(d, 'held'))})}catch{}}}console.log(won?'ok':'lost')`,
  markers: held,
});
rmSync(root, { recursive: true, force: true });
