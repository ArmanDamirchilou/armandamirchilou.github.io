import express from 'express';
import cors from 'cors';
import { Agent, fetch as undiciFetch } from 'undici';
import { config } from 'dotenv';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { activeProviders, generateResponse } from './llm.js';
import { activeVoice, cancelSpeech, prefetchSpeech, synthesizeSpeech } from './tts.js';
import { deliver, nextJobs, releaseWaiter, requeue } from './voiceWorker.js';
import { loadPersonality } from './personality.js';

config();

const app = express();
const PORT = process.env.PORT || 3001;

// Daytona's preview proxy already answers preflights and stamps its own
// Access-Control-Allow-Origin; a second one from us makes browsers reject the
// response outright, so hosts like that set PROXY_HANDLES_CORS=1.
if (process.env.PROXY_HANDLES_CORS !== '1') app.use(cors());
app.use(express.json());
app.use('/audio', express.static(join(process.cwd(), 'public', 'audio')));

// Load personality data on startup
try {
  loadPersonality();
  console.log('[Server] Personality data loaded');
} catch (err) {
  console.error('[Server] Failed to load personality:', err);
}

// Health check
app.get('/api/health', async (_req, res) => {
  // "voiceClone" predates the non-clone engines; the page reads it as "does
  // the twin have a real voice right now". "voice" says which one.
  const voice = await activeVoice();
  const voiceClone: 'live' | 'down' = voice ? 'live' : 'down';
  // Every provider with a key, in the order they're tried; the local
  // knowledge base answers only when all of them fail.
  const llm = [...activeProviders(), 'local'].join(' → ');

  res.json({
    status: 'online',
    llm,
    tts: process.env.TTS_MODE || 'edge',
    voiceClone,
    voice,
  });
});

// ── Voice worker (Arman's Mac) ───────────────────────────────────────────────
// The worker can't be reached from here, so it long-polls for text and posts
// the finished WAV back. Both routes need the shared VOICE_WORKER_TOKEN; with
// no token configured they don't exist at all.
function workerAuthorized(req: express.Request): boolean {
  const token = process.env.VOICE_WORKER_TOKEN;
  return !!token && token.length >= 24 && req.headers.authorization === `Bearer ${token}`;
}

app.get('/api/voice/next', async (req, res) => {
  if (!workerAuthorized(req)) {
    res.status(404).end();
    return;
  }
  // res (not req) 'close': a request's own close fires once its body is read,
  // which for a GET is immediately. Closing before we've answered = worker gone.
  let closed = false;
  res.on('close', () => {
    if (!res.writableEnded) {
      closed = true;
      releaseWaiter();
    }
  });
  const jobs = await nextJobs(20_000);
  if (closed) {
    jobs.forEach((j) => requeue(j.id));
    return;
  }
  if (!jobs.length) {
    res.status(204).end();
    return;
  }
  res.json({ jobs });
});

app.post(
  '/api/voice/result/:id',
  express.raw({ type: ['audio/wav', 'audio/x-wav', 'audio/mp4', 'application/octet-stream'], limit: '10mb' }),
  (req, res) => {
    if (!workerAuthorized(req)) {
      res.status(404).end();
      return;
    }
    const wav = Buffer.isBuffer(req.body) && req.body.length > 44 ? req.body : null;
    res.status(deliver(req.params.id, wav) ? 204 : 410).end();
  }
);

