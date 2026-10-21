// Bespoke scene kinds, registered per video (<topic>/<story slug>). A video's render.json may name only the generic
// kinds (src/video/kinds.ts) and its own bespoke kinds, so one video's one-offs never grow the shared list.
// Kind names stay unique across videos: the renderer looks a scene's kind up without knowing the video. Browser-safe.
import { COURTS_AND_JURISDICTION } from './decision-courts-and-jurisdiction';
import { IS_THE_ECONOMY_BOOMING } from './decision-is-the-economy-booming';

export const BESPOKE = {
  'sovereign-citizens/decision-courts-and-jurisdiction': COURTS_AND_JURISDICTION,
  'inflation-2026/decision-is-the-economy-booming': IS_THE_ECONOMY_BOOMING,
};
