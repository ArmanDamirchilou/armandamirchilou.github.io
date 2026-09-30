import { join } from 'path';
import { writeFileSync, mkdirSync, existsSync, renameSync, rmSync, readdirSync, statSync } from 'fs';
import { randomUUID } from 'crypto';
import { cancelGroup, requestClip, workerAlive } from './voiceWorker.js';
import { splitForSpeech } from './speech.js';
import { voiceText } from './links.js';

interface TTSResult {
  audioUrl: string | null;
  useBrowserTTS: boolean;
  /** The visitor moved on; nobody will play this, so don't fall back either. */
  cancelled?: boolean;
}

const XTTS_URL = 'http://127.0.0.1:5050';
const CHATTERBOX_URL = 'http://127.0.0.1:5060';
const VOICEBOX_URL = 'http://127.0.0.1:17493';
const KOKORO_URL = 'http://127.0.0.1:5070';
const POCKET_URL = 'http://127.0.0.1:5080';

// Local voice server behind each mode, for the health check's "voice" field.
const VOICE_SERVERS: Record<string, string> = {
  kokoro: KOKORO_URL,
  pocket: POCKET_URL,
  chatterbox: CHATTERBOX_URL,
  clone: XTTS_URL,
};

async function serverReady(base: string): Promise<boolean> {
  try {
    const r = await fetch(`${base}/health`, { signal: AbortSignal.timeout(1500) });
    const d = (await r.json()) as { status?: string };
    return d?.status === 'ready';
  } catch {
    return false;
  }
}

/**
 * Which voice the twin is speaking with right now: 'clone' (Arman's own, from
 * the remote worker), 'standard' (a local engine), or null (none, so the
 * browser's built-in voice takes over).
 */
export async function activeVoice(): Promise<'clone' | 'standard' | null> {
  const mode = process.env.TTS_MODE || 'edge';
  if (mode === 'clone-remote') {
    if (workerAlive()) return 'clone';
    return (await serverReady(KOKORO_URL)) ? 'standard' : null;
  }
  if (mode === 'pocket') {
    if (await serverReady(POCKET_URL)) return 'clone';
    return (await serverReady(KOKORO_URL)) ? 'standard' : null;
  }
  const base = VOICE_SERVERS[mode];
  if (!base) return null;
  return (await serverReady(base)) ? (mode === 'kokoro' ? 'standard' : 'clone') : null;
}

/** Arman's cloned voice from the worker, written out like any other clip. */
async function synthesizeRemoteClone(text: string, requestId: string, group?: string): Promise<TTSResult> {
  const started = Date.now();
  const wav = await requestClip(text, 20_000, group);
  if (wav === 'cancelled') return { audioUrl: null, useBrowserTTS: false, cancelled: true };
  if (!wav) {
    console.log(`[TTS] Clone (worker) gave nothing after ${Date.now() - started}ms, using fallback`);
    return { audioUrl: null, useBrowserTTS: true };
  }
  const audioDir = join(process.cwd(), 'public', 'audio');
  if (!existsSync(audioDir)) mkdirSync(audioDir, { recursive: true });
  const filename = `speech_${requestId}.${clipExt(wav)}`;
  writeFileSync(join(audioDir, filename), wav);
  console.log(`[TTS] Clone (worker): ${filename} ${wav.length}B in ${Date.now() - started}ms`);
  return { audioUrl: `/audio/${filename}`, useBrowserTTS: false };
}

/**
 * Voice servers answer with AAC, MP3 or WAV; the file extension decides the
 * Content-Type the clip is served with, so it has to match the bytes.
 */
export function clipExt(audio: Buffer): 'm4a' | 'mp3' | 'wav' {
  if (audio.subarray(4, 8).toString('latin1') === 'ftyp') return 'm4a';
  if (audio.subarray(0, 3).toString('latin1') === 'ID3' || (audio[0] === 0xff && (audio[1] & 0xe0) === 0xe0)) return 'mp3';
  return 'wav';
}

// Clips are fetched once, right after synthesis, so anything older than this
// is dead weight; without pruning they pile up until the disk is full.
const AUDIO_TTL_MS = 15 * 60 * 1000;
let lastPrune = 0;

