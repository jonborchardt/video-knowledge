# music/: compositions for the videos

One folder per composition. The music is written and rendered in
[strudel-bench](https://github.com/jonborchardt/strudel-bench); this repo keeps the rendered sections, their
provenance and the cue sheets that place them under narration. Nothing here composes or synthesises.

```
music/<composition>/
  composition.json   the manifest (committed): generator commit, source file and sha, tempo, key, licence, variations
  source.strudel     a copy of the song as rendered (committed), so the sha in the manifest can be checked
  <variation>.wav    the rendered sections (gitignored, 16-bit stereo 48 kHz); regenerate with the recorded command
```

## The contract

`video section -> music cue -> composition/variation -> rendered audio asset`

- A **composition** is one strudel-bench song (`songs/<name>.strudel`), one musical identity: tempo, key, voices.
- A **variation** is one section of that song rendered on its own (`npm run render -- songs/<name>.strudel --section
<s> --name <name>.<s>` in strudel-bench). It is whole bars, so it loops on a bar boundary; the manifest records its
  measured length, bar count, sha and a `crossfade` (seconds of head blended over the cut tail at each loop seam,
  because a strudel-bench section render starts dry and stops mid-reverb).
- A **cue** (`<topic>/scripts/<slug>/video/music.json`) places a variation between two scene anchors with a gain,
  fades, looping and optional ducking. Cues never hold seconds: `"from": "sc12"` is the measured start of sc12,
  `"to": "sc20"` the measured end of sc20, `"sc12:end-2"` and `"sc07+1.5"` offset from an edge. When narration
  re-times a scene, the music moves with it and no asset is regenerated.
- The **mixer** (`src/video/mix.ts`, `src/video/music.ts`) decodes the assets, loops, fades, ducks and sums them on
  PCM, mixes the bus under the loudness-normalised narration, turns the music (never the voice) down if the sum
  would pass -1 dBFS, and writes `video/mix.json`: the fingerprint of the cue sheet and asset bytes, the level of
  each cue, and how far the music sits under the voice while it speaks. QA fails when the mix on disk is not the
  mix of the committed cue sheet, when a cue did not sound, or when the music is closer than 10 dB to the voice or
  further than 40 dB from it.
- Changing a cue sheet re-mixes the audio and re-muxes the MP4; every rendered scene chunk stays cached (the chunk
  key knows nothing about music). Changing one variation's WAV changes only that variation's sha.

## Licence and clearance

`composition.json` records every sample pack the song declares with the licence its `pack.json` states, any
attribution line the video description must carry (GM soundfonts are listed as sound sources too), and `cleared`:
whether a person has judged every sound source
licensed for a published, monetised video. The build report and the production board keep music clearance separate
from the narration voice's: both must hold before a public release, and a passing render is never clearance.

strudel-bench's own packs, for reference (its README and `legal.html` are authoritative): its 20 Freesound kits are
CC0; `rooms` (reverb impulses, OpenAIR) is CC BY 4.0 and needs attribution; the Nine Inch Nails `*-cuts` packs are CC
BY-NC-SA 3.0 and must not be used here; the Strudel CDN packs and the streamed `gm_*` soundfonts carry upstream
terms the repo does not restate. A song that uses only oscillators and synth patches (`undertow`) carries no sample
licence at all.

## Commands

```
npm run music -- import <id> --source <strudel-bench>/songs/<name>.strudel --repo <strudel-bench> [--title "<t>"] [--crossfade <s>] [--cleared "<why>"] <strudel-bench>/renders/<name>.<section>.wav ...
npm run music -- render <id> [--port 3000]     # STRUDEL_BENCH=<dir> with `npm run headless` running there: re-render every variation and import
npm run music -- show <id>
```

`render` needs the song in strudel-bench's `songs/`; until a composition is adopted there, copy
`music/<id>/source.strudel` to `<strudel-bench>/songs/<name>.strudel` first (the manifest records the sha either way).

## undertow

The first composition, for the MLM video: D minor, 84 bpm, every voice an oscillator, five sections (`pulse`,
`active`, `texture`, `motif`, `rest`). See `scripts/briefs/strudel-bench.md` for the handoff that asks strudel-bench
to adopt and improve it.
