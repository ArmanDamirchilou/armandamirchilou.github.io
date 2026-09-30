import { beforeAll, describe, expect, it } from 'vitest';
import { buildSystemMessage, findSampleResponse, loadPersonality, smartLocalResponse } from '../server/personality';
import { addToHistory, getHistory } from '../server/memory';

beforeAll(() => {
  loadPersonality();
});

describe('personality', () => {
  it('keeps every canned answer short enough to say out loud in one breath or two', () => {
    const { knowledgeBase } = loadPersonality();
    for (const [q, a] of Object.entries(knowledgeBase.sampleResponses)) {
      expect(a.split(/\s+/).length, q).toBeLessThanOrEqual(35);
      expect(a, q).not.toMatch(/\*\*|^#|^- /m);
    }
  });

  it('still has a stored answer for the local fallback brain', () => {
    expect(findSampleResponse('Who are you?')).toMatch(/Arman/);
  });

  it("hides a question's own sample answer from the model, so it answers freshly", () => {
    const stored = findSampleResponse('Who are you?')!;
    expect(buildSystemMessage()).toContain(stored);
    expect(buildSystemMessage('Who are you?')).not.toContain(stored);
    // Other samples still show the model how Arman talks.
    expect(buildSystemMessage('Who are you?')).toContain(findSampleResponse('What are your goals?')!);
  });

  it('tells the model to talk briefly and casually, in English only', () => {
    const sys = buildSystemMessage();
    expect(sys).toMatch(/ENGLISH ONLY/);
    expect(sys).toMatch(/three sentences/i);
    expect(sys).toMatch(/Never use markdown/i);
  });

  it('has a local fallback answer for anything when every LLM is down', () => {
    for (const q of ['hi', 'what are your projects?', 'how old are you', 'asdkjh qwe']) {
      expect(smartLocalResponse(q).length, q).toBeGreaterThan(10);
    }
  });
});

describe('conversation memory', () => {
  it('keeps each visitor in their own session', () => {
    addToHistory('session-alice', 'user', 'hi from alice');
    addToHistory('session-bob', 'user', 'hi from bob');
    expect(getHistory('session-alice').map((h) => h.content)).toEqual(['hi from alice']);
    expect(getHistory('session-bob').map((h) => h.content)).toEqual(['hi from bob']);
  });

  it('caps the number of sessions so memory cannot grow forever', () => {
    addToHistory('session-oldest', 'user', 'first');
    for (let i = 0; i < 600; i++) addToHistory(`session-${i}`, 'user', 'x');
    expect(getHistory('session-oldest')).toEqual([]);
    expect(getHistory('session-599')).toHaveLength(1);
  });
});