function pruneOldAudio() {
  const now = Date.now();
  if (now - lastPrune < 60_000) return;
  lastPrune = now;
  const dir = join(process.cwd(), 'public', 'audio');
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    try {
      if (now - statSync(path).mtimeMs > AUDIO_TTL_MS) rmSync(path, { recursive: true, force: true });
    } catch { /* raced with another prune or a request; harmless */ }
  }
}

// Clips started before the page asked for them, keyed by visitor + exact text.
const prefetched = new Map<string, { clip: Promise<TTSResult>; at: number; group: string }>();
const PREFETCH_TTL_MS = 2 * 60 * 1000;
const key = (group: string, text: string) => `${group}\u0000${text}`;

// Bumped whenever a visitor interrupts, so a queued sentence can tell that
// nobody is waiting for it any more.
const runs = new Map<string, number>();

/**
 * Starts voicing a reply the moment it exists, sentence by sentence, instead
 * of waiting for the page to request each one: by the time the page asks for
 * sentence two it is usually ready, which saves a round trip per sentence.
 * The page splits with the same splitForSpeech, so its requests match these
 * keys exactly.
 *
 * The remote clone takes the whole reply at once (the worker batches it). A
 * local engine runs one clip at a time, so sentences are queued in order:
 * fired together they'd race for the engine and the first one, the one the
 * visitor is waiting on, could come out last.
 */
export function prefetchSpeech(text: string, group: string) {
  const mode = process.env.TTS_MODE || 'edge';
  const remote = mode === 'clone-remote' && workerAlive();
  if (!remote && mode !== 'pocket') return;
  const now = Date.now();
  for (const [k, entry] of prefetched) if (now - entry.at > PREFETCH_TTL_MS) prefetched.delete(k);
  if (runs.size > 10_000) runs.clear();
  const run = (runs.get(group) ?? 0) + 1;
  runs.set(group, run);
  let previous: Promise<unknown> = Promise.resolve();
  for (const chunk of splitForSpeech(text)) {
    if (prefetched.has(key(group, chunk))) continue;
    const clip = remote
      ? synthesizeFresh(chunk, randomUUID(), group)
      : previous.then((): Promise<TTSResult> =>
          runs.get(group) === run
            ? synthesizeFresh(chunk, randomUUID(), group)
            : Promise.resolve({ audioUrl: null, useBrowserTTS: false, cancelled: true }));
    clip.catch(() => {});
    previous = clip.catch(() => {});
    prefetched.set(key(group, chunk), { clip, at: now, group });
  }
}

/** The visitor interrupted: stop preparing anything they haven't heard yet. */
export function cancelSpeech(group: string) {
  for (const [k, entry] of prefetched) if (entry.group === group) prefetched.delete(k);
  runs.set(group, (runs.get(group) ?? 0) + 1);
  cancelGroup(group);
}

export async function synthesizeSpeech(text: string, requestId: string, group = requestId): Promise<TTSResult> {
  const hit = prefetched.get(key(group, text));
  if (hit && Date.now() - hit.at < PREFETCH_TTL_MS) {
    prefetched.delete(key(group, text));
    const r = await hit.clip;
    if (!r.cancelled) return r;
  }
  return synthesizeFresh(text, requestId, group);
}

