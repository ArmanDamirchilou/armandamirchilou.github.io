import { describe, expect, it } from 'vitest';
import { charsThroughWord, findSpeech, locateChunks, normalize, wordStarts, wordsSpokenAt } from '../src/lib/captions';
import { splitForSpeech } from '../src/lib/speech';

const RATE = 8000;

/** A clip that is silent or "speaking" (a tone) over the given stretches. */
function clip(seconds: number, voiced: [number, number][]): Float32Array {
  const out = new Float32Array(Math.round(seconds * RATE));
  for (const [a, b] of voiced) {
    for (let i = Math.round(a * RATE); i < Math.round(b * RATE); i++) out[i] = 0.4 * Math.sin((i / RATE) * 2 * Math.PI * 180);
  }
  return out;
}

describe('findSpeech', () => {
  it('trims the silence around speech and finds the pause inside it', () => {
    const span = findSpeech(clip(3, [[0.3, 1.2], [1.6, 2.7]]), RATE)!;
    expect(span.start).toBeCloseTo(0.3, 1);
    expect(span.end).toBeCloseTo(2.7, 1);
    expect(span.pauses).toHaveLength(1);
    expect(span.pauses[0].start).toBeCloseTo(1.2, 1);
    expect(span.pauses[0].end).toBeCloseTo(1.6, 1);
  });

  it('ignores gaps too short to be a pause', () => {
    expect(findSpeech(clip(2, [[0.2, 0.9], [0.95, 1.8]]), RATE)!.pauses).toEqual([]);
  });

  it('returns null for silence', () => {
    expect(findSpeech(new Float32Array(RATE), RATE)).toBeNull();
  });
});

describe('wordStarts', () => {
  it('starts the first word when the speech starts, not at 0', () => {
    const words = ['Hello', 'there', 'friend.'];
    const starts = wordStarts(words, { start: 0.4, end: 1.6, pauses: [] }, 2);
    expect(starts[0]).toBeCloseTo(0.4);
    expect(starts[1]).toBeGreaterThan(starts[0]);
    expect(starts[2]).toBeLessThan(1.6);
  });

  it('puts the word after a comma right where the voice resumes after the pause', () => {
    const words = "Hey! I'm Arman, sixteen, from Tehran.".split(' ');
    const starts = wordStarts(words, { start: 0.1, end: 3, pauses: [{ start: 0.5, end: 0.8 }, { start: 1.3, end: 1.5 }] }, 3);
    // "Hey!" ends at the first pause; "I'm" starts as it ends.
    expect(starts[1]).toBeCloseTo(0.8);
    // "Arman," is followed by the second pause, so "sixteen," starts at 1.5.
    expect(starts[3]).toBeCloseTo(1.5);
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
  });

  it('spreads words over the whole clip when the audio could not be analysed', () => {
    const starts = wordStarts(['one', 'two', 'three', 'four'], null, 2);
    expect(starts[0]).toBe(0);
    expect(starts[3]).toBeGreaterThan(1);
    expect(starts[3]).toBeLessThan(2);
  });
});

describe('wordsSpokenAt', () => {
  it('counts the words that have started', () => {
    expect(wordsSpokenAt([0.1, 0.5, 0.9], 0)).toBe(0);
    expect(wordsSpokenAt([0.1, 0.5, 0.9], 0.5)).toBe(2);
    expect(wordsSpokenAt([0.1, 0.5, 0.9], 5)).toBe(3);
  });
});

describe('locating speech chunks in the reply', () => {
  it('maps every chunk back onto the reply text, even when a dash was dropped at a cut', () => {
    const reply = normalize(
      "Honestly, the thing I'm proudest of right now is this twin — it took months of late nights. Want to try it?"
    );
    const chunks = splitForSpeech(reply);
    expect(chunks.length).toBeGreaterThan(1);
    const spans = locateChunks(reply, chunks);
    spans.forEach((s, i) => expect(reply.slice(s.from, s.to)).toBe(chunks[i]));
    expect(spans[spans.length - 1].to).toBe(reply.length);
  });

  it('gives the end of the n-th word', () => {
    expect(charsThroughWord("Hey! I'm Arman.", 1)).toBe(4);
    expect(charsThroughWord("Hey! I'm Arman.", 2)).toBe(8);
    expect(charsThroughWord("Hey! I'm Arman.", 9)).toBe(15);
    expect(charsThroughWord("Hey! I'm Arman.", 0)).toBe(0);
  });
});
