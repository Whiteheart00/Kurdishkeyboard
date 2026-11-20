import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

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
    res.json({ ok: true, aiConfigured: Boolean(getGeminiClient()) });
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

      const ai = getGeminiClient();
      if (!ai) {
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

      if (stream === true) {
        res.status(200);
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        const chunkStream = await ai.models.generateContentStream({
          model: 'gemini-3.1-flash-lite',
          contents: text.trim(),
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
            systemInstruction,
          },
        });
        for await (const chunk of chunkStream) {
          if (chunk.text) res.write(chunk.text);
        }
        res.end();
        return;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: text.trim(),
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
          systemInstruction,
        },
      });

      const translated = (response.text ?? '').trim();
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
      const { text, mode, stream } = req.body as {
        text?: string;
        mode?: 'fix' | 'formal' | 'friendly' | 'shorten' | 'reply';
        stream?: boolean;
      };

      if (!text || !text.trim()) {
        res.status(400).json({ error: 'تکایە دەقێک بنووسە بۆ داڕشتنەوە.' });
        return;
      }

      const ai = getGeminiClient();
      if (!ai) {
        res.status(503).json({
          error: 'کلیلی GEMINI_API_KEY لە ڕێکخستنی سێرڤەردا دیاری نەکراوە.',
        });
        return;
      }

      const modeInstructions: Record<string, string> = {
        fix: 'Fix spelling, grammar, and punctuation in the same language (Kurdish Sorani, English, or Arabic).',
        formal: 'Rewrite in a polite, formal tone in the same language.',
        friendly: 'Rewrite in a warm, friendly tone in the same language.',
        shorten: 'Make concise and clear in the same language.',
        reply: 'Write a brief, natural polite reply in the same language.',
      };

      const instruction = modeInstructions[mode || 'fix'] || modeInstructions.fix;
      const systemInstruction = `${instruction} Output ONLY the final text with no quotes or notes.`;

      if (stream === true) {
        res.status(200);
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        const chunkStream = await ai.models.generateContentStream({
          model: 'gemini-3.1-flash-lite',
          contents: text.trim(),
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
            systemInstruction,
          },
        });
        for await (const chunk of chunkStream) {
          if (chunk.text) res.write(chunk.text);
        }
        res.end();
        return;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: text.trim(),
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
          systemInstruction,
        },
      });

      const result = (response.text ?? '').trim();
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
