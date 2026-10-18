# Handoff to strudel-bench: music for video-knowledge

For the Claude session working in `jonborchardt/strudel-bench`. video-knowledge renders research videos
(narration over Remotion scenes) and now mixes a background bed under the narration. The bed comes from
strudel-bench. This note says what video-knowledge consumes, what it already did against strudel-bench `f63f2c5`,
and what it asks of you. video-knowledge does not modify strudel-bench; the two repos stay independently usable.

## What video-knowledge consumes

One song is one **composition**; each `section()` of it is a **variation** rendered on its own:

```
npm run headless -- songs/<name>.strudel            # server + headless page (CHROME=<path> if playwright has no browser)
npm run render -- songs/<name>.strudel --section <s> --name <name>.<s>     # renders/<name>.<s>.wav, one per section
```

video-knowledge then imports the WAVs (`npm run music -- import <id> --source songs/<name>.strudel --repo <dir>
renders/<name>.*.wav`) into `music/<id>/`: it copies the WAVs and the source, probes each file, and writes
`composition.json` with the source sha, `cps`/`bpm`/`key` read from the song header, the `packs:` list with the
licence from each pack's `pack.json`, your git commit, and per variation the measured seconds, the bar count, the
sha, and a loop `crossfade`. Its cue sheets (`video/music.json`) place a variation between two scene anchors; its
mixer loops the file on the bar boundary with that crossfade, fades, ducks under speech and keeps the sum under
-1 dBFS. So:

- **Whole bars, deterministic, no tail.** Your section render is exactly `(cycles / cps)` seconds, starts dry and
  stops mid-reverb. video-knowledge handles that seam with a one-bar equal-power crossfade. A render option that
  wraps the tail back into the head (a true seamless loop) would be better, but is not required.
- **16-bit stereo WAV at the browser's rate** (48 kHz here). Fine. video-knowledge resamples if it ever differs.
- **Sections are the intensity variations.** One identity, several densities: that is what the cue sheet wants.
  Per-section `--layer` stems are not used (a soloed part loses its sidechain duck, per `scripts/measure.mjs`).
- **The song header is the metadata.** `cps`/`bpm`, `key`, `seed`, `packs`. No sidecar is written today; the
  importer derives bar counts from the duration and the header cps.

## What was done against f63f2c5

`songs/undertow.strudel` (a copy is at `video-knowledge/music/undertow/source.strudel`): D minor, `cps .35`
(84 bpm), `seed 11`, five sections, every voice an oscillator (`sine`, `triangle`, `sawtooth` through the `hollow`
and `glass` patches, no pack, no `gm_*` soundfont, superdough's own reverb instead of `rooms`), so the render
carries no sample licence. Sections: `pulse` 16 (drone, dark pad, a sine tick on 2 and 4), `active` 16 (plus a
short sine bass figure and a quiet `glass` arpeggio), `texture` 16 (pad and drone, the tick thinned), `motif` 16 (a
four-bar motif on a `glass` triangle), `rest` 8 (the motif resolving to the root; not a loop). `npm run check` is
clean; the renders measure -22 dBFS rms, peaks -8 to -15 dBFS, no silence. It was written from
`.claude/skills/strudel/SKILL.md` without the mixing pass (no `npm run measure` was run) and nobody has listened
to it yet. It lives only here; strudel-bench never commits it.

## Making a new song

strudel-bench stays a tool; songs live here (`music/<id>/source.strudel`). For a new song or a fix to one:

1. Copy the song into a temporary checkout of strudel-bench (`songs/<name>.strudel`; a new song starts there).
2. Write or fix it with `.claude/skills/strudel/SKILL.md` and run its mixing pass (`measure`, `lint`, the passes in
   the skill).
3. Render the sections and import them here with `npm run music -- import` (or `npm run music -- render <id>`).
4. Commit nothing in strudel-bench.

## Notes for every song (from the listening pass on `undertow`)

- Keep the instrument, tone and speed of `undertow`: oscillators, a dark pad, a sine drone and tick, 84 bpm.
- Leave no silent stretches in the video: the cue sheet covers every scene, first to last.
- No melody or lead line, nothing vocal-sounding, and no build-up or climax.
- The music is a background bed with no story of its own.
- Listen to it before it goes into a video.

## Asks

1. **If cheap, a render sidecar**: `renders/<name>.<section>.json` with `{ song, section, cycles, cps, bpm, key,
seed, seconds, sampleRate, packs: [{ name, licence }], commit }`. The importer would read it instead of the
   header. Not blocking: the header read works.
2. **If cheap, a loop-friendly render flag** (`--loop`: schedule one extra bar and fold its tail under the head, or
   just include `tail` seconds so the crossfade has reverb to blend into). Not blocking.
3. **Say what is not cleared.** `legal.html` is out of date (it names a `freekit` pack); the Strudel CDN packs'
   licences are not restated in the repo. For any future composition that uses a pack or a soundfont, one line per
   pack in `notes.json` (licence, attribution text) is what video-knowledge records.

## Answers video-knowledge needed (from reading f63f2c5; correct what is wrong)

1. Original instrumental music for calm narration: yes, by hand-writing a `song()`; `gen/form.mjs` skeletons always
   include drums and a climax, so they are a scaffold, not a bed.
2. Export: `scripts/render.mjs` through the server and an open page; `renders/<name>.wav`; `--mp3` optional.
3. Stereo WAV: yes, 16-bit, at the live context's rate (48 kHz on this machine).
4. One section alone: `--section <s> [--cycles n]`. Sections are `section(name, cycles, spec)` in the song.
5. Repeatable: seeded (`seed`, `lib/random.mjs`, seeded humanize); bit-identity across machines is not claimed.
6. Intensity variations: sections with their own axis values, `enter`/`exit`/`dropout`/`sweep`; stems only per
   section via `--layer`.
7. Tempo and key: `cps` or `bpm`, `key: 'D:minor'`, `progression` in roman numerals per section.
8. Loop boundaries: a render is whole cycles with no tail; the consumer crossfades the seam.
9. Duration: exact, `(end - begin) / cps`; the CLI does not print it in advance.
10. Metadata: none per render today (hence ask 3); `renderall` writes an analysis sidecar; `notes.json` holds
    provenance and the YouTube block.
11. Licences: 20 Freesound kits CC0; `rooms` CC BY 4.0 (attribution); NIN `*-cuts` CC BY-NC-SA 3.0 (not usable);
    built-in CDN packs and `gm_*` soundfonts: upstream terms, not restated. Oscillators and patches: none.
12. Simplest durable interface: files. You render `renders/<name>.<section>.wav` from a committed song;
    video-knowledge imports them with `npm run music -- import` and records everything it needs in
    `music/<id>/composition.json`. No shared code, no server coupling beyond the render step itself.
