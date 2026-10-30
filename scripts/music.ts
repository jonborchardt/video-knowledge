// npm run music -- <command> ...
//   import <composition> --source <song.strudel> [--repo <strudel-bench dir>] [--title "<t>"] [--crossfade <s>] [--cleared "<why>"] <wav> ...
//                                 register rendered sections as music/<composition>/: copies each WAV (named <song>.<section>.wav by
//                                 strudel-bench's render), the source and writes composition.json (sha, tempo, key, packs, provenance)
//   render <composition> [--port 3000]  ask the strudel-bench page that is open (npm run headless there) to render every variation again
//                                 from its recorded command, then import the result; needs STRUDEL_BENCH=<dir>
//   show <composition>              the manifest in one screen
//   cues <topic> <story-id> [--composition <id>] [--force]
//                                 draft <story>/video/music.json from the script's sections over a cleared composition (kept unless --force)
// Compositions are written in strudel-bench (https://github.com/jonborchardt/strudel-bench); this repo only keeps the
// rendered sections, their provenance and the cue sheets that place them (video/music.json).
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { readJson, sha, toJson, ROOT } from '../src/shared/io';
import { probe } from '../src/shared/ffmpeg';
import { FILES, scriptDir } from '../src/shared/io';
import type { Script, Storyboard } from '../src/shared/types';
import { COMPOSITION_FILE, type Composition, MUSIC_DIR, type Variation, loadComposition } from '../src/video/music';
import { compositions, draftCueSheet, pickComposition } from '../src/video/music-draft';

const [cmd, id, ...rest] = process.argv.slice(2);
const flag = (name: string) => {
  const i = rest.indexOf(name);
  return i >= 0 ? rest[i + 1] : undefined;
};
const positional = rest.filter((a, i) => !a.startsWith('--') && !(i > 0 && rest[i - 1].startsWith('--')));
const usage = () => {
  console.error(
    readFileSync(new URL(import.meta.url), 'utf8')
      .split('\n')
      .slice(0, 10)
      .map((l) => l.replace(/^\/\/ ?/, ''))
      .join('\n'),
  );
  process.exit(1);
};
if (!cmd || !id) usage();
const dir = join(ROOT, MUSIC_DIR, id);

/** What the song header declares: tempo, key, packs. The header is JavaScript; these are read by pattern, not run. */
function readHeader(source: string) {
  const num = (k: string) => {
    const m = new RegExp(`\\b${k}:\\s*([\\d.]+)`).exec(source);
    return m ? Number(m[1]) : undefined;
  };
  const cps = num('cps') ?? (num('bpm') ? num('bpm')! / 60 / 4 : 0.5);
  const key = /\bkey:\s*'([^']+)'/.exec(source)?.[1] ?? 'C:minor';
  const packsSrc = /packs:\s*\[([^\]]*)\]/.exec(source)?.[1] ?? '';
  const packs = [...packsSrc.matchAll(/'([^']+)'/g)].map((m) => m[1]);
  const soundfonts = [...new Set([...source.matchAll(/\bgm_[a-z0-9_]+/g)].map((m) => m[0]))];
  return { cps, bpm: Math.round(cps * 60 * 4), key, packs, soundfonts };
}

function gitVersion(repo: string | undefined, sourceFile: string): string {
  if (!repo) return 'unknown';
  const git = (args: string[]) => spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).stdout.trim();
  const head = git(['rev-parse', '--short', 'HEAD']);
  if (!head) return 'unknown (not a git checkout)';
  const status = git(['status', '--porcelain', '--', sourceFile]);
  return status ? `${head} (${sourceFile} ${status.startsWith('??') ? 'not yet committed' : 'modified'})` : head;
}

function packLicences(repo: string | undefined, packs: string[]): Composition['licence']['samples'] {
  return packs.map((pack) => {
    const p = repo
      ? readJson<{ licence?: string; license?: string; source?: string; attribution?: string }>(
          join(repo, 'samples', 'user', pack, 'pack.json'),
        )
      : null;
    return {
      pack,
      licence: p?.licence ?? p?.license ?? 'unknown: see the pack in strudel-bench',
      source: p?.source ?? (repo ? `samples/user/${pack}` : 'strudel-bench'),
      ...(p?.attribution ? { attribution: p.attribution } : {}),
    };
  });
}

