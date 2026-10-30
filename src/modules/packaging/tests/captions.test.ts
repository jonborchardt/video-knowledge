// Captions for the upload: one SRT cue per sentence from the measured timeline, never past the next sentence.
import { describe, expect, it } from 'vitest';
import { MAX_CUE_LINE, renderSrt } from '../captions';
import type { Timeline, TimelineSentence } from '../../video/types';

const sentence = (id: string, text: string, start: number, audioSeconds: number): TimelineSentence => ({
  id,
  text,
  start,
  duration: Math.ceil(audioSeconds * 30),
  audio: `${id}.wav`,
  audioSeconds,
  words: [],
});
const timeline = (...scenes: TimelineSentence[][]): Timeline =>
  ({ fps: 30, scenes: scenes.map((sentences, i) => ({ id: `sc${i + 1}`, sentences })) }) as unknown as Timeline;

describe('renderSrt', () => {
  it('caps a cue at the next sentence and times the last one by its audio', () => {
    const srt = renderSrt(timeline([sentence('s1', 'First.', 0, 3.2), sentence('s2', 'Second.', 90, 1.5)]));
    expect(srt).toBe(
      ['1', '00:00:00,000 --> 00:00:03,000', 'First.', '', '2', '00:00:03,000 --> 00:00:04,500', 'Second.', ''].join(
        '\n',
      ),
    );
  });

  it('numbers cues across scenes and never emits CRLF', () => {
    const srt = renderSrt(timeline([sentence('s1', 'A.', 0, 1)], [sentence('s2', 'B.', 60, 1)]));
    expect(srt.split('\n\n')).toHaveLength(2);
    expect(srt).toContain('\n2\n00:00:02,000');
    expect(srt).not.toContain('\r');
  });

  it('splits a long sentence into two balanced lines at a space', () => {
    const text =
      'Developers in the trial were slower with the assistant even though they believed it was speeding them up.';
    const srt = renderSrt(timeline([sentence('s1', text, 0, 5)]));
    const lines = srt.split('\n').slice(2, -1);
    expect(lines).toHaveLength(2);
    expect(Math.abs(lines[0].length - lines[1].length)).toBeLessThanOrEqual(12);
    expect(lines.join(' ')).toBe(text);
    expect(renderSrt(timeline([sentence('s1', 'Short enough for one line.', 0, 1)])).split('\n')).toHaveLength(4);
    expect('Short enough for one line.'.length).toBeLessThanOrEqual(MAX_CUE_LINE);
  });

  it('formats hours and milliseconds', () => {
    const srt = renderSrt(timeline([sentence('s1', 'Late.', 30 * 3661 + 15, 0.25)]));
    expect(srt).toContain('01:01:01,500 --> 01:01:01,750');
  });
});
