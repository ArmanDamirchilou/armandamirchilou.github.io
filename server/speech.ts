// Longest opening clip before it's split at a pause (see below).
const FIRST_CHUNK_MAX = 70;

/**
 * Splits a reply into chunks the twin can voice one after another. The first
 * clip is what the listener waits on, so it's kept to a single sentence; later
 * sentences are synthesised while the earlier ones play.
 *
 * Tiny fragments ("Haha." / "Yeah!") are merged into the next sentence — a
 * separate clip for two words just adds a gap.
 */
export function splitForSpeech(text: string, minChunk = 24): string[] {
  const sentences = text
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?…])\s+(?=[A-Z0-9"'(])/)
    .map((s) => s.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let pending = '';
  for (const s of sentences) {
    pending = pending ? `${pending} ${s}` : s;
    if (pending.length >= minChunk) {
      chunks.push(pending);
      pending = '';
    }
  }
  if (pending) {
    if (chunks.length) chunks[chunks.length - 1] += ` ${pending}`;
    else chunks.push(pending);
  }

  // Synthesis time grows with length, and the listener hears nothing until the
  // first clip is ready — so a long opening sentence is split at its first
  // natural pause (comma, dash, semicolon) to get the voice going sooner.
  if (chunks.length && chunks[0].length > FIRST_CHUNK_MAX) {
    const first = chunks[0];
    const pause = /[,;:—–]\s|\s-\s/g;
    let m: RegExpExecArray | null;
    while ((m = pause.exec(first))) {
      if (m.index >= minChunk && m.index <= FIRST_CHUNK_MAX) {
        const cut = m.index + 1;
        chunks.splice(0, 1, first.slice(0, cut).replace(/[\s—–-]+$/, '').trim(), first.slice(cut).replace(/^[\s—–-]+/, '').trim());
        break;
      }
    }
  }
  return chunks.filter(Boolean);
}

