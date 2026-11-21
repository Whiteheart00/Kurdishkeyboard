import type { IncomingMessage, ServerResponse } from 'node:http';

const PLACEHOLDER_KEYS = new Set(['MY_GEMINI_API_KEY', 'YOUR_GEMINI_API_KEY', '']);
const MODEL_COUNT = 5;

function countConfiguredGeminiKeys(): number {
  const seen = new Set<string>();
  const addRaw = (raw: string | undefined) => {
    if (!raw) return;
    for (const part of raw.split(/[\s,;]+/)) {
      const clean = part.trim().replace(/^["']|["']$/g, '');
      if (clean && !PLACEHOLDER_KEYS.has(clean)) {
        seen.add(clean);
      }
    }
  };

  addRaw(process.env.GEMINI_API_KEY);
  addRaw(process.env.GEMINI_API_KEYS);
  for (const [envName, envVal] of Object.entries(process.env)) {
    if (/^GEMINI_API_KEY_\d+$/.test(envName) && envVal) {
      addRaw(envVal);
    }
  }
  return seen.size;
}

function setCors(res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
}

export default function handler(req: IncomingMessage, res: ServerResponse) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const keyCount = countConfiguredGeminiKeys();
  const aiConfigured = keyCount > 0;

  res.statusCode = 200;
  res.end(
    JSON.stringify({
      ok: true,
      platform: 'vercel',
      aiConfigured,
      keyCount,
      modelCount: MODEL_COUNT,
    })
  );
}
