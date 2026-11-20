/**
 * Offline Kurdish Sorani, Arabic & English Smart Writing Helper.
 * Runs locally inside the Android APK with zero server and zero API keys
 * when no private backend proxy (VITE_API_BASE_URL) is configured.
 */

export type SmartRewriteMode = 'fix' | 'formal' | 'friendly' | 'shorten' | 'reply';

function detectLang(text: string): 'ckb' | 'ar' | 'en' {
  const hasKurdishSpecific = /[ەێۆڕڵڤچپژگ]/.test(text);
  if (hasKurdishSpecific) return 'ckb';
  const hasArabicScript = /[\u0600-\u06FF]/.test(text);
  if (hasArabicScript) {
    if (/(سڵاو|چۆن|باش|سوپاس|بەڵێ|نەخێر|دەست|تکایە|بۆ|لە|ئەم|ئەو|من|تۆ)/.test(text)) {
      return 'ckb';
    }
    return 'ar';
  }
  return 'en';
}

function fixKurdishOrthography(input: string): string {
  let out = input.trim();
  // Normalize Arabic Yeh & Kaf to standard Kurdish Sorani Unicode
  out = out.replace(/ي/g, 'ی').replace(/ى/g, 'ی').replace(/ك/g, 'ک');
  // Normalize trailing Arabic Ha (ه) after consonant/vowel when used as Kurdish Ae (ە)
  out = out.replace(/([\u0621-\u06FF])ه(?=\s|$|[،.؟!])/g, '$1ە');
  // Normalize Western comma/question mark inside Kurdish text to Kurdish punctuation
  out = out.replace(/,/g, '،').replace(/\?/g, '؟');
  // Collapse multiple spaces and clean spacing around punctuation
  out = out.replace(/[ \t]{2,}/g, ' ');
  out = out.replace(/\s+([،.؟!:;])/g, '$1');
  out = out.replace(/([،.؟!])([^\s\d،.؟!])/g, '$1 $2');
  // Fix common Kurdish spacing patterns
  out = out.replace(/\bبۆچی\s+ە/g, 'بۆچییە');
  return out.trim();
}

function fixGeneralText(input: string, lang: 'ckb' | 'ar' | 'en'): string {
  if (lang === 'ckb') return fixKurdishOrthography(input);
  let out = input.trim().replace(/[ \t]{2,}/g, ' ');
  out = out.replace(/\s+([,.?!،؟])/g, '$1');
  out = out.replace(/([,.?!،؟])([^\s\d,.?!،؟])/g, '$1 $2');
  if (lang === 'en' && out.length > 0) {
    out = out[0].toUpperCase() + out.slice(1);
    if (!/[.!?]$/.test(out)) out += '.';
  }
  return out;
}

export function runOfflineSmartRewrite(text: string, mode: SmartRewriteMode): string {
  const clean = text.trim();
  if (!clean) return '';
  const lang = detectLang(clean);

  switch (mode) {
    case 'fix':
      return fixGeneralText(clean, lang);

    case 'formal': {
      const fixed = fixGeneralText(clean, lang);
      if (lang === 'ckb') {
        const body = fixed.replace(/^(سڵاو|هەلاو|چۆنی|سڵاو هاوڕێ)[،,\s!؟]*/i, '').trim() || fixed;
        const ended = /[.؟!]$/.test(body) ? body : `${body}.`;
        return `سڵاو و ڕێز، ${ended} لەگەڵ ڕێز و سوپاسدا.`;
      }
      if (lang === 'ar') {
        const ended = /[.؟!]$/.test(fixed) ? fixed : `${fixed}.`;
        return `تحية طيبة وبعد، ${ended} مع خالص التقدير.`;
      }
      return `Hello, ${fixed} Best regards.`;
    }

    case 'friendly': {
      const fixed = fixGeneralText(clean, lang);
      if (lang === 'ckb') {
        const hasGreeting = /^(سڵاو|چۆنیت|برا|هاوڕێ)/.test(fixed);
        return hasGreeting ? `${fixed} 😊` : `سڵاو هاوڕێ گیان، ${fixed} 😊`;
      }
      if (lang === 'ar') {
        return `أهلاً صديقي، ${fixed} 😊`;
      }
      return `Hey there! ${fixed} 😊`;
    }

    case 'shorten': {
      const fixed = fixGeneralText(clean, lang);
      const sentences = fixed.split(/(?<=[.؟!])\s+/).filter(Boolean);
      if (sentences.length > 1) {
        return sentences[0].trim();
      }
      const words = fixed.split(/\s+/);
      if (words.length > 10) {
        return `${words.slice(0, Math.ceil(words.length * 0.65)).join(' ')}...`;
      }
      return fixed;
    }

    case 'reply': {
      const lower = clean.toLowerCase();
      if (lang === 'ckb') {
        if (/(سڵاو|الس|مەرحەبا|بەیانی|ئێوارە)/.test(clean)) {
          return 'وعلیکم السلام، سڵاو و ڕێز! سوپاس بۆ هەواڵپرسیت، باشم تۆ چۆنیت؟';
        }
        if (/(چۆنیت|چۆنی|باشی|هەواڵت)/.test(clean)) {
          return 'سوپاس بۆ خوا باشم، هیوادارم تۆش باش و سەلامەت بیت.';
        }
        if (/(سوپاس|دەستخۆش|مەمنون|خودا پاداشتت)/.test(clean)) {
          return 'شایەنی نییە، هەرکاتێک پێویستت بە هاوکاری بوو لە خزمەتدام.';
        }
        if (/(ببوورە|داوای لێبوردن)/.test(clean)) {
          return 'هیچ کێشە نییە، ئاساییە هاوڕێ گیان.';
        }
        if (/[؟?]/.test(clean) || /(کەی|چەند|لە کوێ|بۆچی|دەکرێت)/.test(clean)) {
          return 'بەڵێ بە دڵنیاییەوە، ئێستا پشکنینی بۆ دەکەم و زانیاری تەواوت بۆ دەنێرم.';
        }
        return 'زۆر باشە، نامەکەت گەیشت و سوپاس بۆ ئاگادارکردنەوەکەت.';
      }
      if (lang === 'ar') {
        if (/(سلام|أهلا|مرحبا|صباح|مساء)/.test(clean)) {
          return 'وعليكم السلام ورحمة الله، أهلاً بك! كيف يمكنني مساعدتك؟';
        }
        if (/(شكرا|مشكور|يعطيك)/.test(clean)) {
          return 'العفو، يسعدني دائماً مساعدتك.';
        }
        return 'تم استلام رسالتك بنجاح، شكراً لتواصلك.';
      }
      if (/(hello|hi|hey|good morning|good evening)/.test(lower)) {
        return 'Hello! Hope you are doing well. How can I help you?';
      }
      if (/(thank|thx|appreciate)/.test(lower)) {
        return "You're very welcome! Happy to help anytime.";
      }
      if (lower.includes('?')) {
        return 'Sure, let me check and get back to you shortly.';
      }
      return 'Got it, thank you for letting me know!';
    }
  }
}
