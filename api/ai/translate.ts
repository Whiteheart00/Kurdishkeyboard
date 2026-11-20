import type { IncomingMessage, ServerResponse } from 'node:http';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

interface VercelRequest extends IncomingMessage {
  body?: unknown;
}

function setCors(res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
}

function sendJson(res: ServerResponse, status: number, payload: unknown) {
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

    if (!text.trim()) {
      sendJson(res, 400, { error: 'تکایە دەقێک بنووسە بۆ وەرگێڕان.' });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      sendJson(res, 503, {
        error: 'کلیلی GEMINI_API_KEY لە ڕێکخستنی سێرڤەر (Vercel Environment Variables) دیاری نەکراوە.',
      });
      return;
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const langLabels: Record<string, string> = {
      auto: 'Auto-detect',
      ckb: 'Central Kurdish (Sorani, Arabic script)',
      en: 'English',
      ar: 'Arabic',
      fa: 'Persian',
      tr: 'Turkish',
    };

    const src = langLabels[sourceLang] || sourceLang || 'Auto-detect';
    const tgt = langLabels[targetLang] || targetLang || 'English';
    const styleNote =
      engine === 'ai_fluent'
        ? 'Produce a natural, idiomatic, fluent translation with proper Kurdish/target phrasing.'
        : 'Produce a direct, fast, accurate translation.';

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: text.trim(),
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        systemInstruction: `You are an expert Kurdish Sorani and multilingual keyboard translator.
Translate the user's text from ${src} into ${tgt}.
${styleNote}
Return ONLY the translated text without quotes, explanations, or markdown.`,
      },
    });

    const translated = (response.text ?? '').trim();
    sendJson(res, 200, { translated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'هەڵە لە کاتی وەرگێڕاندا ڕوویدا.';
    sendJson(res, 500, { error: message });
  }
}