function importWavs(
  wavs: string[],
  opts: { source: string; repo?: string; title?: string; crossfade?: number; cleared?: string },
) {
  const source = resolve(opts.source);
  if (!existsSync(source)) throw new Error(`no source ${source}`);
  const text = readFileSync(source, 'utf8');
  const song = basename(source).replace(/\.strudel$/, '');
  const h = readHeader(text);
  mkdirSync(dir, { recursive: true });
  const old = readJson<Composition>(join(dir, COMPOSITION_FILE));
  copyFileSync(source, join(dir, 'source.strudel'));
  const variations: Record<string, Variation> = { ...(old?.variations ?? {}) };
  for (const wav of wavs) {
    const m = new RegExp(`^${song}\\.(.+)\\.wav$`).exec(basename(wav));
    if (!m)
      throw new Error(
        `${basename(wav)} is not ${song}.<section>.wav (strudel-bench's render --section <s> --name ${song}.<s>)`,
      );
    const section = m[1];
    const file = `${section}.wav`;
    copyFileSync(wav, join(dir, file));
    const bytes = readFileSync(join(dir, file));
    const seconds = probe(join(dir, file)).duration;
    const cycles = Math.round(seconds * h.cps);
    variations[section] = {
      file,
      sha: sha(bytes),
      seconds: Math.round(seconds * 1000) / 1000,
      cycles,
      loop: true,
      crossfade: opts.crossfade ?? old?.variations[section]?.crossfade ?? 1 / h.cps, // one bar
      ...(old?.variations[section]?.intensity ? { intensity: old.variations[section].intensity } : {}),
      command: `npm run render -- songs/${song}.strudel --section ${section} --name ${song}.${section}`,
      renderedAt: new Date().toISOString(),
    };
    console.log(`  ${section}: ${seconds.toFixed(2)}s, ${cycles} cycles, sha ${variations[section].sha}`);
  }
  const samples: Composition['licence']['samples'] = [
    ...packLicences(opts.repo, h.packs),
    ...h.soundfonts.map((f) => ({
      pack: f,
      licence: 'unknown: GM soundfont streamed by strudel-bench',
      source: 'strudel-bench',
    })),
  ];
  // a person's clearance holds only for the sound sources it was given for: a new pack or soundfont lapses it
  const same =
    JSON.stringify(old?.licence.samples.map((s) => s.pack).sort()) ===
    JSON.stringify(samples.map((s) => s.pack).sort());
  const cleared = opts.cleared !== undefined ? true : same && (old?.licence.cleared ?? false);
  if (old?.licence.cleared && !cleared)
    console.log('  clearance lapsed: the sound sources changed; re-import with --cleared "<why>"');
  const notes = cleared ? (opts.cleared ?? old?.licence.notes) : undefined;
  const comp: Composition = {
    id,
    title: opts.title ?? old?.title ?? id,
    generator: {
      name: 'strudel-bench',
      repo: 'https://github.com/jonborchardt/strudel-bench',
      version: gitVersion(opts.repo, `songs/${song}.strudel`),
    },
    source: {
      file: `songs/${song}.strudel`,
      sha: sha(text.replace(/\r\n?/g, '\n')),
      cps: h.cps,
      bpm: h.bpm,
      key: h.key,
    },
    licence: {
      cleared,
      samples,
      attribution: old?.licence.attribution ?? samples.flatMap((s) => (s.attribution ? [s.attribution] : [])),
      ...(notes ? { notes } : {}),
    },
    variations,
  };
  writeFileSync(join(dir, COMPOSITION_FILE), toJson(comp));
  console.log(
    `wrote ${MUSIC_DIR}/${id}/${COMPOSITION_FILE}: ${Object.keys(variations).length} variations, ${h.bpm} bpm, ${h.key}, ${cleared ? 'cleared' : 'NOT cleared'} for publication`,
  );
}

