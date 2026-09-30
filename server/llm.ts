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

// Replies are spoken aloud in conversation, so they should be a sentence or
// two. This is a ceiling for the rambling cases, not the target length.
const MAX_REPLY_TOKENS = 220;

/**
 * The reply is read out by TTS and shown as plain text, so markdown and emoji
 * would either be spoken literally ("asterisk asterisk") or render as noise.
 */
export function toSpoken(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(^|[\s(])[*_]([^*_\n]+)[*_](?=[\s).,!?]|$)/g, '$1$2')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*(?:[-*•]|\d+[.)])\s+/gm, '')
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '')
    .replace(/\s*\n+\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.!?;:])/g, '$1')
    .trim();
}

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

  const finalText = toSpoken(text ?? '') || smartLocalResponse(message);
  addToHistory(sessionId, 'assistant', finalText);
  return { text: finalText };
}

// ── OpenRouter (aggregator; FREE models, reachable where OpenAI isn't) ────────
// Tries each configured free model in order, strongest first — if one is
// rate-limited, slow or broken it falls through to the next, and the whole
// chain is bounded so a visitor never waits more than OPENROUTER_BUDGET_MS.

const DEFAULT_OPENROUTER_MODELS = [
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'google/gemma-4-31b-it:free',
  'qwen/qwen3.8-27b:free',
  'inclusionai/ling-3.0-flash-sante:free',
  'openrouter/free',
].join(',');

const OPENROUTER_BUDGET_MS = 20_000;
const OPENROUTER_ATTEMPT_MS = 12_000;

// Models that just failed are skipped until this time, so a model that's
// rate-limited for the next hour doesn't cost every message a round trip.
const cooldownUntil = new Map<string, number>();
// Models that reject reasoning:{enabled:false} (reasoning is mandatory there).
const reasoningRequired = new Set<string>();

function coolDown(model: string, ms: number) {
  // openrouter/free re-rolls its model every call; one bad pick says nothing
  // about the next.
  if (model !== 'openrouter/free') cooldownUntil.set(model, Date.now() + ms);
}

async function callOpenRouter(system: string, history: ChatMsg[]): Promise<string | null> {
  const models = (process.env.OPENROUTER_MODELS || DEFAULT_OPENROUTER_MODELS)
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);

  // openrouter/free picks a random free model per call, so a bad pick is worth
  // a retry — the named models are rate-limited per model, retrying them isn't.
  const attempts = models.flatMap((m) => (m === 'openrouter/free' ? [m, m, m] : [m]));
  const deadline = Date.now() + OPENROUTER_BUDGET_MS;

  for (const model of attempts) {
    const left = deadline - Date.now();
    if (left < 1500) {
      console.error('[LLM] OpenRouter time budget spent, using local brain');
      break;
    }
    if ((cooldownUntil.get(model) ?? 0) > Date.now()) continue;

    try {
      // Thinking models spend 10s+ deliberating before a one-line reply, and
      // hidden reasoning also eats the token budget and truncates the answer.
      const noReasoning = !reasoningRequired.has(model);
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://armandamirchilou.github.io',
          'X-Title': "Arman's AI Twin",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'system', content: system }, ...history],
          max_tokens: MAX_REPLY_TOKENS,
          temperature: 0.85,
          ...(noReasoning ? { reasoning: { enabled: false } } : {}),
        }),
        signal: AbortSignal.timeout(Math.min(OPENROUTER_ATTEMPT_MS, left)),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        if (res.status === 400 && noReasoning && /reasoning/i.test(detail)) {
          reasoningRequired.add(model);
          console.error(`[LLM] OpenRouter ${model} requires reasoning; will send it next time`);
        } else {
          console.error(`[LLM] OpenRouter ${model} -> ${res.status}, trying next`);
          coolDown(model, res.status === 429 ? 60_000 : 10 * 60_000);
        }
        continue;
      }

      const data = (await res.json()) as any;
      const choice = data.choices?.[0];
      let txt: string | undefined = choice?.message?.content;
      // Reasoning models that inline their thinking close it with </think>;
      // only what comes after is the actual reply.
      if (txt?.includes('</think>')) txt = txt.slice(txt.lastIndexOf('</think>') + 8);
      // The free router sometimes lands on a safety classifier (Llama Guard and
      // friends), which answers "safe" / "User Safety: safe" instead of chatting,
      // or on a reasoning model that narrates its plan instead of answering.
      if (txt && (isModerationVerdict(txt) || isLeakedReasoning(txt))) {
        console.error(`[LLM] OpenRouter ${data.model ?? model} returned a non-reply, trying next`);
        coolDown(model, 10 * 60_000);
        continue;
      }
      if (txt && choice?.finish_reason === 'length') txt = trimToLastSentence(txt);
      if (txt && txt.trim()) return txt;
    } catch (err) {
      const timedOut = (err as Error)?.name === 'TimeoutError';
      console.error(`[LLM] OpenRouter ${model} ${timedOut ? 'timed out' : 'error'}, trying next`);
      coolDown(model, 5 * 60_000);
    }
  }
  return null; // every free model failed this round — caller uses local brain
}

/** A reply cut off by the token limit ends mid-word; keep the whole sentences. */
export function trimToLastSentence(text: string): string {
  const t = text.trim();
  const end = Math.max(t.lastIndexOf('. '), t.lastIndexOf('! '), t.lastIndexOf('? '));
  if (/[.!?…]["')]?$/.test(t)) return t;
  return end > 0 ? t.slice(0, end + 1) : t;
}

export function isModerationVerdict(text: string): boolean {
  const t = text.trim();
  return /^(safe|unsafe)(\s+S\d+(,\s*S\d+)*)?$/i.test(t) || /^(user|agent|response)\s+safety\s*:/i.test(t);
}

export function isLeakedReasoning(text: string): boolean {
  return /^(okay|ok|alright|hmm|so)?[,.\s]*(the user\b|here'?s a thinking process|we need to\b|let me think\b)/i.test(
    text.trim()
  );
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
      max_tokens: MAX_REPLY_TOKENS,
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
      max_tokens: MAX_REPLY_TOKENS,
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
        generationConfig: { maxOutputTokens: MAX_REPLY_TOKENS, temperature: 0.85 },
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
      max_tokens: MAX_REPLY_TOKENS,
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
