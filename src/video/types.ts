// Video stage: the narrow, typed contract between the validated storyboard, the narration audio and the renderer.
//   storyboard scene -> script sentences -> narration audio (NarrationManifest) -> Timeline (frames) -> rendered frames
// Browser-safe: no node imports; the Remotion bundle imports this file.
import type { ChartSpec, VisualCategory } from '../lib/storyboard';
import type { SceneKind } from './kinds';

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

/** One spoken token with its time within the sentence audio, in seconds, as the provider reported it. */
export interface WordTiming {
  text: string;
  start: number;
  end: number;
}

export interface SentenceAudio {
  id: string; // sentence id
  text: string; // exactly what was synthesised; the timeline refuses it unless it equals the script sentence
  fingerprint: string; // sentenceFingerprint of the script sentence at synthesis time
  file: string; // relative to the video dir, e.g. narration/s04-<key>.mp3
  sha: string; // of the audio bytes
  duration: number; // measured seconds (ffprobe), never the provider's estimate
  words: WordTiming[]; // provider word boundaries; empty when the provider gives none
}
export interface NarrationManifest {
  provider: string;
  voice: string;
  rate: string;
  model?: string;
  format: string;
  generatedAt: string;
  sentences: SentenceAudio[];
}

/** A narration word an animation waits for: the nth occurrence (1-based) of `word` in `sentence`. */
export interface Cue {
  sentence: string;
  word: string;
  nth?: number;
}
/** <topic>/scripts/<slug>/video/render.json: what to render and which words drive which animations. */
export interface RenderConfig {
  scenes: string[]; // contiguous storyboard scene ids, in storyboard order
  voice: { provider: string; voice: string; rate: string };
  leadSeconds: number; // silence before the first sentence
  gapSeconds: number; // silence between sentences within a scene
  cues: Record<string, Record<string, Cue>>; // scene id -> cue name -> narration word
}

export interface TimelineWord {
  text: string;
  frame: number; // absolute frame the word starts on
  end: number; // absolute frame it ends on
}
export interface TimelineSentence {
  id: string;
  text: string;
  start: number; // absolute frame
  duration: number; // frames reserved for the audio (ceil of the measured seconds)
  audio: string; // file relative to the video dir
  audioSeconds: number;
  words: TimelineWord[];
}
export interface Citation {
  label: string; // the storyboard's on-screen label
  detail: string; // resolved from the evidence package: document name and lines, or the source's channel and URL
}
export interface TimelineScene {
  id: string;
  order: number;
  category: VisualCategory;
  kind: SceneKind;
  start: number; // absolute frame
  duration: number; // frames, including the storyboard pause after the last sentence
  sentences: TimelineSentence[];
  cues: Record<string, number>; // cue name -> absolute frame
  onScreenText: string[];
  chart: ChartSpec | null;
  citations: Citation[];
  assets: string[];
}
// A type alias, not an interface: Remotion composition props need an implicit index signature.
export type Timeline = {
  topic: string;
  story: string;
  title: string;
  fps: number;
  width: number;
  height: number;
  durationInFrames: number;
  fingerprints: { script: string; storyboard: string; narration: string; config: string };
  narration: { provider: string; voice: string; rate: string };
  scenes: TimelineScene[];
};
