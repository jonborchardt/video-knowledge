// Bespoke scene kinds, registered per video (<topic>/<story slug>). A video's render.json may name only the generic
// kinds (src/video/kinds.ts) and its own bespoke kinds, so one video's one-offs never grow the shared list.
// Kind names stay unique across videos: the renderer looks a scene's kind up without knowing the video. Browser-safe.
// No video registers bespoke kinds yet; add one as `'<topic>/<story slug>': { <kind>: KindSpec }`.
export const BESPOKE = {};
