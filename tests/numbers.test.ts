import { describe, expect, it } from 'vitest';
import { hasFigure, nums, spokenWords, wordsToDigits } from '../src/shared/numbers';

describe('number words', () => {
  it.each([
    ['Fourteen percent of the 601', '14 percent of the 601'],
    ['Twenty-nine exclude from their', '29 exclude from their'],
    ['have an organization of a thousand people', 'have an organization of 1000 people'],
    ['Two hundred and eighty-five MLM participants (47%)', '285 MLM participants (47%)'],
    ['one in 238 actually profited', '1 in 238 actually profited'],
    ['half of one percent', 'half of 1 percent'],
    ['Twenty of the disclosures', '20 of the disclosures'],
    ['ninety-two point three seven', '92 point 3 7'],
    [
      'one trainer promises a one-liner; not one of the 70 statements',
      'one trainer promises a one-liner; not one of the 70 statements',
    ],
    ['twenty-one of them, one in five, one percent', '21 of them, 1 in 5, 1 percent'],
  ])('%s', (input, out) => expect(wordsToDigits(input)).toBe(out));
  it('extracts digit figures after normalisation', () => {
    expect(nums('Fourteen percent made $5,000; 3% made $25,000')).toEqual(['14', '5000', '3', '25000']);
  });
  it('counts numerals by spoken length', () => {
    expect(spokenWords('they lost money')).toBe(3);
    expect(spokenWords('47% lost money')).toBe(5);
    expect(spokenWords('averages $1,018,350')).toBe(7);
    expect(spokenWords('92.37 and 2018')).toBe(7);
  });
  it('matches figures on boundaries only', () => {
    expect(hasFigure('about 140 people', '14')).toBe(false);
    expect(hasFigure('a 0.14 share', '14')).toBe(false);
    expect(hasFigure('averages just over $1,018,350.20', '1018350')).toBe(true); // a truncated decimal still refers to it
    expect(hasFigure('Fourteen percent made less than $5,000', '14')).toBe(true);
    expect(hasFigure('$1,018,350.20', '1018350.20')).toBe(true);
    expect(hasFigure('less than $84.', '84')).toBe(true);
  });
});

describe('number words: review fixes', () => {
  it.each([
    ['they made fifteen.', 'they made 15.'],
    ['"fifteen", she said', '"15", she said'],
    ['one in five, and a thousand.', '1 in 5, and 1000.'],
    ['Fifteen!', '15!'],
  ])('punctuation attached to a number word: %s', (input, out) => expect(wordsToDigits(input)).toBe(out));
  it('a scale word after a digit scales it', () => {
    expect(nums('601 million people and 1.5 million more and 2 billion')).toEqual([
      '601000000',
      '1500000',
      '2000000000',
    ]);
    expect(hasFigure('about 601 people', '601000000')).toBe(false);
    expect(hasFigure('about 601 million people', '601000000')).toBe(true);
    expect(wordsToDigits('two billion')).toBe('2000000000');
  });
  it('a short figure does not match the start of a decimal; a long one may drop its cents', () => {
    expect(hasFigure('Level 1.33% of them', '1')).toBe(false);
    expect(hasFigure('a 14.5 share', '14')).toBe(false);
    expect(hasFigure('averages just over $1,018,350.20', '1018350')).toBe(true);
    expect(hasFigure('less than $84.', '84')).toBe(true);
  });
});
