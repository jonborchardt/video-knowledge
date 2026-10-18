// Rendering: the Remotion composition in src/video/remotion, bundled once, rendered to H.264/AAC MP4. The studio preview
// (npm run video -- preview) uses the same entry point and the same timeline.json, so what is previewed is what is
// rendered.
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { COMPOSITION } from './remotion/Root';
import type { Timeline } from './types';

export const ENTRY = fileURLToPath(new URL('./remotion/index.ts', import.meta.url));

export async function renderTimeline(
  timeline: Timeline,
  publicDir: string, // the video dir: narration/<file> resolves through staticFile()
  outputLocation: string,
  onProgress?: (fraction: number) => void,
): Promise<void> {
  const inputProps = timeline as unknown as Record<string, unknown>;
  const serveUrl = await bundle({ entryPoint: ENTRY, publicDir });
  const composition = await selectComposition({ serveUrl, id: COMPOSITION, inputProps, logLevel: 'error' });
  await renderMedia({
    composition,
    serveUrl,
    inputProps,
    codec: 'h264',
    audioCodec: 'aac',
    outputLocation,
    logLevel: 'error',
    onProgress: ({ progress }) => onProgress?.(progress),
  });
}
