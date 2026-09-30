import { describe, expect, it } from 'vitest';
import { splitForSpeech } from '../src/lib/speech';

describe('splitForSpeech', () => {
  it('keeps a short reply as one clip', () => {
    expect(splitForSpeech("Hey! I'm Arman.")).toEqual(["Hey! I'm Arman."]);
  });

  it('splits sentences so later ones can be synthesised while earlier ones play', () => {
    const chunks = splitForSpeech(
      "Got gold at Innoverse Expo in the US. Also took 2nd at Iran's National AI Cup. Not bad for sixteen, right?"
    );
    expect(chunks).toEqual([
      'Got gold at Innoverse Expo in the US.',
      "Also took 2nd at Iran's National AI Cup.",
      'Not bad for sixteen, right?',
    ]);
  });

  it('merges tiny fragments into the next sentence instead of voicing them alone', () => {
    const chunks = splitForSpeech('Haha. Yeah! I built this whole twin myself, honestly.');
    expect(chunks).toEqual(['Haha. Yeah! I built this whole twin myself, honestly.']);
  });

  it('splits a long opening sentence at its first natural pause', () => {
    const chunks = splitForSpeech(
      "Honestly, this digital twin's been eating most of my time — polishing the lip-sync and making the voice sound natural. What about you?"
    );
    expect(chunks[0]).toBe("Honestly, this digital twin's been eating most of my time");
    expect(chunks[1]).toBe('polishing the lip-sync and making the voice sound natural. What about you?');
  });

  it('never loses or reorders words', () => {
    const text =
      "Right now I'm polishing this twin, fixing lip-sync timing and making the voice sound more natural. Also tinkering with a RAG metric. You building anything?";
    const joined = splitForSpeech(text).join(' ');
    expect(joined.replace(/[—–-]/g, '').replace(/\s+/g, ' ')).toBe(text.replace(/[—–-]/g, '').replace(/\s+/g, ' '));
  });

  it('returns nothing for empty text', () => {
    expect(splitForSpeech('   ')).toEqual([]);
  });
});
