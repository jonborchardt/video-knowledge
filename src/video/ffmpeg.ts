// ffmpeg/ffprobe for measuring and checking media. Remotion ships both binaries in its platform compositor package,
// so nothing has to be on PATH; FFMPEG_DIR overrides the location.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const EXE = process.platform === 'win32' ? '.exe' : '';

function binDir(): string {
  if (process.env.FFMPEG_DIR) return process.env.FFMPEG_DIR;
  const scope = dirname(dirname(require.resolve('@remotion/renderer/package.json')));
  for (const name of readdirSync(scope))
    if (name.startsWith('compositor-') && existsSync(join(scope, name, `ffprobe${EXE}`))) return join(scope, name);
  throw new Error('no ffmpeg: install @remotion/renderer for this platform or set FFMPEG_DIR');
}
export const ffBin = (name: 'ffmpeg' | 'ffprobe') => join(binDir(), name + EXE);

export interface Run {
  stdout: Buffer;
  stderr: string;
}
export function run(name: 'ffmpeg' | 'ffprobe', args: string[]): Run {
  const r = spawnSync(ffBin(name), args, { maxBuffer: 1 << 28 });
  if (r.error) throw r.error;
  if (r.status !== 0)
    throw new Error(`${name} ${args.join(' ')} failed (${r.status}): ${r.stderr.toString().slice(-800)}`);
  return { stdout: r.stdout, stderr: r.stderr.toString() };
}

