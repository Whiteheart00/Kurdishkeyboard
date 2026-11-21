import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  collectGeminiApiKeys,
  generateTextWithFailover,
  streamTextWithFailover,
} from '../_geminiPool.js';

interface VercelRequest extends IncomingMessage {
  body?: unknown;
}

function setCors(res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function sendJson(res: ServerResponse, status: number, payload: unknown) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.statusCode = status;
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req: VercelRequest): Promise<Record<string, unknown>> {
  if (req.body && typeof req.body === 'object') {
    return req.body as Record<string, unknown>;
  }
  if (typeof req.body === 'string' && req.body.trim()) {
    return JSON.parse(req.body) as Record<string, unknown>;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  return JSON.parse(raw) as Record<string, unknown>;
}

export default async function handler(req: VercelRequest, res: ServerResponse) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const text = typeof body.text === 'string' ? body.text : '';
    const sourceLang = typeof body.sourceLang === 'string' ? body.sourceLang : 'auto';
    const targetLang = typeof body.targetLang === 'string' ? body.targetLang : 'en';
    const engine = body.engine === 'ai_fluent' ? 'ai_fluent' : 'google_fast';
    const wantStream = body.stream === true;

    if (!text.trim()) {
      sendJson(res, 400, { error: 'تکایە دەقێک بنووسە بۆ وەرگێڕان.' });
      return;
    }

    if (collectGeminiApiKeys().length === 0) {
      sendJson(res, 503, {
        error: 'کلیلی GEMINI_API_KEY لە ڕێکخستنی سێرڤەر (Vercel Environment Variables) دیاری نەکراوە.',
      });
      return;
    }

    const langLabels: Record<string, string> = {
      auto: 'Auto',
      ckb: 'Kurdish Sorani',
      en: 'English',
      ar: 'Arabic',
      fa: 'Persian',
      tr: 'Turkish',
    };

    const src = langLabels[sourceLang] || sourceLang || 'Auto';
    const tgt = langLabels[targetLang] || targetLang || 'English';
    const styleNote = engine === 'ai_fluent' ? 'Natural, fluent phrasing.' : 'Direct, accurate translation.';
    const systemInstruction = `Translate from ${src} to ${tgt}. ${styleNote} Output ONLY the translation.`;
    const cleanText = text.trim();
    const cacheKey = `tr::${src}::${tgt}::${engine}::${cleanText}`;

    if (wantStream) {
      await streamTextWithFailover({
        contents: cleanText,
        systemInstruction,
        cacheKey,
        onStart: () => {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.setHeader('Cache-Control', 'no-cache');
        },
        onChunk: (chunkText) => {
          res.write(chunkText);
        },
      });
      res.end();
      return;
    }

    const translated = await generateTextWithFailover({
      contents: cleanText,
      systemInstruction,
      cacheKey,
    });

    sendJson(res, 200, { translated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'هەڵە لە کاتی وەرگێڕاندا ڕوویدا.';
    if (!res.headersSent) {
      sendJson(res, 500, { error: message });
    } else {
      res.end();
    }
  }
}