async function synthesizeFresh(written: string, requestId: string, group?: string): Promise<TTSResult> {
  const mode = process.env.TTS_MODE || 'edge';
  // Said the way a person says it: "armandamirchilou at gmail dot com".
  const text = voiceText(written);
  pruneOldAudio();

  // Arman's cloned voice from the remote worker → Kokoro → Edge fallback
  if (mode === 'clone-remote') {
    const c = await synthesizeRemoteClone(text, requestId, group);
    if (c.audioUrl || c.cancelled) return c;
  }

  // Arman's voice cloned by Pocket TTS on this host (:5080) → Kokoro → Edge
  if (mode === 'pocket') {
    const p = await synthesizeClone(text, requestId, POCKET_URL, 'Pocket');
    if (p.audioUrl) return p;
    console.log('[TTS] Pocket unavailable, falling back to Kokoro');
  }

  // Kokoro (:5070) — fast CPU voice for hosts without a GPU → Edge fallback
  if (mode === 'kokoro' || mode === 'clone-remote' || mode === 'pocket') {
    const k = await synthesizeClone(text, requestId, KOKORO_URL, 'Kokoro');
    if (k.audioUrl) return k;
    console.log('[TTS] Kokoro unavailable, falling back to Edge TTS');
  }

  // Chatterbox (2026 clone, local :5060) → XTTS (:5050) → Edge fallback chain
  if (mode === 'chatterbox') {
    const cb = await synthesizeClone(text, requestId, CHATTERBOX_URL, 'Chatterbox');
    if (cb.audioUrl) return cb;
    console.log('[TTS] Chatterbox unavailable, trying XTTS clone');
    const clone = await synthesizeClone(text, requestId, XTTS_URL, 'XTTS');
    if (clone.audioUrl) return clone;
    console.log('[TTS] XTTS unavailable too, falling back to Edge TTS');
  }

  // Voicebox (Chatterbox/Qwen clone via local API) → XTTS → Edge fallback chain
  if (mode === 'voicebox') {
    const vb = await synthesizeVoicebox(text, requestId);
    if (vb.audioUrl) return vb;
    console.log('[TTS] Voicebox unavailable, trying XTTS clone');
    const clone = await synthesizeClone(text, requestId, XTTS_URL, 'XTTS');
    if (clone.audioUrl) return clone;
    console.log('[TTS] XTTS unavailable too, falling back to Edge TTS');
  }

  // Try voice clone server first if mode is "clone" (XTTS on :5050)
  if (mode === 'clone') {
    const result = await synthesizeClone(text, requestId, XTTS_URL, 'XTTS');
    if (result.audioUrl) return result;
    console.log('[TTS] Voice clone unavailable, falling back to Edge TTS');
  }

  if (mode === 'elevenlabs') {
    return synthesizeElevenLabs(text, requestId);
  }

  return synthesizeEdgeTTS(text, requestId);
}

/**
 * Voicebox local API (port 17493): generation is async — submit, poll status,
 * then download the finished audio. Engine + profile come from .env so the
 * voice can be upgraded (qwen → chatterbox) without code changes.
 */
