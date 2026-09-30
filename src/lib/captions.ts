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

  // Timing works on parts: a word with a dash inside ("twin—3D") is said as
  // two, often with a pause between, so the dash is a place to pause too.
  const parts: { word: number; text: string }[] = [];
  words.forEach((word, i) => {
    for (const text of word.split(/(?<=[—–])(?=.)/)) parts.push({ word: i, text });
  });
  const n = parts.length;
  const w = parts.map((pt) => wordWeight(pt.text));
  const p = parts.map((pt, i) => (i < n - 1 ? pauseWeight(pt.text) : 0));

  // Real pauses are pinned to punctuation, longest first: a long silence is
  // almost always a full stop or a dash, while a short one may be a breath.
  // Each is matched to the break nearest to where it would fall if speech
  // were even between the pauses already pinned either side of it, and only
  // if it's close; an unmatched pause is shared out with the words around it.
  const anchors: { part: number; start: number; end: number }[] = [];
  const byLength = [...s.pauses].sort((a, b) => b.end - b.start - (a.end - a.start));
  for (const pause of byLength) {
    const left = anchors.filter((a) => a.end <= pause.start).pop();
    const right = anchors.find((a) => a.start >= pause.end);
    const lo = left ? left.part + 1 : 0;
    const hi = right ? right.part : n - 1;
    const t0 = left ? left.end : s.start;
    const t1 = right ? right.start : s.end;
    let units = 0;
    for (let i = lo; i <= hi; i++) units += w[i] + (i < hi ? p[i] : 0);
    const mid = (pause.start + pause.end) / 2;
    let best = -1;
    let bestDiff = Infinity;
    let acc = 0;
    for (let i = lo; i < hi; i++) {
      acc += w[i];
      const expected = t0 + (acc / units) * (t1 - t0);
      if (p[i] && Math.abs(expected - mid) < bestDiff) {
        best = i;
        bestDiff = Math.abs(expected - mid);
      }
      acc += p[i];
    }
    if (best >= 0 && bestDiff < (t1 - t0) * 0.2 + 0.15) {
      anchors.push({ part: best, start: pause.start, end: pause.end });
      anchors.sort((a, b) => a.part - b.part);
    }
  }
  anchors.push({ part: n - 1, start: s.end, end: s.end });

  // Within each stretch between pauses, time follows word length.
  const partStarts: number[] = [];
  let first = 0;
  let t0 = s.start;
  for (const a of anchors) {
    let units = 0;
    for (let i = first; i <= a.part; i++) units += w[i] + (i < a.part ? p[i] : 0);
    let u = 0;
    for (let i = first; i <= a.part; i++) {
      partStarts[i] = t0 + (u / units) * (a.start - t0);
      u += w[i] + (i < a.part ? p[i] : 0);
    }
    first = a.part + 1;
    t0 = a.end;
  }

  // A word starts when its first part does.
  const starts: number[] = [];
  parts.forEach((pt, i) => {
    if (starts[pt.word] === undefined) starts[pt.word] = partStarts[i];
  });
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
