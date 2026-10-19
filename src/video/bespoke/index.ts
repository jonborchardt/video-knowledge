// Bespoke scene kinds, registered per video (<topic>/<story slug>). A video's render.json may name only the generic
// kinds (src/video/kinds.ts) and its own bespoke kinds, so one video's one-offs never grow the shared list.
// Kind names stay unique across videos: the renderer looks a scene's kind up without knowing the video. Browser-safe.
import { MLM_AND_SEMINARS } from './decision-mlm-and-seminars';
import { WHEN_DOES_IT_PAY } from './decision-when-does-it-pay-for-itself';

export const BESPOKE = {
  'get-rich-quick/decision-mlm-and-seminars': MLM_AND_SEMINARS,
  'heat-pumps/decision-when-does-it-pay-for-itself': WHEN_DOES_IT_PAY,
};
