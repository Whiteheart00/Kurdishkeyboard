import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import {
  collectGeminiApiKeys,
  generateTextWithFailover,
  MODEL_CANDIDATES,
  streamTextWithFailover,
} from './api/_geminiPool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Allow cross-origin requests from the standalone Android APK WebView (https://localhost)
  app.use('/api', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.get('/api/health', (_req, res) => {
    const keys = collectGeminiApiKeys();
    res.json({
      ok: true,
      aiConfigured: keys.length > 0,
      keyCount: keys.length,
      modelCount: MODEL_CANDIDATES.length,
    });
  });

  app.get('/api/download-github-zip', (_req, res) => {
    try {
      const filesToPack: { name: string; data: Buffer }[] = [];

      const addFileIfExists = (relPath: string) => {
        const abs = path.join(__dirname, relPath);
        if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
          filesToPack.push({ name: relPath.replace(/\\/g, '/'), data: fs.readFileSync(abs) });
        }
      };

      const addDirRecursive = (relDir: string, filter?: (relFile: string) => boolean) => {
        const absDir = path.join(__dirname, relDir);
        if (!fs.existsSync(absDir)) return;
        for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
          const relChild = path.posix.join(relDir.replace(/\\/g, '/'), entry.name);
          if (entry.isDirectory()) {
            addDirRecursive(relChild, filter);
          } else if (entry.isFile()) {
            if (!filter || filter(relChild)) {
              filesToPack.push({
                name: relChild,
                data: fs.readFileSync(path.join(__dirname, relChild)),
              });
            }
          }
        }
      };

      // Root project & build config files
      for (const f of [
        'package.json',
        'tsconfig.json',
        'vite.config.ts',
        'index.html',
        'capacitor.config.json',
        'README.md',
        '.gitignore',
        '.env.example',
        'metadata.json',
        'server.ts',
        'vercel.json',
      ]) {
        addFileIfExists(f);
      }

      // GitHub Actions workflow, Vercel serverless API, Android IME Java overlay, build script & source code
      addDirRecursive('.github');
      addDirRecursive('api');
      addDirRecursive('android-ime');
      addDirRecursive('scripts');
      addDirRecursive('src');

      // Only include runtime public assets (logo + fx_* sound packs), skip raw 20MB upload archive
      addDirRecursive('public', (rel) => {
        if (rel.startsWith('public/assets/aistudio/')) {
          return path.basename(rel).startsWith('fx_');
        }
        return true;
      });

      // Pure-Node PKZIP (DEFLATE) builder with CRC32
      const crcTable = new Uint32Array(256);
      for (let i = 0; i < 256; i++) {
        let c = i;
        for (let k = 0; k < 8; k++) {
          c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        }
        crcTable[i] = c >>> 0;
      }
      const crc32 = (buf: Buffer): number => {
        let crc = 0xffffffff;
        for (let i = 0; i < buf.length; i++) {
          crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
        }
        return (crc ^ 0xffffffff) >>> 0;
      };

      const localParts: Buffer[] = [];
      const centralParts: Buffer[] = [];
      let offset = 0;

      for (const file of filesToPack) {
        const nameBuf = Buffer.from(file.name, 'utf8');
        const compressed = zlib.deflateRawSync(file.data, { level: 6 });
        const crc = crc32(file.data);

        const localHeader = Buffer.alloc(30);
        localHeader.writeUInt32LE(0x04034b50, 0);
        localHeader.writeUInt16LE(20, 4);
        localHeader.writeUInt16LE(0x0800, 6); // UTF-8 filename flag
        localHeader.writeUInt16LE(8, 8); // DEFLATE
        localHeader.writeUInt16LE(0, 10);
        localHeader.writeUInt16LE(0, 12);
        localHeader.writeUInt32LE(crc, 14);
        localHeader.writeUInt32LE(compressed.length, 18);
        localHeader.writeUInt32LE(file.data.length, 22);
        localHeader.writeUInt16LE(nameBuf.length, 26);
        localHeader.writeUInt16LE(0, 28);

        localParts.push(localHeader, nameBuf, compressed);

        const centralHeader = Buffer.alloc(46);
        centralHeader.writeUInt32LE(0x02014b50, 0);
        centralHeader.writeUInt16LE(20, 4);
        centralHeader.writeUInt16LE(20, 6);
        centralHeader.writeUInt16LE(0x0800, 8);
        centralHeader.writeUInt16LE(8, 10);
        centralHeader.writeUInt16LE(0, 12);
        centralHeader.writeUInt16LE(0, 14);
        centralHeader.writeUInt32LE(crc, 16);
        centralHeader.writeUInt32LE(compressed.length, 20);
        centralHeader.writeUInt32LE(file.data.length, 24);
        centralHeader.writeUInt16LE(nameBuf.length, 28);
        centralHeader.writeUInt16LE(0, 30);
        centralHeader.writeUInt16LE(0, 32);
        centralHeader.writeUInt16LE(0, 34);
        centralHeader.writeUInt16LE(0, 36);
        centralHeader.writeUInt32LE(0, 38);
        centralHeader.writeUInt32LE(offset, 42);

        centralParts.push(centralHeader, nameBuf);
        offset += localHeader.length + nameBuf.length + compressed.length;
      }

      const centralDir = Buffer.concat(centralParts);
      const eocd = Buffer.alloc(22);
      eocd.writeUInt32LE(0x06054b50, 0);
      eocd.writeUInt16LE(0, 4);
      eocd.writeUInt16LE(0, 6);
      eocd.writeUInt16LE(filesToPack.length, 8);
      eocd.writeUInt16LE(filesToPack.length, 10);
      eocd.writeUInt32LE(centralDir.length, 12);
      eocd.writeUInt32LE(offset, 16);
      eocd.writeUInt16LE(0, 20);

      const zipBuffer = Buffer.concat([...localParts, centralDir, eocd]);

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="kurdikeyboard-github-apk.zip"');
      res.setHeader('Content-Length', String(zipBuffer.length));
      res.send(zipBuffer);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'ZIP generation failed';
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/ai/translate', async (req, res) => {
    try {
      const { text, sourceLang, targetLang, engine, stream } = req.body as {
        text?: string;
        sourceLang?: string;
        targetLang?: string;
        engine?: 'google_fast' | 'ai_fluent';
        stream?: boolean;
      };

      if (!text || !text.trim()) {
        res.status(400).json({ error: 'تکایە دەقێک بنووسە بۆ وەرگێڕان.' });
        return;
      }

      if (collectGeminiApiKeys().length === 0) {
        res.status(503).json({
          error: 'کلیلی GEMINI_API_KEY لە ڕێکخستنی سێرڤەردا دیاری نەکراوە.',
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

      const src = langLabels[sourceLang || 'auto'] || sourceLang || 'Auto';
      const tgt = langLabels[targetLang || 'en'] || targetLang || 'English';
      const styleNote = engine === 'ai_fluent' ? 'Natural, fluent phrasing.' : 'Direct, accurate translation.';
      const systemInstruction = `Translate from ${src} to ${tgt}. ${styleNote} Output ONLY the translation.`;
      const cleanText = text.trim();
      const cacheKey = `tr::${src}::${tgt}::${engine || 'google_fast'}::${cleanText}`;

      if (stream === true) {
        await streamTextWithFailover({
          contents: cleanText,
          systemInstruction,
          cacheKey,
          onStart: () => {
            res.status(200);
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

      res.json({ translated });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'هەڵە لە کاتی وەرگێڕاندا ڕوویدا.';
      if (!res.headersSent) {
        res.status(500).json({ error: message });
      } else {
        res.end();
      }
    }
  });

  app.post('/api/ai/rewrite', async (req, res) => {
    try {
      const { text, mode, customPrompt, tone, stream } = req.body as {
        text?: string;
        mode?: string;
        customPrompt?: string;
        tone?: { style?: string; intent?: string; length?: string };
        stream?: boolean;
      };

      if (!text || !text.trim()) {
        res.status(400).json({ error: 'تکایە دەقێک بنووسە بۆ داڕشتنەوە.' });
        return;
      }

      if (collectGeminiApiKeys().length === 0) {
        res.status(503).json({
          error: 'کلیلی GEMINI_API_KEY لە ڕێکخستنی سێرڤەردا دیاری نەکراوە.',
        });
        return;
      }

      const cleanMode = mode || 'fix';
      const cleanCustom = typeof customPrompt === 'string' ? customPrompt.trim() : '';
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
        custom: cleanCustom
          ? `Follow this instruction carefully for the input text: ${cleanCustom}`
          : 'Improve clarity and natural flow in the exact same language.',
      };

      const instruction = modeInstructions[cleanMode] || modeInstructions.fix;
      const systemInstruction = `${instruction} Output ONLY the final text with no markdown fences, no quotation marks, and no commentary.`;
      const cleanText = text.trim();
      const cacheKey = `rw::${cleanMode}::${cleanCustom}::${JSON.stringify(tone || {})}::${cleanText}`;

      if (stream === true) {
        await streamTextWithFailover({
          contents: cleanText,
          systemInstruction,
          cacheKey,
          onStart: () => {
            res.status(200);
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

      res.json({ result });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'هەڵە لە کاتی پەیوەندی بە ژیری دەسکرددا ڕوویدا.';
      if (!res.headersSent) {
        res.status(500).json({ error: message });
      } else {
        res.end();
      }
    }
  });

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`KurdiKeyboard server listening on http://localhost:${PORT}`);
  });
}

startServer();
