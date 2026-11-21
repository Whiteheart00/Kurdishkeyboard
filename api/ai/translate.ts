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
    const sourceLangName = typeof body.sourceLangName === 'string' ? body.sourceLangName.trim() : '';
    const targetLangName = typeof body.targetLangName === 'string' ? body.targetLangName.trim() : '';
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
      auto: 'Auto-detect',
      ckb: 'Kurdish Sorani',
      ku: 'Kurdish Kurmanji',
      en: 'English',
      ar: 'Arabic',
      fa: 'Persian',
      tr: 'Turkish',
      de: 'German',
      fr: 'French',
      es: 'Spanish',
      it: 'Italian',
      ru: 'Russian',
      sv: 'Swedish',
      nl: 'Dutch',
      no: 'Norwegian',
      da: 'Danish',
      fi: 'Finnish',
      pt: 'Portuguese',
      pl: 'Polish',
      el: 'Greek',
      uk: 'Ukrainian',
      'zh-CN': 'Chinese (Simplified)',
      ja: 'Japanese',
      ko: 'Korean',
      hi: 'Hindi',
      ur: 'Urdu',
      az: 'Azerbaijani',
      hy: 'Armenian',
      ka: 'Georgian',
      he: 'Hebrew',
      id: 'Indonesian',
      ms: 'Malay',
      th: 'Thai',
      vi: 'Vietnamese',
      tl: 'Filipino',
      bn: 'Bengali',
      ps: 'Pashto',
      cs: 'Czech',
      ro: 'Romanian',
      hu: 'Hungarian',
      bg: 'Bulgarian',
      sr: 'Serbian',
      hr: 'Croatian',
      bs: 'Bosnian',
      sq: 'Albanian',
      sk: 'Slovak',
      sl: 'Slovenian',
      lt: 'Lithuanian',
      lv: 'Latvian',
      et: 'Estonian',
      ca: 'Catalan',
      sw: 'Swahili',
      am: 'Amharic',
      so: 'Somali',
      uz: 'Uzbek',
      kk: 'Kazakh',
      tg: 'Tajik',
      tk: 'Turkmen',
      pa: 'Punjabi',
      ta: 'Tamil',
      is: 'Icelandic',
      ga: 'Irish',
      af: 'Afrikaans',
    };

    const src = sourceLangName || langLabels[sourceLang] || sourceLang || 'Auto-detect';
    const tgt = targetLangName || langLabels[targetLang] || targetLang || 'English';
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
