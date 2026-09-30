/**
 * Live captions: the twin's reply is written into the chat word by word, in
 * step with the voice, instead of appearing all at once before it's spoken.
 *
 * The voice engines don't report word timings, so they're estimated from the
 * clip itself: its loudness envelope says where speech starts and ends and
 * where the speaker pauses, and those pauses are matched to the punctuation
 * in the text. Between pauses, time is shared out by word length. That keeps
 * each word within a syllable or two of the voice.
 */

/** Where speech is in a clip, in seconds. */
export interface SpeechSpan {
  start: number;
  end: number;
  pauses: { start: number; end: number }[];
}

const HOP = 0.01; // envelope resolution, seconds
const MIN_PAUSE = 0.12; // shorter gaps are just consonants and breaths

/** Finds the speech, and the pauses inside it, in mono samples. */
export function findSpeech(samples: Float32Array, rate: number): SpeechSpan | null {
  const hop = Math.max(1, Math.round(rate * HOP));
  const frames = Math.floor(samples.length / hop);
  if (!frames) return null;
  const env = new Float32Array(frames);
  let peak = 0;
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    for (let i = f * hop; i < (f + 1) * hop; i++) sum += samples[i] * samples[i];
    env[f] = Math.sqrt(sum / hop);
    if (env[f] > peak) peak = env[f];
  }
  if (peak < 1e-4) return null;
  const threshold = peak * 0.06;

  let first = -1;
  let last = -1;
  for (let f = 0; f < frames; f++) {
    if (env[f] >= threshold) {
      if (first < 0) first = f;
      last = f;
    }
  }
  if (first < 0) return null;

  const pauses: SpeechSpan['pauses'] = [];
  let quietFrom = -1;
  for (let f = first; f <= last; f++) {
    if (env[f] < threshold) {
      if (quietFrom < 0) quietFrom = f;
    } else if (quietFrom >= 0) {
      if ((f - quietFrom) * HOP >= MIN_PAUSE) pauses.push({ start: quietFrom * HOP, end: f * HOP });
      quietFrom = -1;
    }
  }
  return { start: first * HOP, end: (last + 1) * HOP, pauses };
}

/** How long a word takes to say, relative to the others (roughly its length). */
const wordWeight = (w: string) => Math.max(2, w.replace(/[^\p{L}\p{N}]/gu, '').length) + 1;

/** How long a speaker usually pauses after this word, in the same units. */
function pauseWeight(w: string): number {
  if (/[.!?…]["')]*$/.test(w)) return 6;
  if (/[,;:—–]["')]*$/.test(w) || /^[—–-]$/.test(w)) return 3;
  return 0;
}

/**
 * When each word starts, in seconds from the start of the clip. `span` is
 * where the speech is; without one the words are spread over `duration`.
 */
export function wordStarts(words: string[], span: SpeechSpan | null, duration: number): number[] {
  if (!words.length) return [];
  const s: SpeechSpan = span ?? { start: 0, end: Math.max(duration, 0.01), pauses: [] };
  const w = words.map(wordWeight);
  const p = words.map(pauseWeight);

  // Pin each real pause to the punctuation break nearest to where it would
  // fall if the rest of the speech, from the previous pause on, were even. A
  // pause with no break near it (a breath mid-phrase) is left alone: it's
  // shared out with the words around it.
  const anchors: { word: number; start: number; end: number }[] = [];
  let after = -1;
  let from = s.start;
  for (const pause of s.pauses) {
    const expected: number[] = [];
    const units = (i: number) => w[i] + (i < words.length - 1 ? p[i] : 0);
    let rest = 0;
    for (let i = after + 1; i < words.length; i++) rest += units(i);
    let acc = 0;
    for (let i = after + 1; i < words.length; i++) {
      acc += w[i];
      expected[i] = from + (acc / rest) * (s.end - from);
      acc += units(i) - w[i];
    }
    const mid = (pause.start + pause.end) / 2;
    let best = -1;
    for (let i = after + 1; i < words.length - 1; i++) {
      if (!p[i]) continue;
      if (best < 0 || Math.abs(expected[i] - mid) < Math.abs(expected[best] - mid)) best = i;
    }
    if (best >= 0 && Math.abs(expected[best] - mid) < (s.end - from) * 0.25 + 0.2) {
      anchors.push({ word: best, start: pause.start, end: pause.end });
      after = best;
      from = pause.end;
    }
  }
  anchors.push({ word: words.length - 1, start: s.end, end: s.end });

  // Within each stretch between pauses, time follows word length.
  const starts: number[] = [];
  let first = 0;
  let t0 = s.start;
  for (const a of anchors) {
    const idx = [];
    for (let i = first; i <= a.word; i++) idx.push(i);
    const units = idx.reduce((sum, i) => sum + w[i] + (i < a.word ? p[i] : 0), 0);
    let u = 0;
    for (const i of idx) {
      starts[i] = t0 + (u / units) * (a.start - t0);
      u += w[i] + (i < a.word ? p[i] : 0);
    }
    first = a.word + 1;
    t0 = a.end;
  }
  return starts;
}

/** Number of words that have started by time t. */
export function wordsSpokenAt(starts: number[], t: number): number {
  let n = 0;
  while (n < starts.length && starts[n] <= t) n++;
  return n;
}

/** The reply as the captions see it: one space between words. */
export const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();

/**
 * Where each speech chunk sits in the normalized reply, as character offsets.
 * The chunks are the reply cut at sentence ends (a dash at a cut may be
 * dropped), so each is found after the previous one.
 */
export function locateChunks(reply: string, chunks: string[]): { from: number; to: number }[] {
  let cursor = 0;
  return chunks.map((chunk) => {
    const at = reply.indexOf(chunk, cursor);
    const from = at >= 0 ? at : cursor;
    const to = Math.min(reply.length, from + chunk.length);
    cursor = to;
    return { from, to };
  });
}

/** Character offset in `chunk` just past its n-th word (n >= 1). */
export function charsThroughWord(chunk: string, n: number): number {
  if (n <= 0) return 0;
  let seen = 0;
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(chunk))) {
    if (++seen === n) return m.index + m[0].length;
  }
  return chunk.length;
}
