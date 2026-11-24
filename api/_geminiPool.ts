import { GoogleGenAI, ThinkingLevel } from '@google/genai';

export interface ModelCandidate {
  id: string;
  thinkingLevel?: ThinkingLevel;
}

/**
 * Multi-model failover chain (each model carries its own independent quota per API key).
 * Uses active supported models only. Prioritizes gemini-3.1-flash-lite for instant low-latency
 * keyboard operations with automatic failover to gemini-4-hydrogen.
 */
export const MODEL_CANDIDATES: ModelCandidate[] = [
  { id: 'gemini-3.1-flash-lite', thinkingLevel: ThinkingLevel.MINIMAL },
  { id: 'gemini-4-hydrogen', thinkingLevel: ThinkingLevel.LOW },
];

const PLACEHOLDER_KEYS = new Set(['MY_GEMINI_API_KEY', 'YOUR_GEMINI_API_KEY', '']);
const VALID_ASCII_KEY_RE = /^[\x21-\x7E]{16,128}$/;
const EMBEDDED_GEMINI_KEY_RE = /AIza[0-9A-Za-z_-]{20,60}/g;

export interface KeyInspectionResult {
  validKeys: string[];
  rejectedCount: number;
}

/**
 * Collects and sanitizes all configured Gemini API keys from process.env:
 * - GEMINI_API_KEY (supports single key or comma/newline-separated keys)
 * - GEMINI_API_KEYS (optional comma/newline-separated list)
 * - GEMINI_API_KEY_1, GEMINI_API_KEY_2, ..., GEMINI_API_KEY_N (any positive integer)
 *
 * Strictly guarantees pure printable ASCII keys so non-ASCII/Kurdish characters
 * pasted alongside keys can never crash fetch() headers with a ByteString TypeError.
 */