async function synthesizeVoicebox(
  text: string,
  requestId: string
): Promise<TTSResult> {
  const profileId = process.env.VOICEBOX_PROFILE_ID;
  if (!profileId) return { audioUrl: null, useBrowserTTS: true };

  try {
    const genRes = await fetch(`${VOICEBOX_URL}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profile_id: profileId,
        text,
        language: 'en',
        ...(process.env.VOICEBOX_ENGINE ? { engine: process.env.VOICEBOX_ENGINE } : {}),
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!genRes.ok) {
      console.error(`[TTS] Voicebox generate failed: ${genRes.status}`);
      return { audioUrl: null, useBrowserTTS: true };
    }
    const gen = (await genRes.json()) as Record<string, unknown>;
    const genId = (gen.generation_id ?? gen.id) as string | undefined;
    if (!genId) {
      console.error('[TTS] Voicebox returned no generation id');
      return { audioUrl: null, useBrowserTTS: true };
    }

    // Poll until the generation completes (worst case ~2 min on first load).
    // The status endpoint replies in SSE framing ("data: {...}"), not plain JSON.
    const deadline = Date.now() + 150000;
    let done = false;
    while (Date.now() < deadline) {
      const st = await fetch(`${VOICEBOX_URL}/generate/${genId}/status`, {
        signal: AbortSignal.timeout(10000),
      });
      if (st.ok) {
        const raw = await st.text();
        const trimmed = raw.trim();
        const jsonLine = trimmed.startsWith('data:')
          ? trimmed.split('\n').filter((l) => l.startsWith('data:')).pop()!.slice(5).trim()
          : trimmed;
        const s = JSON.parse(jsonLine) as Record<string, unknown>;
        const status = String(s.status ?? '').toLowerCase();
        if (['complete', 'completed', 'done', 'ready', 'success'].includes(status)) {
          done = true;
          break;
        }
        if (['failed', 'error', 'cancelled'].includes(status)) {
          console.error('[TTS] Voicebox generation failed:', s.error ?? status);
          return { audioUrl: null, useBrowserTTS: true };
        }
      }
      await new Promise((r) => setTimeout(r, 1200));
    }
    if (!done) {
      console.error('[TTS] Voicebox generation timed out');
      return { audioUrl: null, useBrowserTTS: true };
    }

    const audioRes = await fetch(`${VOICEBOX_URL}/audio/${genId}`, {
      signal: AbortSignal.timeout(30000),
    });
    if (!audioRes.ok) {
      console.error(`[TTS] Voicebox audio fetch failed: ${audioRes.status}`);
      return { audioUrl: null, useBrowserTTS: true };
    }

    const audioDir = join(process.cwd(), 'public', 'audio');
    if (!existsSync(audioDir)) mkdirSync(audioDir, { recursive: true });
    const buffer = Buffer.from(await audioRes.arrayBuffer());
    const filename = `speech_${requestId}.wav`;
    writeFileSync(join(audioDir, filename), buffer);

    console.log(`[TTS] Voicebox clone: ${filename} (${buffer.length} bytes)`);
    return { audioUrl: `/audio/${filename}`, useBrowserTTS: false };
  } catch (err) {
    console.error('[TTS] Voicebox error:', err);
    return { audioUrl: null, useBrowserTTS: true };
  }
}

/**
 * Generic local clone server call. Both XTTS (:5050) and Chatterbox (:5060)
 * expose the same interface: POST /synthesize {text} -> audio/wav.
 */
async function synthesizeClone(
  text: string,
  requestId: string,
  baseUrl: string,
  label: string
): Promise<TTSResult> {
  try {
    const response = await fetch(`${baseUrl}/synthesize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      return { audioUrl: null, useBrowserTTS: true };
    }

    const audioDir = join(process.cwd(), 'public', 'audio');
    if (!existsSync(audioDir)) {
      mkdirSync(audioDir, { recursive: true });
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const filename = `speech_${requestId}.${clipExt(buffer)}`;
    writeFileSync(join(audioDir, filename), buffer);

    console.log(`[TTS] ${label}: ${filename}`);
    return { audioUrl: `/audio/${filename}`, useBrowserTTS: false };
  } catch {
    return { audioUrl: null, useBrowserTTS: true };
  }
}

async function synthesizeEdgeTTS(
  text: string,
  requestId: string
): Promise<TTSResult> {
  try {
    const { MsEdgeTTS, OUTPUT_FORMAT } = await import('msedge-tts');

    const tts = new MsEdgeTTS();
    const voice = process.env.EDGE_TTS_VOICE || 'en-US-AndrewMultilingualNeural';
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);

    const audioDir = join(process.cwd(), 'public', 'audio');
    if (!existsSync(audioDir)) {
      mkdirSync(audioDir, { recursive: true });
    }

    const tempDir = join(audioDir, `temp_${requestId}`);
    mkdirSync(tempDir, { recursive: true });

    await tts.toFile(tempDir, text);

    const filename = `speech_${requestId}.mp3`;
    const tempFile = join(tempDir, 'audio.mp3');
    const finalFile = join(audioDir, filename);
    renameSync(tempFile, finalFile);

    try { rmSync(tempDir, { recursive: true }); } catch {}

    console.log(`[TTS] Edge TTS: ${filename} (${voice})`);
    return { audioUrl: `/audio/${filename}`, useBrowserTTS: false };
  } catch (err) {
    console.error('[TTS] Edge TTS error:', err);
    return { audioUrl: null, useBrowserTTS: true };
  }
}

async function synthesizeElevenLabs(
  text: string,
  requestId: string
): Promise<TTSResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;

  if (!apiKey || !voiceId) {
    return { audioUrl: null, useBrowserTTS: true };
  }

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.8,
            style: 0.3,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      console.error(`[TTS] ElevenLabs error: ${response.status}`);
      return { audioUrl: null, useBrowserTTS: true };
    }

    const audioDir = join(process.cwd(), 'public', 'audio');
    if (!existsSync(audioDir)) {
      mkdirSync(audioDir, { recursive: true });
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const filename = `speech_${requestId}.mp3`;
    writeFileSync(join(audioDir, filename), buffer);

    return { audioUrl: `/audio/${filename}`, useBrowserTTS: false };
  } catch (err) {
    console.error('[TTS] ElevenLabs error:', err);
    return { audioUrl: null, useBrowserTTS: true };
  }
}
