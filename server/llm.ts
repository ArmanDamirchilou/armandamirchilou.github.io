import { buildSystemMessage, findSampleResponse, smartLocalResponse } from './personality.js';
import { addToHistory, buildMessageHistory } from './memory.js';

interface ChatRequest {
  message: string;
  sessionId: string;
  history?: { role: string; content: string }[];
}

interface ChatResponse {
  text: string;
}

type ChatMsg = { role: string; content: string };

// Providers that failed this session — skipped so a dead key never re-adds latency.
const deadProviders = new Set<string>();

/**
 * Provider-agnostic brain. Whichever free/paid key is present in .env wins, in
 * this order: Groq (free, no credit card, fast) → Gemini (free tier) → OpenAI.
 * If none is set or the call fails, it answers from the local knowledge base
 * (smartLocalResponse) so the twin is never mute or stuck on a canned line.
 */
export async function generateResponse(req: ChatRequest): Promise<ChatResponse> {
  const { message, sessionId } = req;

  addToHistory(sessionId, 'user', message);

  // Exact/near-exact hand-written answers win instantly (no API call).
  const sampleResponse = findSampleResponse(message);
  if (sampleResponse) {
    addToHistory(sessionId, 'assistant', sampleResponse);
    return { text: sampleResponse };
  }

  const systemMessage = buildSystemMessage();
  const history = buildMessageHistory(sessionId);

  // Pick the active provider (first key present wins). Skip any provider that
  // already failed this session — a dead/blocked key is tried once, then never
  // again, so it can't add latency to every message.
  const provider = process.env.OPENROUTER_API_KEY
    ? 'openrouter'
    : process.env.AIML_API_KEY
      ? 'aiml'
      : process.env.GROQ_API_KEY
        ? 'groq'
        : process.env.GEMINI_API_KEY
          ? 'gemini'
          : process.env.OPENAI_API_KEY?.startsWith('sk-')
            ? 'openai'
            : null;

  let text: string | null = null;
  if (provider && !deadProviders.has(provider)) {
    try {
      if (provider === 'openrouter') text = await callOpenRouter(systemMessage, history);
      else if (provider === 'aiml') text = await callAIML(systemMessage, history);
      else if (provider === 'groq') text = await callGroq(systemMessage, history);
      else if (provider === 'gemini') text = await callGemini(systemMessage, history);
      else text = await callOpenAI(systemMessage, history);
      // OpenRouter free models rate-limit temporarily — never permanently
      // disable it; just fall to the local brain for that one message.
      if (!text && provider !== 'openrouter') deadProviders.add(provider);
    } catch (err) {
      console.error(`[LLM] ${provider} error:`, err);
      if (provider !== 'openrouter') deadProviders.add(provider);
      text = null;
    }
  }

  const finalText = text?.trim() || smartLocalResponse(message);
  addToHistory(sessionId, 'assistant', finalText);
  return { text: finalText };
}

// ── OpenRouter (aggregator; FREE models, reachable where OpenAI isn't) ────────
// Tries each configured free model in order — if one is rate-limited (429) or
// gone (404), it falls through to the next, so the twin stays responsive.
async function callOpenRouter(system: string, history: ChatMsg[]): Promise<string | null> {
  const models = (
    process.env.OPENROUTER_MODELS ||
    'inclusionai/ling-3.0-flash:free,google/gemma-4-26b-a4b-it:free,nvidia/nemotron-3-nano-30b-a3b:free'
  )
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);

  // openrouter/free picks a random free model per call, so a bad pick is worth
  // a retry — the named models are rate-limited per model, retrying them isn't.
  const attempts = models.flatMap((m) => (m === 'openrouter/free' ? [m, m, m] : [m]));

  for (const model of attempts) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://arman-damirchilou.dev',
          'X-Title': "Arman's AI Twin",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'system', content: system }, ...history],
          max_tokens: 300,
          temperature: 0.85,
        }),
        signal: AbortSignal.timeout(30000),
      });
      if (res.ok) {
        const data = (await res.json()) as any;
        const txt = data.choices?.[0]?.message?.content;
        // The free router sometimes lands on a safety classifier (Llama Guard and
        // friends), which answers "safe" / "User Safety: safe" instead of chatting.
        if (txt && isModerationVerdict(txt)) {
          console.error(`[LLM] OpenRouter ${data.model ?? model} returned a moderation verdict, trying next`);
          continue;
        }
        if (txt && txt.trim()) return txt;
      } else {
        console.error(`[LLM] OpenRouter ${model} -> ${res.status}, trying next`);
      }
    } catch (err) {
      console.error(`[LLM] OpenRouter ${model} error, trying next:`, err);
    }
  }
  return null; // every free model failed this round — caller uses local brain
}

function isModerationVerdict(text: string): boolean {
  const t = text.trim();
  return /^(safe|unsafe)(\s+S\d+(,\s*S\d+)*)?$/i.test(t) || /^(user|agent|response)\s+safety\s*:/i.test(t);
}

// ── AIML API (OpenAI-compatible aggregator; reachable where OpenAI isn't) ────
async function callAIML(system: string, history: ChatMsg[]): Promise<string | null> {
  const model = process.env.AIML_MODEL || 'gpt-4o-mini';
  const res = await fetch('https://api.aimlapi.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.AIML_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: system }, ...history],
      max_tokens: 300,
      temperature: 0.85,
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    console.error(`[LLM] AIML ${res.status}:`, (await res.text()).slice(0, 200));
    return null;
  }
  const data = (await res.json()) as any;
  return data.choices?.[0]?.message?.content ?? null;
}

// ── Groq (OpenAI-compatible; free, no credit card) ──────────────────────────
async function callGroq(system: string, history: ChatMsg[]): Promise<string | null> {
  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: system }, ...history],
      max_tokens: 300,
      temperature: 0.85,
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    console.error(`[LLM] Groq ${res.status}:`, (await res.text()).slice(0, 160));
    return null;
  }
  const data = (await res.json()) as any;
  return data.choices?.[0]?.message?.content ?? null;
}

// ── Google Gemini (free tier) ───────────────────────────────────────────────
async function callGemini(system: string, history: ChatMsg[]): Promise<string | null> {
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const contents = history.map((h) => ({
    role: h.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: h.content }],
  }));
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents,
        generationConfig: { maxOutputTokens: 300, temperature: 0.85 },
      }),
      signal: AbortSignal.timeout(30000),
    }
  );
  if (!res.ok) {
    console.error(`[LLM] Gemini ${res.status}:`, (await res.text()).slice(0, 160));
    return null;
  }
  const data = (await res.json()) as any;
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
}

// ── OpenAI ──────────────────────────────────────────────────────────────────
async function callOpenAI(system: string, history: ChatMsg[]): Promise<string | null> {
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: system }, ...history],
      max_tokens: 300,
      temperature: 0.85,
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    console.error(`[LLM] OpenAI ${res.status}:`, (await res.text()).slice(0, 160));
    return null;
  }
  const data = (await res.json()) as any;
  return data.choices?.[0]?.message?.content ?? null;
}
