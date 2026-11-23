import type { IncomingMessage, ServerResponse } from 'node:http';
import { inspectGeminiApiKeys, MODEL_CANDIDATES } from './_geminiPool.js';

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

  const { validKeys, rejectedCount } = inspectGeminiApiKeys();
  const keyCount = validKeys.length;
  const aiConfigured = keyCount > 0;

  res.statusCode = 200;
  res.end(
    JSON.stringify({
      ok: true,
      platform: 'vercel',
      aiConfigured,
      keyCount,
      rejectedKeyCount: rejectedCount,
      modelCount: MODEL_CANDIDATES.length,
    })
  );
}
