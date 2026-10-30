// The generic ffmpeg/ffprobe runner. Remotion ships both binaries in its platform compositor package,
// so nothing has to be on PATH; FFMPEG_DIR overrides the location.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
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

export function extractFrame(file: string, seconds: number, out: string) {
  run('ffmpeg', ['-hide_banner', '-v', 'error', '-y', '-ss', seconds.toFixed(3), '-i', file, '-frames:v', '1', out]);
}
