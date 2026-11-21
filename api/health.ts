import type { IncomingMessage, ServerResponse } from 'node:http';
import { collectGeminiApiKeys, MODEL_CANDIDATES } from './_geminiPool';

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

  const keys = collectGeminiApiKeys();
  const aiConfigured = keys.length > 0;

  res.statusCode = 200;
  res.end(
    JSON.stringify({
      ok: true,
      platform: 'vercel',
      aiConfigured,
      keyCount: keys.length,
      modelCount: MODEL_CANDIDATES.length,
    })
  );
}
