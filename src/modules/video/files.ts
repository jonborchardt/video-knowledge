// The video stage's folder conventions and the fingerprints that bind its files together. Every video module reads its
// paths from here, so no stage imports another stage's module for a constant.
import { join } from 'node:path';
import { sha } from '../../shared/io';
import { scriptDir } from '../../shared/io';
import type { NarrationManifest, RenderConfig } from './types';

export const VIDEO_DIR = 'video';
export const VIDEO_FILES = {
  config: 'render.json',
  narration: 'narration.json',
  timeline: 'timeline.json',
  mp4: 'segment.mp4',
  report: 'build-report.json',
  reportMd: 'build-report.md',
  frames: 'frames',
  scenes: 'scenes', // rendered scene chunks, cached by key
  contact: 'contact-sheet.png',
  visualReview: 'visual-review.json', // the independent visual review of the bespoke graphics (src/video/check.ts)
} as const;
export const NARRATION_DIR = 'narration';
export const videoDir = (topic: string, storyId: string, root?: string) =>
  join(scriptDir(topic, storyId, root), VIDEO_DIR);

/** The cache key of one sentence's audio: provider, voice, rate and text. */
export const narrationKey = (voice: RenderConfig['voice'], text: string) =>
  sha(`${voice.provider}|${voice.voice}|${voice.rate}|${text}`);
/** What the timeline was measured from: every sentence's audio bytes. */
export const narrationFingerprint = (m: NarrationManifest) =>
  sha(m.sentences.map((s) => `${s.id}:${s.sha}`).join('\n'));