export function inspectGeminiApiKeys(): KeyInspectionResult {
  const seen = new Set<string>();
  const validKeys: string[] = [];
  let rejectedCount = 0;

  const pushKey = (candidate: string) => {
    const clean = candidate.trim().replace(/^["']|["']$/g, '');
    if (!clean || PLACEHOLDER_KEYS.has(clean)) return;
    if (!VALID_ASCII_KEY_RE.test(clean)) {
      rejectedCount += 1;
      return;
    }
    if (!seen.has(clean)) {
      seen.add(clean);
      validKeys.push(clean);
    }
  };

  const addRaw = (raw: string | undefined) => {
    if (!raw) return;
    for (const part of raw.split(/[\s,;]+/)) {
      const trimmed = part.trim().replace(/^["']|["']$/g, '');
      if (!trimmed || PLACEHOLDER_KEYS.has(trimmed)) continue;

      if (VALID_ASCII_KEY_RE.test(trimmed)) {
        pushKey(trimmed);
        continue;
      }

      // Rescue valid AIza... tokens even if non-ASCII/Kurdish text was accidentally pasted next to them
      const rescued = trimmed.match(EMBEDDED_GEMINI_KEY_RE);
      if (rescued && rescued.length > 0) {
        for (const token of rescued) {
          pushKey(token);
        }
      } else {
        rejectedCount += 1;
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

  return { validKeys, rejectedCount };
}

export function collectGeminiApiKeys(): string[] {
  return inspectGeminiApiKeys().validKeys;
}

// Module-level state (persists across warm serverless invocations & Node server lifetime)
let roundRobinCursor = 0;
const clientCache = new Map<string, GoogleGenAI>();
const pairCooldownUntil = new Map<string, number>();
const modelNotFoundUntil = new Map<string, number>();
const modelOverloadedUntil = new Map<string, number>();
const keyInvalidUntil = new Map<number, number>();
const responseCache = new Map<string, { value: string; expiresAt: number }>();

const MAX_CACHE_ENTRIES = 300;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const PER_ATTEMPT_TIMEOUT_MS = 8500; // Client-side AbortController timeout (never sent as X-Server-Timeout)
const TOTAL_FAILOVER_BUDGET_MS = 20000;

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

type ErrorKind =
  | 'quota'
  | 'invalid_key'
  | 'not_found'
  | 'model_overloaded'
  | 'timeout'
  | 'transient'
  | 'other';

function classifyGeminiError(err: unknown): { kind: ErrorKind; message: string } {
  const isAbortError =
    err instanceof Error &&
    (err.name === 'AbortError' || /abort|timed?\s*out/i.test(err.message));

  const rawMsg =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
      ? err
      : JSON.stringify(err ?? '');
  const lower = rawMsg.toLowerCase();

  // 1. Key / project permission errors MUST be checked FIRST so a single bad/unbilled key
  //    never falsely poisons a healthy model.
  if (
    lower.includes('api_key_invalid') ||
    lower.includes('api key not valid') ||
    lower.includes('permission_denied') ||
    lower.includes('free tier is not available') ||
    lower.includes('set up billing') ||
    lower.includes('bytestring') ||
    lower.includes('greater than 255') ||
    lower.includes('"code":403') ||
    lower.includes('"code": 403') ||
    lower.includes('403') ||
    lower.includes('unauthorized') ||
    lower.includes('"code":401') ||
    lower.includes('401')
  ) {
    return { kind: 'invalid_key', message: rawMsg };
  }

  // 2. Model not found / retired
  if (
    lower.includes('"code":404') ||
    lower.includes('"code": 404') ||
    lower.includes('not_found') ||
    lower.includes('is not found') ||
    lower.includes('no longer available')
  ) {
    return { kind: 'not_found', message: rawMsg };
  }

  // 3. Per-key / per-model quota exhaustion
  if (
    lower.includes('429') ||
    lower.includes('resource_exhausted') ||
    lower.includes('quota') ||
    lower.includes('rate limit') ||
    lower.includes('too many requests')
  ) {
    return { kind: 'quota', message: rawMsg };
  }

  // 4. Genuine model-wide 503 overload / high demand
  if (
    lower.includes('503') ||
    lower.includes('service unavailable') ||
    lower.includes('"status":"unavailable"') ||
    lower.includes('"status": "unavailable"') ||
    lower.includes('overloaded') ||
    lower.includes('high demand')
  ) {
    return { kind: 'model_overloaded', message: rawMsg };
  }

  // 5. Client-side timeout / abort
  if (isAbortError || lower.includes('timeout') || lower.includes('etimedout')) {
    return { kind: 'timeout', message: rawMsg };
  }

  // 6. Other transient network errors
  if (
    lower.includes('500') ||
    lower.includes('502') ||
    lower.includes('504') ||
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
    modelNotFoundUntil.set(modelId, now + 20 * 60 * 1000);
  } else if (kind === 'model_overloaded') {
    // 503 high demand is usually brief — deprioritize this model for 15s so we still retry it soon
    modelOverloadedUntil.set(modelId, now + 15 * 1000);
  } else if (kind === 'timeout') {
    modelOverloadedUntil.set(modelId, now + 15 * 1000);
  } else if (kind === 'transient') {
    pairCooldownUntil.set(pairKey, now + 15 * 1000);
  }
}

/**
 * Builds an ordered list of (keyIdx, apiKey, model) attempts:
 * - Rotates starting key via round-robin so traffic spreads evenly across all keys.
 * - Prioritizes healthy models first, placing temporarily overloaded (503) models at the end as backup.
 * - Skips globally unsupported (404) models and known-invalid keys.
 */
function buildAttemptPlan(keys: string[]): { keyIdx: number; apiKey: string; model: ModelCandidate }[] {
  const now = Date.now();
  const startOffset = roundRobinCursor % keys.length;
  roundRobinCursor = (roundRobinCursor + 1) % 1000000;

  const ready: { keyIdx: number; apiKey: string; model: ModelCandidate }[] = [];
  const overloadedFallback: { keyIdx: number; apiKey: string; model: ModelCandidate }[] = [];
  const cooledFallback: { keyIdx: number; apiKey: string; model: ModelCandidate; until: number }[] = [];

  for (const model of MODEL_CANDIDATES) {
    if ((modelNotFoundUntil.get(model.id) || 0) > now) continue;
    const isModelOverloaded = (modelOverloadedUntil.get(model.id) || 0) > now;

    for (let step = 0; step < keys.length; step++) {
      const keyIdx = (startOffset + step) % keys.length;
      const invalidUntil = keyInvalidUntil.get(keyIdx) || 0;
      if (invalidUntil > now) continue;

      const pairKey = `${keyIdx}::${model.id}`;
      const coolUntil = pairCooldownUntil.get(pairKey) || 0;
      if (coolUntil > now) {
        cooledFallback.push({ keyIdx, apiKey: keys[keyIdx], model, until: coolUntil });
      } else if (isModelOverloaded) {
        // Enqueue all non-invalid keys so an invalid/403 key never aborts fallback prematurely;
        // skippedModels still stops hammering an overloaded model on the first 503.
        overloadedFallback.push({ keyIdx, apiKey: keys[keyIdx], model });
      } else {
        ready.push({ keyIdx, apiKey: keys[keyIdx], model });
      }
    }
  }

  if (ready.length > 0 || overloadedFallback.length > 0) {
    return [...ready, ...overloadedFallback];
  }

  // If all pairs are in cooldown, try the ones closest to expiring (up to 4 attempts)
  cooledFallback.sort((a, b) => a.until - b.until);
  return cooledFallback.slice(0, 4).map(({ keyIdx, apiKey, model }) => ({ keyIdx, apiKey, model }));
}

function buildConfig(
  systemInstruction: string,
  model: ModelCandidate,
  abortSignal?: AbortSignal
) {
  return model.thinkingLevel
    ? {
        thinkingConfig: { thinkingLevel: model.thinkingLevel },
        systemInstruction,
        abortSignal,
      }
    : { systemInstruction, abortSignal };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatCompactTrace(summary: string[]): string {
  return summary.length > 0 ? ` [${summary.slice(-4).join(', ')}]` : '';
}

function buildFinalError(lastError: unknown, summary: string[]): Error {
  const { kind, message } = classifyGeminiError(lastError);
  const trace = formatCompactTrace(summary);
  if (kind === 'quota') {
    return new Error(
      `هەموو کلیلەکان کاتی سنووری خولەکیان پڕ بووە، تکایە چەند چرکەیەک دواتر هەوڵ بدەرەوە.${trace}`
    );
  }
  if (kind === 'model_overloaded' || kind === 'timeout') {
    return new Error(
      `سێرڤەری Gemini لەم ساتەدا زۆر قەرەباڵغە (503)، تکایە چەند چرکەیەک دواتر هەوڵ بدەرەوە.${trace}`
    );
  }
  if (kind === 'invalid_key') {
    return new Error(
      `کلیلەکانی Gemini لە Vercel پێویستیان بە پشکنین یان چالاککردن هەیە (403/401).${trace}`
    );
  }
  return new Error(
    message ? `${message.slice(0, 180)}${trace}` : `هەڵە لە پەیوەندی بە ژیری دەسکرددا ڕوویدا.${trace}`
  );
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

  const startedAt = Date.now();
  const skippedKeys = new Set<number>();
  const failureSummary: string[] = [];
  let attempts = 0;
  let lastError: unknown = null;

  // Up to 2 passes: if all models hit a brief 503 spike on pass 1, pause briefly and retry once
  for (let pass = 0; pass < 2; pass++) {
    if (pass === 1) {
      const { kind } = classifyGeminiError(lastError);
      if (kind !== 'model_overloaded' && kind !== 'transient') break;
      if (Date.now() - startedAt > TOTAL_FAILOVER_BUDGET_MS - 4000) break;
      await sleep(600);
    }

    const plan = buildAttemptPlan(keys);
    const skippedModels = new Set<string>();

    for (const attempt of plan) {
      if (skippedModels.has(attempt.model.id) || skippedKeys.has(attempt.keyIdx)) continue;
      if (attempts >= 10 || Date.now() - startedAt > TOTAL_FAILOVER_BUDGET_MS) break;
      attempts += 1;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), PER_ATTEMPT_TIMEOUT_MS);

      try {
        const ai = getClientForKey(attempt.apiKey);
        const response = await ai.models.generateContent({
          model: attempt.model.id,
          contents: params.contents,
          config: buildConfig(params.systemInstruction, attempt.model, controller.signal),
        });
        const text = (response.text ?? '').trim();
        if (text && params.cacheKey) {
          setCachedAiResponse(params.cacheKey, text);
        }
        return text;
      } catch (err) {
        lastError = err;
        const { kind } = classifyGeminiError(err);
        failureSummary.push(`${attempt.model.id}:${kind}`);
        recordFailure(attempt.keyIdx, attempt.model.id, kind);
        if (kind === 'not_found' || kind === 'model_overloaded' || kind === 'timeout') {
          skippedModels.add(attempt.model.id);
        }
        if (kind === 'invalid_key') skippedKeys.add(attempt.keyIdx);
      } finally {
        clearTimeout(timer);
      }
    }
  }

  throw buildFinalError(lastError, failureSummary);
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

  const startedAt = Date.now();
  const skippedKeys = new Set<number>();
  const failureSummary: string[] = [];
  let attempts = 0;
  let lastError: unknown = null;

  for (let pass = 0; pass < 2; pass++) {
    if (pass === 1) {
      const { kind } = classifyGeminiError(lastError);
      if (kind !== 'model_overloaded' && kind !== 'transient') break;
      if (Date.now() - startedAt > TOTAL_FAILOVER_BUDGET_MS - 4000) break;
      await sleep(600);
    }

    const plan = buildAttemptPlan(keys);
    const skippedModels = new Set<string>();

    for (const attempt of plan) {
      if (skippedModels.has(attempt.model.id) || skippedKeys.has(attempt.keyIdx)) continue;
      if (attempts >= 10 || Date.now() - startedAt > TOTAL_FAILOVER_BUDGET_MS) break;
      attempts += 1;

      let started = false;
      let accumulated = '';
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), PER_ATTEMPT_TIMEOUT_MS);

      try {
        const ai = getClientForKey(attempt.apiKey);
        const stream = await ai.models.generateContentStream({
          model: attempt.model.id,
          contents: params.contents,
          config: buildConfig(params.systemInstruction, attempt.model, controller.signal),
        });

        for await (const chunk of stream) {
          const piece = chunk.text;
          if (!piece) continue;
          if (!started) {
            clearTimeout(timer);
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
        failureSummary.push(`${attempt.model.id}:${kind}`);
        recordFailure(attempt.keyIdx, attempt.model.id, kind);
        if (kind === 'not_found' || kind === 'model_overloaded' || kind === 'timeout') {
          skippedModels.add(attempt.model.id);
        }
        if (kind === 'invalid_key') skippedKeys.add(attempt.keyIdx);
        // If we already streamed partial text to the client, cannot seamlessly switch mid-stream
        if (started) {
          return;
        }
      } finally {
        clearTimeout(timer);
      }
    }
  }

  throw buildFinalError(lastError, failureSummary);
}
