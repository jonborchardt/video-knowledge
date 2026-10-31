// What this renderer cannot promise, for the build report's limitations. Kept beside theme.ts (which names the fonts)
// but outside the render cache key: editing a caveat re-renders nothing. Browser-safe.
export const RENDERER_LIMITATIONS = [
  'system fonts (Georgia, Segoe UI): renders on another machine may set type differently',
  'scene transitions are a short fade over the field; no cross-dissolve between scenes',
];