export interface Probe {
  duration: number; // seconds
  video: { codec: string; width: number; height: number; fps: number; duration: number; frames: number } | null;
  audio: { codec: string; sampleRate: number; channels: number; duration: number } | null;
}
export function probe(file: string): Probe {
  if (!existsSync(file)) throw new Error(`no such file: ${file}`);
  const j = JSON.parse(
    run('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file]).stdout.toString(),
  );
  const streams: Record<string, string>[] = j.streams ?? [];
  const v = streams.find((s) => s.codec_type === 'video');
  const a = streams.find((s) => s.codec_type === 'audio');
  const fps = (r: string) => {
    const [n, d] = r.split('/').map(Number);
    return d ? n / d : n;
  };
  const duration = Number(j.format?.duration ?? 0);
  return {
    duration,
    video: v
      ? {
          codec: v.codec_name,
          width: Number(v.width),
          height: Number(v.height),
          fps: fps(v.r_frame_rate),
          duration: Number(v.duration ?? duration),
          frames: Number(v.nb_frames ?? 0),
        }
      : null,
    audio: a
      ? {
          codec: a.codec_name,
          sampleRate: Number(a.sample_rate),
          channels: Number(a.channels),
          duration: Number(a.duration ?? duration),
        }
      : null,
  };
}

export interface AudioStats {
  maxVolumeDb: number;
  meanVolumeDb: number;
  silences: { start: number; end: number }[];
}
/** Peak and RMS level, and every silence of at least `minSilence` seconds whose 50 ms windows stay below `noiseDb`.
 *  Measured here from decoded mono 16 kHz PCM: Remotion's ffmpeg build has no volumedetect or astats filter. */
export function audioStats(file: string, noiseDb = -40, minSilence = 2): AudioStats {
  const rate = 16000;
  const { stdout } = run('ffmpeg', [
    '-hide_banner',
    '-v',
    'error',
    '-i',
    file,
    '-vn',
    '-ac',
    '1',
    '-ar',
    String(rate),
    '-c:a',
    'pcm_s16le',
    '-f',
    'wav',
    '-',
  ]);
  const data = stdout.indexOf('data', 12, 'latin1');
  if (data < 0) throw new Error(`no PCM data decoded from ${file}`);
  const pcm = stdout.subarray(data + 8);
  const n = Math.floor(pcm.length / 2);
  const win = rate / 20; // 50 ms
  let peak = 0;
  let sumSq = 0;
  const silences: AudioStats['silences'] = [];
  let quietFrom = -1;
  for (let w = 0; w * win < n; w++) {
    let sq = 0;
    for (let i = w * win; i < Math.min(n, (w + 1) * win); i++) {
      const s = pcm.readInt16LE(i * 2) / 32768;
      peak = Math.max(peak, Math.abs(s));
      sq += s * s;
    }
    sumSq += sq;
    const quiet = 10 * Math.log10(sq / win + 1e-12) < noiseDb;
    if (quiet && quietFrom < 0) quietFrom = w;
    if (!quiet && quietFrom >= 0) {
      if ((w - quietFrom) * win >= minSilence * rate)
        silences.push({ start: (quietFrom * win) / rate, end: (w * win) / rate });
      quietFrom = -1;
    }
  }
  if (quietFrom >= 0 && n - quietFrom * win >= minSilence * rate)
    silences.push({ start: (quietFrom * win) / rate, end: n / rate });
  const db = (x: number) => Math.round(20 * Math.log10(x + 1e-12) * 10) / 10;
  return { maxVolumeDb: db(peak), meanVolumeDb: db(Math.sqrt(sumSq / Math.max(1, n))), silences };
}

/** Mean and standard deviation of luma on a small grayscale thumbnail, one sample every `fps / perSecond` frames
 *  (frame-exact: every frame is dumped and the code picks, since the output -r option samples late). The frames go
 *  through the image2 muxer as raw gray bytes: Remotion's ffmpeg build has no rawvideo muxer and no fps filter. */
export function lumaSamples(file: string, perSecond = 2, fps = 30, w = 48, h = 27): { mean: number; sd: number }[] {
  const dir = mkdtempSync(join(tmpdir(), 'vk-luma-'));
  const step = Math.max(1, Math.round(fps / perSecond));
  try {
    run('ffmpeg', [
      '-hide_banner',
      '-v',
      'error',
      '-i',
      file,
      '-an',
      '-vf',
      `scale=${w}:${h},format=gray`,
      '-c:v',
      'rawvideo',
      '-f',
      'image2',
      join(dir, '%06d.raw'),
    ]);
    const n = w * h;
    return readdirSync(dir)
      .sort()
      .filter((_, i) => i % step === 0)
      .map((name) => {
        const px = readFileSync(join(dir, name));
        let sum = 0;
        let sq = 0;
        for (let i = 0; i < n; i++) {
          sum += px[i];
          sq += px[i] * px[i];
        }
        const mean = sum / n;
        return { mean, sd: Math.sqrt(Math.max(0, sq / n - mean * mean)) };
      });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function extractFrame(file: string, seconds: number, out: string) {
  run('ffmpeg', ['-hide_banner', '-v', 'error', '-y', '-ss', seconds.toFixed(3), '-i', file, '-frames:v', '1', out]);
}

// ---- assembly ---------------------------------------------------------------------------------------------------

const Q = ['-hide_banner', '-v', 'error', '-y'];

/** Concatenate video-only chunks with identical encoding into one file, no re-encode (concat demuxer, stream copy). */
export function concatVideo(chunks: string[], out: string) {
  const list = out + '.txt';
  writeFileSync(list, chunks.map((c) => `file '${c.replaceAll('\\', '/').replaceAll("'", "'\\''")}'`).join('\n'));
  try {
    run('ffmpeg', [...Q, '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-an', out]);
  } finally {
    unlinkSync(list);
  }
}

/** A sentence placed on the track: its audio starts `delay` seconds into a slot `seconds` long; slots are contiguous. */
export interface Slot {
  file: string;
  delay: number;
  seconds: number;
}
/** One continuous narration track from the sentence files: each in its slot, padded with silence, then (optionally)
 *  loudness-normalised to -16 LUFS / -1.5 dBTP for YouTube, encoded AAC in an mp4 container. */
export function narrationTrack(slots: Slot[], out: string, loudnorm = true) {
  const chain = slots.map(
    (s, i) =>
      `[${i}:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,adelay=${Math.round(s.delay * 1000)}:all=1,apad=whole_dur=${s.seconds.toFixed(3)}[a${i}]`,
  );
  const tail = `${slots.map((_, i) => `[a${i}]`).join('')}concat=n=${slots.length}:v=0:a=1${loudnorm ? ',loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000,asetpts=N/SR/TB' : ''}[out]`;
  const script = out + '.filter';
  writeFileSync(script, [...chain, tail].join(';\n'));
  try {
    run('ffmpeg', [
      ...Q,
      ...slots.flatMap((s) => ['-i', s.file]),
      '-filter_complex_script',
      script,
      '-map',
      '[out]',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-f',
      'mp4',
      out,
    ]);
  } finally {
    unlinkSync(script);
  }
}

/** The video stream of one file with the audio stream of another, both copied. */
export function mux(video: string, audio: string, out: string) {
  run('ffmpeg', [
    ...Q,
    '-i',
    video,
    '-i',
    audio,
    '-map',
    '0:v:0',
    '-map',
    '1:a:0',
    '-c',
    'copy',
    '-movflags',
    '+faststart',
    out,
  ]);
}
