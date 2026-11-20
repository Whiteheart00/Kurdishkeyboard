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
    const mode = typeof body.mode === 'string' ? body.mode : 'fix';

    if (!text.trim()) {
      sendJson(res, 400, { error: 'تکایە دەقێک بنووسە بۆ داڕشتنەوە.' });
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

    const modeInstructions: Record<string, string> = {
      fix: 'Fix spelling, grammar, and punctuation while preserving the original language (Kurdish Sorani, English, or Arabic) and meaning. Keep it clean and natural.',
      formal: 'Rewrite the text in a polite, professional, formal tone in the same language as the input.',
      friendly: 'Rewrite the text in a warm, friendly, conversational tone in the same language as the input.',
      shorten: 'Make the text concise and clear while preserving the core message, in the same language as the input.',
      reply: 'Write a natural, helpful, polite short reply to the message in the exact same language as the input (e.g., Kurdish Sorani if input is Kurdish Sorani).',
    };

    const instruction = modeInstructions[mode] || modeInstructions.fix;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: text.trim(),
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        systemInstruction: `You are an intelligent Kurdish & multilingual mobile keyboard writing assistant.
${instruction}
Return ONLY the resulting text with no preamble, quotes, or extra commentary.`,
      },
    });

    const result = (response.text ?? '').trim();
    sendJson(res, 200, { result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'هەڵە لە کاتی پەیوەندی بە ژیری دەسکرددا ڕوویدا.';
    sendJson(res, 500, { error: message });
  }
}
