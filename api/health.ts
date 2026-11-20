import type { IncomingMessage, ServerResponse } from 'node:http';

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

  const apiKey = process.env.GEMINI_API_KEY;
  const aiConfigured = Boolean(apiKey && apiKey !== 'MY_GEMINI_API_KEY');

  res.statusCode = 200;
  res.end(
    JSON.stringify({
      ok: true,
      platform: 'vercel',
      aiConfigured,
    })
  );
}
