import { GoogleGenAI, ThinkingLevel } from '@google/genai';

export interface ModelCandidate {
  id: string;
  thinkingLevel?: ThinkingLevel;
}

/**
 * Multi-model failover chain (each model carries its own independent quota per API key).
 * Ordered from fastest/highest-quota to fallback models.
 */
export const MODEL_CANDIDATES: ModelCandidate[] = [
  { id: 'gemini-3.1-flash-lite', thinkingLevel: ThinkingLevel.MINIMAL },
  { id: 'gemini-4-hydrogen', thinkingLevel: ThinkingLevel.LOW },
  { id: 'gemini-2.5-flash-lite' },
  { id: 'gemini-2.5-flash' },
];

const PLACEHOLDER_KEYS = new Set(['MY_GEMINI_API_KEY', 'YOUR_GEMINI_API_KEY', '']);

/**
 * Collects all configured Gemini API keys from process.env:
 * - GEMINI_API_KEY (supports single key or comma/newline-separated keys)
 * - GEMINI_API_KEYS (optional comma/newline-separated list)
 * - GEMINI_API_KEY_1, GEMINI_API_KEY_2, ..., GEMINI_API_KEY_N (any positive integer)
 */
export function collectGeminiApiKeys(): string[] {
  const seen = new Set<string>();
  const keys: string[] = [];

  const addRaw = (raw: string | undefined) => {
    if (!raw) return;
    for (const part of raw.split(/[\s,;]+/)) {
      const clean = part.trim().replace(/^["']|["']$/g, '');
      if (clean && !PLACEHOLDER_KEYS.has(clean) && !seen.has(clean)) {
        seen.add(clean);
        keys.push(clean);
      }
    }
  };

  addRaw(process.env.GEMINI_API_KEY);
  addRaw(process.env.GEMINI_API_KEYS);

  const numbered: { num: number; val: string | undefined }[] = [];
  for (const [envName, envVal] of Object.entries(process.env)) {
    const m = /^GEMINI_API_KEY_(\d+)$/.exec(envName);
    if (m && envVal) {
      numbered.push({ num: Number(m[1]), val: envVal });
    }
  }
  numbered.sort((a, b) => a.num - b.num);
  for (const item of numbered) {
    addRaw(item.val);
  }

  return keys;
}

// Module-level state (persists across warm serverless invocations & Node server lifetime)
let roundRobinCursor = 0;
const clientCache = new Map<string, GoogleGenAI>();
const pairCooldownUntil = new Map<string, number>();
const keyInvalidUntil = new Map<number, number>();
const responseCache = new Map<string, { value: string; expiresAt: number }>();

const MAX_CACHE_ENTRIES = 300;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

function getClientForKey(apiKey: string): GoogleGenAI {
  let client = clientCache.get(apiKey);
  if (!client) {
    client = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    clientCache.set(apiKey, client);
  }
  return client;
}

export function getCachedAiResponse(cacheKey: string): string | null {
  const hit = responseCache.get(cacheKey);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    responseCache.delete(cacheKey);
    return null;
  }
  // Refresh LRU recency
  responseCache.delete(cacheKey);
  responseCache.set(cacheKey, hit);
  return hit.value;
}

export function setCachedAiResponse(cacheKey: string, value: string): void {
  if (!value.trim()) return;
  if (responseCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = responseCache.keys().next().value;
    if (oldestKey !== undefined) responseCache.delete(oldestKey);
  }
  responseCache.set(cacheKey, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

type ErrorKind = 'quota' | 'invalid_key' | 'not_found' | 'transient' | 'other';

function classifyGeminiError(err: unknown): { kind: ErrorKind; message: string } {
  const rawMsg =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
      ? err
      : JSON.stringify(err ?? '');
  const lower = rawMsg.toLowerCase();

  if (
    lower.includes('429') ||
    lower.includes('resource_exhausted') ||
    lower.includes('quota') ||
    lower.includes('rate limit') ||
    lower.includes('too many requests')
  ) {
    return { kind: 'quota', message: rawMsg };
  }
  if (
    lower.includes('api_key_invalid') ||
    lower.includes('api key not valid') ||
    lower.includes('permission_denied') ||
    lower.includes('403') ||
    lower.includes('unauthorized') ||
    lower.includes('401')
  ) {
    return { kind: 'invalid_key', message: rawMsg };
  }
  if (lower.includes('404') || lower.includes('not_found') || lower.includes('not found')) {
    return { kind: 'not_found', message: rawMsg };
  }
  if (
    lower.includes('500') ||
    lower.includes('502') ||
    lower.includes('503') ||
    lower.includes('504') ||
    lower.includes('unavailable') ||
    lower.includes('overloaded') ||
    lower.includes('timeout') ||
    lower.includes('fetch failed') ||
    lower.includes('econnreset')
  ) {
    return { kind: 'transient', message: rawMsg };
  }
  return { kind: 'other', message: rawMsg };
}

function recordFailure(keyIdx: number, modelId: string, kind: ErrorKind): void {
  const now = Date.now();
  const pairKey = `${keyIdx}::${modelId}`;
  if (kind === 'invalid_key') {
    keyInvalidUntil.set(keyIdx, now + 15 * 60 * 1000);
  } else if (kind === 'quota') {
    pairCooldownUntil.set(pairKey, now + 65 * 1000);
  } else if (kind === 'not_found') {
    pairCooldownUntil.set(pairKey, now + 10 * 60 * 1000);
  } else if (kind === 'transient') {
    pairCooldownUntil.set(pairKey, now + 15 * 1000);
  }
}

/**
 * Builds an ordered list of (keyIdx, apiKey, model) attempts:
 * - Rotates starting key via round-robin so traffic spreads evenly across all keys.
 * - Tries all active keys on the fastest model first, then falls back through secondary models.
 * - Skips cooled-down pairs first; if everything is cooled down, still tries freshest pairs as a last resort.
 */
function buildAttemptPlan(keys: string[]): { keyIdx: number; apiKey: string; model: ModelCandidate }[] {
  const now = Date.now();
  const startOffset = roundRobinCursor % keys.length;
  roundRobinCursor = (roundRobinCursor + 1) % 1000000;

  const ready: { keyIdx: number; apiKey: string; model: ModelCandidate }[] = [];
  const cooledFallback: { keyIdx: number; apiKey: string; model: ModelCandidate; until: number }[] = [];

  for (const model of MODEL_CANDIDATES) {
    for (let step = 0; step < keys.length; step++) {
      const keyIdx = (startOffset + step) % keys.length;
      const invalidUntil = keyInvalidUntil.get(keyIdx) || 0;
      if (invalidUntil > now) continue;

      const pairKey = `${keyIdx}::${model.id}`;
      const coolUntil = pairCooldownUntil.get(pairKey) || 0;
      if (coolUntil > now) {
        cooledFallback.push({ keyIdx, apiKey: keys[keyIdx], model, until: coolUntil });
      } else {
        ready.push({ keyIdx, apiKey: keys[keyIdx], model });
      }
    }
  }

  if (ready.length > 0) {
    return ready;
  }

  // If all pairs are in cooldown, try the ones closest to expiring (up to 4 attempts)
  cooledFallback.sort((a, b) => a.until - b.until);
  return cooledFallback.slice(0, 4).map(({ keyIdx, apiKey, model }) => ({ keyIdx, apiKey, model }));
}

function buildConfig(systemInstruction: string, model: ModelCandidate) {
  return model.thinkingLevel
    ? {
        thinkingConfig: { thinkingLevel: model.thinkingLevel },
        systemInstruction,
      }
    : { systemInstruction };
}

export async function generateTextWithFailover(params: {
  contents: string;
  systemInstruction: string;
  cacheKey?: string;
}): Promise<string> {
  if (params.cacheKey) {
    const cached = getCachedAiResponse(params.cacheKey);
    if (cached !== null) return cached;
  }

  const keys = collectGeminiApiKeys();
  if (keys.length === 0) {
    throw new Error('NO_GEMINI_KEYS');
  }

  const plan = buildAttemptPlan(keys);
  let lastError: unknown = null;

  for (const attempt of plan) {
    try {
      const ai = getClientForKey(attempt.apiKey);
      const response = await ai.models.generateContent({
        model: attempt.model.id,
        contents: params.contents,
        config: buildConfig(params.systemInstruction, attempt.model),
      });
      const text = (response.text ?? '').trim();
      if (text && params.cacheKey) {
        setCachedAiResponse(params.cacheKey, text);
      }
      return text;
    } catch (err) {
      lastError = err;
      const { kind } = classifyGeminiError(err);
      recordFailure(attempt.keyIdx, attempt.model.id, kind);
      // Only stop early if error is definitely a bad user payload (not key/quota/model/network)
      if (kind === 'other') {
        continue;
      }
    }
  }

  const { kind, message } = classifyGeminiError(lastError);
  if (kind === 'quota') {
    throw new Error('هەموو کلیلەکان کاتی سنووری خولەکیان پڕ بووە، تکایە چەند چرکەیەک دواتر هەوڵ بدەرەوە.');
  }
  throw new Error(message || 'هەڵە لە پەیوەندی بە ژیری دەسکرددا ڕوویدا.');
}

/**
 * Opens a streaming Gemini generation with automatic multi-key + multi-model failover.
 * Pre-reads the very first non-empty chunk before invoking `onStart` so HTTP headers are never sent
 * until a working key+model is confirmed!
 */
export async function streamTextWithFailover(params: {
  contents: string;
  systemInstruction: string;
  cacheKey?: string;
  onStart: () => void;
  onChunk: (chunkText: string) => void;
}): Promise<void> {
  if (params.cacheKey) {
    const cached = getCachedAiResponse(params.cacheKey);
    if (cached !== null) {
      params.onStart();
      params.onChunk(cached);
      return;
    }
  }

  const keys = collectGeminiApiKeys();
  if (keys.length === 0) {
    throw new Error('NO_GEMINI_KEYS');
  }

  const plan = buildAttemptPlan(keys);
  let lastError: unknown = null;

  for (const attempt of plan) {
    let started = false;
    let accumulated = '';
    try {
      const ai = getClientForKey(attempt.apiKey);
      const stream = await ai.models.generateContentStream({
        model: attempt.model.id,
        contents: params.contents,
        config: buildConfig(params.systemInstruction, attempt.model),
      });

      for await (const chunk of stream) {
        const piece = chunk.text;
        if (!piece) continue;
        if (!started) {
          started = true;
          params.onStart();
        }
        accumulated += piece;
        params.onChunk(piece);
      }

      if (!started) {
        params.onStart();
      }
      if (accumulated.trim() && params.cacheKey) {
        setCachedAiResponse(params.cacheKey, accumulated.trim());
      }
      return;
    } catch (err) {
      lastError = err;
      const { kind } = classifyGeminiError(err);
      recordFailure(attempt.keyIdx, attempt.model.id, kind);
      // If we already streamed partial text to the client, cannot seamlessly switch mid-stream
      if (started) {
        return;
      }
    }
  }

  const { kind, message } = classifyGeminiError(lastError);
  if (kind === 'quota') {
    throw new Error('هەموو کلیلەکان کاتی سنووری خولەکیان پڕ بووە، تکایە چەند چرکەیەک دواتر هەوڵ بدەرەوە.');
  }
  throw new Error(message || 'هەڵە لە پەیوەندی بە ژیری دەسکرددا ڕوویدا.');
}