// Each browser tab sends its own id. Falling back to one shared id would leak
// one visitor's conversation into another's context, so a missing or malformed
// id gets a throwaway session instead.
function sessionOf(req: express.Request): string {
  const raw = req.headers['x-session-id'];
  return typeof raw === 'string' && /^[\w-]{8,64}$/.test(raw) ? raw : uuidv4();
}

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history } = req.body;

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    const sessionId = sessionOf(req);
    const requestId = uuidv4();
    // A new question means the last answer won't be heard out.
    cancelSpeech(sessionId);

    console.log(`[Chat] "${message.substring(0, 60)}..." (session: ${sessionId})`);

    // Generate LLM response
    const llmResponse = await generateResponse({
      message,
      sessionId,
      history,
    });

    // Voice synthesis can take longer than the reply itself, and bundling both
    // into one response produces a request long enough for tunnels and proxies
    // to drop. Clients that pass skipTts get the text straight away and fetch
    // the audio separately from /api/speak.
    if (req.body?.skipTts) {
      prefetchSpeech(llmResponse.text, sessionId);
      res.json({ text: llmResponse.text, audioUrl: null, useBrowserTTS: false });
      return;
    }

    const ttsResult = await synthesizeSpeech(llmResponse.text, requestId, sessionId);

    res.json({
      text: llmResponse.text,
      audioUrl: ttsResult.audioUrl,
      useBrowserTTS: ttsResult.useBrowserTTS,
    });
  } catch (err) {
    console.error('[Chat] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Speech for an already-generated reply. Split out from /api/chat so neither
// request stays open long enough to be dropped in transit.
app.post('/api/speak', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      res.status(400).json({ error: 'Text is required' });
      return;
    }
    const result = await synthesizeSpeech(text, uuidv4(), sessionOf(req));
    res.json({ audioUrl: result.audioUrl, useBrowserTTS: result.useBrowserTTS });
  } catch (err) {
    console.error('[Speak] Error:', err);
    // Not fatal — the caller falls back to browser speech synthesis.
    res.status(500).json({ audioUrl: null, useBrowserTTS: true });
  }
});

// The visitor pressed Stop: drop the rest of the reply that's being prepared.
app.post('/api/speak/cancel', (req, res) => {
  cancelSpeech(sessionOf(req));
  res.status(204).end();
});

// Anam session token — the API key stays server-side; the browser only ever
// receives a short-lived (1h) JWT scoped to the published persona.
app.post('/api/anam/session-token', async (_req, res) => {
  const apiKey = process.env.ANAM_API_KEY;
  const personaId = process.env.ANAM_PERSONA_ID;
  const avatarId = process.env.ANAM_AVATAR_ID;
  if (!apiKey || !(personaId || avatarId)) {
    res.status(503).json({ error: 'Anam is not configured' });
    return;
  }

  // Prefer an ephemeral persona built around Arman's own custom avatar
  // ("Leo", created from his photo) — the saved persona in the lab points at a
  // stock avatar and the lab UI is unreachable from this network to change it.
  const personaConfig = avatarId
    ? {
        name: 'Arman',
        avatarId,
        avatarModel: process.env.ANAM_AVATAR_MODEL || 'cara-4',
        voiceId: process.env.ANAM_VOICE_ID,
        llmId: 'a7cf662c-2ace-4de1-a21e-ef0fbf144bb7',
        systemPrompt:
          "You are the digital twin of Arman Damirchilou, a 16-year-old AI researcher and engineer from Tehran, Iran. You speak in first person as Arman: friendly, sharp, ambitious. You never break character.",
      }
    : { personaId };
  // Reaching api.anam.ai from this network can take >10s to establish a
  // connection (undici's default connect timeout), so use a patient agent
  // and retry once before giving up.
  const anamAgent = new Agent({ connect: { timeout: 30000 } });
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const r = await undiciFetch('https://api.anam.ai/v1/auth/session-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ personaConfig }),
        dispatcher: anamAgent,
        signal: AbortSignal.timeout(45000),
      });
      if (!r.ok) {
        const detail = await r.text().catch(() => '');
        console.error(`[Anam] token request failed: ${r.status} ${detail.slice(0, 200)}`);
        res.status(502).json({ error: 'Anam token request failed', status: r.status });
        return;
      }
      const data = (await r.json()) as { sessionToken?: string };
      if (!data.sessionToken) {
        res.status(502).json({ error: 'Anam returned no session token' });
        return;
      }
      res.json({ sessionToken: data.sessionToken });
      return;
    } catch (err) {
      console.error(`[Anam] token error (attempt ${attempt}/2):`, err);
      if (attempt === 2) res.status(502).json({ error: 'Could not reach Anam' });
    }
  }
});

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════╗
║   🤖 Arman's Digital Twin — Server Online   ║
║                                              ║
║   API:  http://localhost:${PORT}               ║
║                                              ║
║   Endpoints:                                 ║
║     GET  /api/health                         ║
║     POST /api/chat                           ║
╚══════════════════════════════════════════════╝
  `);
});
