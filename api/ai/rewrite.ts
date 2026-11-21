import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  collectGeminiApiKeys,
  generateTextWithFailover,
  streamTextWithFailover,
} from '../_geminiPool';

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

function buildRewriteSystemInstruction(
  mode: string,
  customPrompt: string,
  tone?: { style?: string; intent?: string; length?: string }
): string {
  const modeInstructions: Record<string, string> = {
    fix: 'Fix spelling, grammar, Kurdish/Arabic Unicode orthography (ی، ک، ە), and punctuation in the exact same language without changing meaning.',
    formal: 'Rewrite in a polite, respectful, formal tone in the exact same language.',
    friendly: 'Rewrite in a warm, natural, friendly conversational tone in the exact same language.',
    shorten: 'Summarize and make the text much more concise and punchy while keeping core meaning, in the exact same language.',
    reply: 'Write a brief, natural, polite reply to this message in the exact same language.',
    badini: [
      'You are an expert native speaker of Bahdini Kurdish (Duhok & Zakho Kurmanji written in Kurdish Arabic script).',
      'Translate and convert the entire input cleanly into 100% authentic, natural Bahdini Kurdish in Kurdish Arabic script.',
      'Use authentic Bahdini pronouns, vocabulary, and verb forms (e.g., ئەز، تو، ئەم، هوین، ئەڤە، ئەڤرۆ، نوکە، گەلەک، چەوانی، هەڤال، دگەل، ل، لێ، چونکی، هەمی، چو، ئاریشە، بەرسڤ، پسیار، دڤێت، دبێژم، دکەم، دچم، دشێم، نەشێم، نینە).',
      'Do NOT leave Sorani vocabulary or Sorani verb prefixes (دە-) or Sorani clitics untouched. Ensure the output sounds completely natural to a native Duhok/Zakho speaker.',
    ].join(' '),
    sorani: [
      'You are an expert native speaker of Central Kurdish (Sorani in standard Kurdish Arabic script).',
      'Translate and convert the entire input cleanly into 100% authentic, natural Sorani Kurdish (e.g., سڵاو، چۆنیت، زۆر، ئێستا، ئەمڕۆ، هاوڕێ، لەگەڵ، لە، بەڵام، چونکە، هەموو، کێشە، وەڵام، دەمەوێت، دەڵێم، دەکەم، دەتوانم، ناتوانم، نییە).',
      'Ensure clean standard Sorani orthography (ی، ک، ە، ڕ، ڵ، ۆ، ێ).',
    ].join(' '),
    poetic: [
      'Transform the input into genuinely vivid, deeply poetic and lyrical writing in the exact same language.',
      'If the input is Kurdish, write evocative Kurdish literary poetry or lyrical poetic prose (2 to 4 flowing lines with rich metaphor, emotion, rhythm, and musical Kurdish vocabulary — like classic/modern Kurdish poets).',
      'Do NOT merely copy the input with a plain prefix; genuinely re-imagine the message poetically while keeping its heart and meaning.',
    ].join(' '),
    expand: [
      'Genuinely expand and elaborate the input into a rich, well-structured, natural 2 to 4 sentence message in the exact same language.',
      'Add helpful context, natural flow, and clear detail that deepens the original idea while staying faithful to the sender’s intent.',
      'Do NOT just repeat the input with a single generic closing phrase; make the expanded text noticeably fuller, smoother, and genuinely useful.',
    ].join(' '),
    explain: 'Explain the meaning and usage of this text clearly and simply in 1–3 concise sentences in Kurdish Sorani (or the same language if English/Arabic).',
    rephrase: 'Rephrase this text with fresh, smoother, more natural wording while preserving the exact same meaning and language.',
    tone: `Rewrite the text in the exact same language with these parameters: Style=${tone?.style || 'casual'}, Intent=${tone?.intent || 'polite'}, Length=${tone?.length || 'medium'}. Preserve facts and meaning.`,
    custom: customPrompt
      ? `Follow this instruction carefully for the input text: ${customPrompt}`
      : 'Improve clarity and natural flow in the exact same language.',
  };

  const instruction = modeInstructions[mode] || modeInstructions.fix;
  return `${instruction} Output ONLY the final text with no markdown fences, no quotation marks, and no commentary.`;
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
    const customPrompt = typeof body.customPrompt === 'string' ? body.customPrompt.trim() : '';
    const tone =
      body.tone && typeof body.tone === 'object'
        ? (body.tone as { style?: string; intent?: string; length?: string })
        : undefined;
    const wantStream = body.stream === true;

    if (!text.trim()) {
      sendJson(res, 400, { error: 'تکایە دەقێک بنووسە بۆ داڕشتنەوە.' });
      return;
    }

    if (collectGeminiApiKeys().length === 0) {
      sendJson(res, 503, {
        error: 'کلیلی GEMINI_API_KEY لە ڕێکخستنی سێرڤەر (Vercel Environment Variables) دیاری نەکراوە.',
      });
      return;
    }

    const systemInstruction = buildRewriteSystemInstruction(mode, customPrompt, tone);
    const cleanText = text.trim();
    const cacheKey = `rw::${mode}::${customPrompt}::${JSON.stringify(tone || {})}::${cleanText}`;

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

    const result = await generateTextWithFailover({
      contents: cleanText,
      systemInstruction,
      cacheKey,
    });

    sendJson(res, 200, { result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'هەڵە لە کاتی پەیوەندی بە ژیری دەسکرددا ڕوویدا.';
    if (!res.headersSent) {
      sendJson(res, 500, { error: message });
    } else {
      res.end();
    }
  }
}
