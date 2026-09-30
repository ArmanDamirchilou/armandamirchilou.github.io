import { describe, expect, it } from 'vitest';
import { isLeakedReasoning, isModerationVerdict, toSpoken, trimToLastSentence } from '../server/llm';

describe('toSpoken', () => {
  it('turns typographic hyphens and quotes into plain ones the voice reads cleanly', () => {
    expect(toSpoken('a sixteen\u2011year\u2011old dev, what\u2019s up? \u201Chi\u201D')).toBe(`a sixteen-year-old dev, what's up? "hi"`);
  });

  it('strips markdown the TTS would read out literally', () => {
    expect(toSpoken('I won **gold** at *Innoverse*.')).toBe('I won gold at Innoverse.');
    expect(toSpoken('## Projects\n- Traffic AI\n- Water AI')).toBe('Projects Traffic AI Water AI');
    expect(toSpoken('1. First\n2) Second')).toBe('First Second');
    expect(toSpoken('See [my GitHub](https://github.com/x) and `rag-eval`.')).toBe('See my GitHub and rag-eval.');
  });

  it('drops emoji', () => {
    expect(toSpoken('Not bad for sixteen 😎🔥, right?')).toBe('Not bad for sixteen, right?');
    expect(toSpoken('Love it! 🚀')).toBe('Love it!');
  });

  it('leaves ordinary speech alone', () => {
    const s = "Hey! I'm Arman — 16, from Tehran. Snake_case is fine, 3*4 too.";
    expect(toSpoken(s)).toBe(s);
  });
});

describe('model output filters', () => {
  it('recognises safety-classifier verdicts', () => {
    expect(isModerationVerdict('safe')).toBe(true);
    expect(isModerationVerdict('unsafe\nS1, S10')).toBe(true);
    expect(isModerationVerdict('User Safety: safe')).toBe(true);
    expect(isModerationVerdict('Safe to say I love AI.')).toBe(false);
  });

  it('recognises reasoning narrated in place of a reply', () => {
    expect(isLeakedReasoning('Okay, the user is asking about my projects.')).toBe(true);
    expect(isLeakedReasoning("Here's a thinking process: 1. Analyze")).toBe(true);
    expect(isLeakedReasoning('We need to respond as Arman.')).toBe(true);
    expect(isLeakedReasoning("Okay so I'm building a twin right now.")).toBe(false);
  });
});

describe('trimToLastSentence', () => {
  it('drops a sentence cut off by the token limit', () => {
    expect(trimToLastSentence("It's a work in progress. It's pretty cool to see it come together. What")).toBe(
      "It's a work in progress. It's pretty cool to see it come together."
    );
  });

  it('keeps complete text untouched', () => {
    expect(trimToLastSentence('All done here!')).toBe('All done here!');
  });

  it('keeps a single unfinished sentence rather than returning nothing', () => {
    expect(trimToLastSentence('Honestly I was going to')).toBe('Honestly I was going to');
  });
});