async function render(port: number) {
  const repo = process.env.STRUDEL_BENCH;
  if (!repo) throw new Error('set STRUDEL_BENCH to the strudel-bench checkout (with npm run headless running there)');
  const comp = loadComposition(id);
  const song = basename(comp.source.file);
  if (!existsSync(join(repo, 'songs', song)))
    throw new Error(`${repo}/songs/${song} is missing; copy ${MUSIC_DIR}/${id}/source.strudel there first`);
  const theirs = readFileSync(join(repo, 'songs', song), 'utf8').replace(/\r\n?/g, '\n');
  if (sha(theirs) !== comp.source.sha)
    console.log(`  note: ${song} differs from the imported source; the manifest will record the new one`);
  const wavs: string[] = [];
  for (const [section] of Object.entries(comp.variations)) {
    const name = `${song.replace(/\.strudel$/, '')}.${section}`;
    const r = await fetch(`http://localhost:${port}/render`, {
      method: 'POST',
      body: JSON.stringify({ song, section, name }),
    });
    if (!r.ok) throw new Error(`strudel-bench render ${section}: ${r.status} ${await r.text()}`);
    const { path } = (await r.json()) as { path: string };
    console.log(`  rendered ${path}`);
    wavs.push(join(repo, path));
  }
  importWavs(wavs, { source: join(repo, 'songs', song), repo });
}

try {
  switch (cmd) {
    case 'import': {
      const source = flag('--source');
      if (!source || !positional.length) usage();
      importWavs(positional, {
        source: source!,
        repo: flag('--repo'),
        title: flag('--title'),
        crossfade: flag('--crossfade') ? Number(flag('--crossfade')) : undefined,
        cleared: flag('--cleared'),
      });
      break;
    }
    case 'render':
      await render(Number(flag('--port') ?? process.env.PORT ?? 3000));
      break;
    case 'show': {
      const c = loadComposition(id);
      console.log(
        `${c.id}: ${c.title} (${c.source.bpm} bpm, ${c.source.key}; ${c.generator.name} ${c.generator.version}, ${c.source.file} ${c.source.sha})`,
      );
      console.log(
        `licence: ${c.licence.cleared ? 'cleared' : 'NOT cleared'}${c.licence.notes ? `; ${c.licence.notes}` : ''}`,
      );
      for (const s of c.licence.samples) console.log(`  pack ${s.pack}: ${s.licence}`);
      for (const [k, v] of Object.entries(c.variations))
        console.log(
          `  ${k}: ${v.seconds}s, ${v.cycles} cycles, loop ${v.loop} (crossfade ${v.crossfade}s), ${v.file} ${v.sha}`,
        );
      break;
    }
    case 'cues': {
      const storyId = positional[0];
      if (!storyId) usage();
      const sdir = scriptDir(id, storyId);
      const out = join(sdir, 'video', 'music.json');
      const relOut = out
        .replace(ROOT, '')
        .replace(/^[\\/]/, '')
        .replaceAll('\\', '/');
      if (existsSync(out) && !rest.includes('--force')) {
        console.log(`kept existing ${relOut}`);
        break;
      }
      const want = flag('--composition');
      const c = pickComposition(compositions(), want);
      if (!c) {
        console.error(want ? `${want} is not a cleared composition in music/` : 'no cleared composition in music/');
        process.exit(2);
      }
      const script = readJson<Script>(join(sdir, FILES.script));
      const sb = readJson<Storyboard>(join(sdir, FILES.storyboard));
      if (!script || !sb?.scenes) throw new Error(`no script.json or storyboard.json in ${sdir}`);
      const m = draftCueSheet(script, sb, c);
      mkdirSync(join(sdir, 'video'), { recursive: true });
      writeFileSync(out, toJson(m));
      console.log(`wrote ${relOut}: ${c.id}, ${m.cues.map((x) => `${x.id} ${x.from}-${x.to}`).join(', ')}`);
      break;
    }
    default:
      usage();
  }
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(2);
}
