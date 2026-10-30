// The contract of video/build-report.json as the library layer sees it: the fields the production board reads. The
// video layer's BuildReport (src/modules/video/report.ts) extends it, so the compiler keeps the two in step and the board never
// imports from the video layer.

/** Technical completion is not clearance: both must hold before a public release. */
export interface Clearance {
  narration: boolean;
  music: boolean | null;
  publishable: boolean;
  why: string[];
}
export interface BuildSummary {
  generatedAt: string;
  segment: { scenes: string[] };
  output: { seconds: number } | null;
  narration: { provider: string; voice: string; publishable: boolean };
  music: { compositions: { title: string }[] } | null;
  clearance: Clearance;
  // config: sha of the parsed render.json; look: lookFingerprint (src/shared/look.ts), absent from older reports
  fingerprints: { script: string; storyboard: string; config: string; look?: string };
  qa: { ok: boolean; checks: { name: string; ok: boolean; detail?: string; scene?: string; sentence?: string }[] };
}
