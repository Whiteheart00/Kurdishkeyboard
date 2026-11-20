/**
 * Offline Kurdish Sorani, Bahdini, Arabic & English Smart Writing Helper.
 * Runs locally inside the Android APK with zero server and zero API keys
 * when no private backend proxy is configured or when offline.
 */

export type SmartRewriteMode =
  | 'fix'
  | 'formal'
  | 'friendly'
  | 'shorten'
  | 'reply'
  | 'badini'
  | 'sorani'
  | 'poetic'
  | 'expand'
  | 'explain'
  | 'rephrase'
  | 'tone'
  | 'custom';

export interface ToneOptions {
  style?: 'casual' | 'professional' | 'academic';
  intent?: 'work' | 'email' | 'polite' | 'humor' | 'academic';
  length?: 'very_short' | 'short' | 'medium' | 'long' | 'detailed';
}

function detectLang(text: string): 'ckb' | 'ar' | 'en' {
  const hasKurdishSpecific = /[ەێۆڕڵڤچپژگ]/.test(text);
  if (hasKurdishSpecific) return 'ckb';
  const hasArabicScript = /[\u0600-\u06FF]/.test(text);
  if (hasArabicScript) {
    if (
      /(سڵاو|سلاڤ|چۆن|چەوا|باش|سوپاس|بەڵێ|نەخێر|دەست|تکایە|بۆ|لە|ئەم|ئەو|ئەز|من|تۆ|گەلەک|نوکە)/.test(
        text
      )
    ) {
      return 'ckb';
    }
    return 'ar';
  }
  return 'en';
}

function fixKurdishOrthography(input: string): string {
  let out = input.trim();
  // Normalize Arabic Yeh & Kaf to standard Kurdish Unicode
  out = out.replace(/ي/g, 'ی').replace(/ى/g, 'ی').replace(/ك/g, 'ک');
  // Normalize trailing Arabic Ha (ه) after letter when used as Kurdish Ae (ە)
  out = out.replace(/([\u0621-\u06FF])ه(?=\s|$|[،.؟!])/g, '$1ە');
  // Normalize Western comma/question mark inside Kurdish text to Kurdish punctuation
  out = out.replace(/,/g, '،').replace(/\?/g, '؟');
  // Collapse multiple spaces and clean spacing around punctuation
  out = out.replace(/[ \t]{2,}/g, ' ');
  out = out.replace(/\s+([،.؟!:;])/g, '$1');
  out = out.replace(/([،.؟!])([^\s\d،.؟!])/g, '$1 $2');
  // Fix common Kurdish spacing patterns
  out = out.replace(/(?<![\u0600-\u06FF])بۆچی\s+ە(?![\u0600-\u06FF])/g, 'بۆچییە');
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

// Unicode-safe Kurdish/Arabic letter-boundary replacer (excludes punctuation ، U+060C, ؛ U+061B, ؟ U+061F)
const KURDISH_LETTER = '\\u0621-\\u064A\\u066E-\\u06D5\\u06FA-\\u06FF\\u200C';

function replaceKurdishTokens(text: string, pairs: [string, string][]): string {
  let out = text;
  for (const [src, dst] of pairs) {
    const escaped = src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(`(?<![${KURDISH_LETTER}])${escaped}(?![${KURDISH_LETTER}])`, 'g');
    out = out.replace(rx, dst);
  }
  return out;
}

const SORANI_TO_BADINI_PHRASES: [string, string][] = [
  ['بەخێربێیت', 'ب خێر بێی'],
  ['بەخێربێن', 'ب خێر بێن'],
  ['زۆر سوپاس', 'گەلەک سوپاس'],
  ['لە کوێیت', 'تو ل کیڤەی'],
  ['لە کوێی', 'تو ل کیڤەی'],
  ['لە کوێ', 'ل کیڤە'],
  ['بۆ کوێ', 'بۆ کیڤە'],
  ['چۆنیت هاوڕێ', 'چەوانی هەڤال'],
  ['باشم سوپاس', 'ئەز باشم سوپاس'],
  ['خۆشم دەوێیت', 'حەز ژ تە دکەم'],
  ['خۆشم دەوێی', 'حەز ژ تە دکەم'],
  ['بیری تۆ دەکەم', 'ئەز ژ تە خەریبم'],
  ['بیرت دەکەم', 'ئەز ژ تە خەریبم'],
  ['چاوەڕێم', 'ئەز ل هیڤیێ مە'],
  ['چاوەڕوانم', 'ئەز ل هیڤیێ مە'],
  ['بە دڵنیاییەوە', 'ب پشتڕاستی ڤە'],
  ['هیچ کێشە نییە', 'چو ئاریشە نینە'],
  ['کێشە نییە', 'ئاریشە نینە'],
  ['بەیانیت باش', 'سپێدە باش'],
  ['بەیانی باش', 'سپێدە باش'],
  ['ئێوارەت باش', 'ئێڤار باش'],
  ['ئێوارە باش', 'ئێڤار باش'],
  ['شەوت شاد', 'شەڤ باش'],
  ['شەو شاد', 'شەڤ باش'],
  ['ڕۆژت باش', 'رۆژ باش'],
  ['بە هیوای', 'ب هیڤیا'],
  ['بە بۆنەی', 'ب هەلکەفتا'],
  ['لە کاتی', 'د دەمێ'],
  ['بە شێوەیەکی', 'ب شێوەیەکێ'],
  ['بە باشی', 'ب باشی'],
  ['هەر ئێستا', 'هەر نوکە'],
  ['پاش کەمێکی تر', 'پشتی بێهنەکا دی'],
  ['کەمێکی تر', 'بێهنەکا دی'],
  ['نازانم چۆن', 'نزانم چەوا'],
  ['دەمەوێت بڵێم', 'من دڤێت بێژم'],
  ['پێویستم بە', 'من پێتڤی ب'],
  ['ماندوو نەبیت', 'ماندێ نەبی'],
  ['سەرکەوتوو بیت', 'سەرکەفتی بی'],
  ['دەستەکانت خۆش بێت', 'دەستێن تە خوش بن'],
  ['دەستت خۆش بێت', 'دەستێن تە خوش بن'],
  ['دەستخۆش', 'دەست خوش'],
];

const SORANI_TO_BADINI_WORDS: [string, string][] = [
  ['سڵاو', 'سلاڤ'],
  ['چۆنیت', 'چەوانی'],
  ['چۆنی', 'چەوانی'],
  ['چۆنن', 'هوین چەوانن'],
  ['چۆن', 'چەوا'],
  ['باشم', 'ئەز باشم'],
  ['باشیت', 'تو باشی'],
  ['باشی', 'تو باشی'],
  ['باشن', 'هوین باشن'],
  ['زۆر', 'گەلەک'],
  ['ئێستا', 'نوکە'],
  ['ئەمڕۆ', 'ئەڤرۆ'],
  ['دوێنێ', 'دوهی'],
  ['بەیانی', 'سوبەهی'],
  ['شەو', 'شەڤ'],
  ['ڕۆژ', 'رۆژ'],
  ['ئێوارە', 'ئێڤار'],
  ['بۆچی', 'بۆچ'],
  ['بۆچییە', 'بۆچی یە'],
  ['کەی', 'کەنگی'],
  ['کێ', 'کی'],
  ['چی', 'چ'],
  ['چییە', 'چییە'],
  ['لەگەڵ', 'دگەل'],
  ['لە', 'ل'],
  ['بەڵام', 'لێ'],
  ['چونکە', 'چونکی'],
  ['هەموو', 'هەمی'],
  ['هیچ', 'چو'],
  ['ئەمە', 'ئەڤە'],
  ['ئەم', 'ئەڤ'],
  ['ئەوە', 'ئەو'],
  ['ئێمە', 'ئەم'],
  ['ئێوە', 'هوین'],
  ['تۆ', 'تو'],
  ['من', 'ئەز'],
  ['هاوڕێ', 'هەڤال'],
  ['هاوڕێم', 'هەڤالێ من'],
  ['هاوڕێیان', 'هەڤالان'],
  ['برا', 'برا'],
  ['کێشە', 'ئاریشە'],
  ['وەڵام', 'بەرسڤ'],
  ['پرسیار', 'پسیار'],
  ['قسە', 'ئاخفتن'],
  ['منداڵ', 'زارۆک'],
  ['منداڵەکان', 'زارۆک'],
  ['خۆشەویست', 'خۆشتڤی'],
  ['دڵ', 'دل'],
  ['دڵم', 'دلێ من'],
  ['ماڵەوە', 'مال'],
  ['ماڵ', 'مال'],
  ['گەورە', 'مەزن'],
  ['بچووک', 'بچویک'],
  ['تازە', 'نوو'],
  ['نوێ', 'نوو'],
  ['کۆن', 'کەڤن'],
  ['جوان', 'جوان'],
  ['خۆش', 'خوش'],
  ['دەمەوێت', 'من دڤێت'],
  ['نامەوێت', 'من نەڤێت'],
  ['دەتەوێت', 'تە دڤێت'],
  ['دەزانم', 'ئەز دزانم'],
  ['نازانم', 'ئەز نزانم'],
  ['دەزانیت', 'تو دزانی'],
  ['دەڵێم', 'ئەز دبێژم'],
  ['دەڵێیت', 'تو دبێژی'],
  ['دەڵێت', 'دبێژیت'],
  ['دەتوانم', 'ئەز دشێم'],
  ['ناتوانم', 'ئەز نەشێم'],
  ['دەتوانیت', 'تو دشێی'],
  ['دەکەم', 'دکەم'],
  ['دەکەیت', 'دکەی'],
  ['دەکات', 'دکەت'],
  ['دەچم', 'دچم'],
  ['دەچیت', 'دچی'],
  ['دێت', 'دهێت'],
  ['دێم', 'دهێم'],
  ['دەبینم', 'دبینم'],
  ['دەنووسم', 'دنڤیسم'],
  ['دەخوێنم', 'دخوینم'],
  ['دەدەم', 'ددەم'],
  ['نییە', 'نینە'],
  ['هەیە', 'هەیە'],
  ['بێت', 'بیت'],
  ['پێویست', 'پێتڤی'],
  ['پێویستە', 'پێتڤی یە'],
  ['هیوادارم', 'هیڤیدارم'],
  ['ئومێدەوارم', 'هیڤیدارم'],
  ['تکایە', 'هیڤیدارم'],
  ['ببوورە', 'ل من ببوورە'],
  ['کار', 'شول'],
  ['چاک', 'باش'],
  ['ئاسان', 'ب ساناهی'],
  ['قورس', 'ب زەحمەت'],
  ['گرنگ', 'گرنگ'],
  ['ئەنجام', 'ئەنجام'],
  ['زانیاری', 'پێزانین'],
  ['پەیوەندی', 'پەیوەندی'],
  ['نامە', 'نامە'],
  ['تەختەکلیل', 'کیبۆرد'],
];

const BADINI_TO_SORANI_PHRASES: [string, string][] = [
  ['ب خێر بێی', 'بەخێربێیت'],
  ['ب خێر بێن', 'بەخێربێن'],
  ['گەلەک سوپاس', 'زۆر سوپاس'],
  ['ل کیڤە', 'لە کوێ'],
  ['بۆ کیڤە', 'بۆ کوێ'],
  ['ئەز باشم', 'باشم'],
  ['حەز ژ تە دکەم', 'خۆشم دەوێیت'],
  ['ئەز ژ تە خەریبم', 'بیرت دەکەم'],
  ['چو ئاریشە نینە', 'هیچ کێشە نییە'],
  ['ئاریشە نینە', 'کێشە نییە'],
  ['سپێدە باش', 'بەیانی باش'],
  ['ئێڤار باش', 'ئێوارە باش'],
  ['شەڤ باش', 'شەو شاد'],
  ['من دڤێت', 'دەمەوێت'],
  ['من نەڤێت', 'نامەوێت'],
  ['تە دڤێت', 'دەتەوێت'],
  ['ل من ببوورە', 'ببوورە'],
  ['دەست خوش', 'دەستخۆش'],
  ['ب ساناهی', 'بە ئاسانی'],
  ['ب زەحمەت', 'بە زەحمەت'],
];

const BADINI_TO_SORANI_WORDS: [string, string][] = [
  ['سلاڤ', 'سڵاو'],
  ['چەوانی', 'چۆنیت'],
  ['چەوای', 'چۆنیت'],
  ['چەوا', 'چۆن'],
  ['گەلەک', 'زۆر'],
  ['نوکە', 'ئێستا'],
  ['ئەڤرۆ', 'ئەمڕۆ'],
  ['دوهی', 'دوێنێ'],
  ['سوبەهی', 'بەیانی'],
  ['شەڤ', 'شەو'],
  ['ئێڤار', 'ئێوارە'],
  ['بۆچ', 'بۆچی'],
  ['کەنگی', 'کەی'],
  ['دگەل', 'لەگەڵ'],
  ['ل', 'لە'],
  ['لێ', 'بەڵام'],
  ['چونکی', 'چونکە'],
  ['هەمی', 'هەموو'],
  ['چو', 'هیچ'],
  ['ئەڤە', 'ئەمە'],
  ['ئەڤ', 'ئەم'],
  ['ئەم', 'ئێمە'],
  ['هوین', 'ئێوە'],
  ['ئەز', 'من'],
  ['تو', 'تۆ'],
  ['هەڤال', 'هاوڕێ'],
  ['ئاریشە', 'کێشە'],
  ['بەرسڤ', 'وەڵام'],
  ['پسیار', 'پرسیار'],
  ['ئاخفتن', 'قسە'],
  ['زارۆک', 'منداڵ'],
  ['خۆشتڤی', 'خۆشەویست'],
  ['مەزن', 'گەورە'],
  ['بچویک', 'بچووک'],
  ['کەڤن', 'کۆن'],
  ['دزانم', 'دەزانم'],
  ['نزانم', 'نازانم'],
  ['دبێژم', 'دەڵێم'],
  ['دبێژیت', 'دەڵێت'],
  ['دشێم', 'دەتوانم'],
  ['نەشێم', 'ناتوانم'],
  ['دکەم', 'دەکەم'],
  ['دکەت', 'دەکات'],
  ['دچم', 'دەچم'],
  ['دهێم', 'دێم'],
  ['دهێت', 'دێت'],
  ['دنڤیسم', 'دەنووسم'],
  ['نینە', 'نییە'],
  ['پێتڤی', 'پێویست'],
  ['هیڤیدارم', 'هیوادارم'],
  ['پێزانین', 'زانیاری'],
  ['شول', 'کار'],
];

function convertSoraniToBadiniOffline(input: string): string {
  let out = fixKurdishOrthography(input);
  out = replaceKurdishTokens(out, SORANI_TO_BADINI_PHRASES);
  out = replaceKurdishTokens(out, SORANI_TO_BADINI_WORDS);
  // Convert remaining Sorani present-tense prefix "دە" on verbs (length >= 4) to Bahdini "د"
  out = out.replace(/(?<![\u0600-\u06FF])دە([\u0621-\u06FF]{3,})/g, (full, rest: string) => {
    // Preserve nouns starting with دە like دەست، دەرگا، دەنگ، دەم، دەق، دەرد
    if (/^(ست|رگا|نگ|م|ق|رد|رس|ری|وڵ|ور|شت|فت|رمان|فە|رەج)/.test(rest)) {
      return full;
    }
    return `د${rest}`;
  });
  return out.trim();
}

function convertBadiniToSoraniOffline(input: string): string {
  let out = fixKurdishOrthography(input);
  out = replaceKurdishTokens(out, BADINI_TO_SORANI_PHRASES);
  out = replaceKurdishTokens(out, BADINI_TO_SORANI_WORDS);
  return out.trim();
}

function makePoeticOffline(input: string, lang: 'ckb' | 'ar' | 'en'): string {
  const fixed = fixGeneralText(input, lang);
  if (lang === 'ckb') {
    const core = fixed.replace(/[.!؟،]+$/, '').trim();
    if (/(سڵاو|بەیانی|ئێوارە|شەو)/.test(core)) {
      return `${core}؛ وەک شنەبای بەیانی و تیشکی خۆر، دڵت پڕ بێت لە ئارامی و ڕووناکی.`;
    }
    if (/(خۆش|دڵ|عەشق|ئەوین|بیر|چاو|گیان)/.test(core)) {
      return `${core} — وەک چرپەی باران لەسەر گەڵای پایز، هەمیشە لە قووڵایی دڵمدا دەدرەوشێتەوە.`;
    }
    if (/(سوپاس|دەستخۆش|ماندوو|ڕێز)/.test(core)) {
      return `${core}؛ میهرەبانیت وەک گوڵێکی پڕ بۆنە کە جوانی بە هەموو ساتەکان دەبەخشێت.`;
    }
    return `وەک تیشکێکی هێمن لە ئاسمانی هەستدا:\n«${core}»\nدەنگی وشەکان بە نەرمی و جوانی دەگاتە دڵ.`;
  }
  if (lang === 'ar') {
    const core = fixed.replace(/[.!؟،]+$/, '').trim();
    return `كهمسِ نسيمٍ عذبٍ يلامس الروح:\n«${core}»\nكلماتٌ تنبض بالدفء والجمال.`;
  }
  const core = fixed.replace(/[.!?]+$/, '').trim();
  return `Like quiet light woven through golden dusk:\n"${core}" — words carried on grace and warmth.`;
}

function expandOffline(input: string, lang: 'ckb' | 'ar' | 'en'): string {
  const fixed = fixGeneralText(input, lang);
  if (lang === 'ckb') {
    const ended = /[.؟!]$/.test(fixed) ? fixed : `${fixed}.`;
    if (/[؟?]$/.test(fixed) || /(چۆن|کەی|چەند|لە کوێ|بۆچی|دەکرێت)/.test(fixed)) {
      return `${ended} ئەگەر دەکرێت کەمێک وردەکاری زیاترمان پێ بدەیت تا بتوانین بە باشترین شێوە وەڵامت بدەینەوە و هاوکاریت بکەین.`;
    }
    if (/(سڵاو|بەیانی|ئێوارە)/.test(fixed)) {
      return `${ended} هیوادارم تەندروستیت باش بێت و ڕۆژێکی پڕ لە ئارامی و سەرکەوتنت هەبێت؛ هەر شتێکت پێویست بوو لە خزمەتدام.`;
    }
    if (/(سوپاس|دەستخۆش)/.test(fixed)) {
      return `${ended} بەڕاستی هەوڵ و هاوکارییەکەت جێی ڕێز و پێزانینی زۆرە، هیوای سەرکەوتن و تەندروستی باشت بۆ دەخوازم.`;
    }
    return `${ended} مەبەستم ئەوەیە ئەم بابەتە بە ڕوونی و وردی باس بکەم بۆ ئەوەی هەموو لایەنەکانی دیار بێت و هیچ تێنەگەیشتنێک دروست نەبێت.`;
  }
  if (lang === 'ar') {
    const ended = /[.؟!]$/.test(fixed) ? fixed : `${fixed}.`;
    return `${ended} أردت توضيح هذه النقطة بشكلٍ كامل ومفصل حتى تكون الصورة واضحة تماماً، ويسعدني مشاركة أي تفاصيل إضافية عند الحاجة.`;
  }
  const ended = /[.!?]$/.test(fixed) ? fixed : `${fixed}.`;
  return `${ended} I wanted to share this clearly with full context so everything is easy to follow, and please let me know if you need any further details.`;
}

export function runOfflineSmartRewrite(
  text: string,
  mode: SmartRewriteMode,
  tone?: ToneOptions
): string {
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

    case 'badini':
      return convertSoraniToBadiniOffline(clean);

    case 'sorani':
      return convertBadiniToSoraniOffline(clean);

    case 'poetic':
      return makePoeticOffline(clean, lang);

    case 'expand':
      return expandOffline(clean, lang);

    case 'rephrase': {
      const fixed = fixGeneralText(clean, lang);
      if (lang === 'ckb') {
        return fixed
          .replace(/(?<![\u0600-\u06FF])بەڵام(?![\u0600-\u06FF])/g, 'لەگەڵ ئەوەشدا')
          .replace(/(?<![\u0600-\u06FF])زۆر(?![\u0600-\u06FF])/g, 'بە ڕادەیەکی زۆر');
      }
      return fixed;
    }

    case 'explain': {
      const fixed = fixGeneralText(clean, lang);
      if (lang === 'ckb') {
        return `ڕوونکردنەوەی «${fixed}»: ئەم دەستەواژەیە بە مەبەستی دەربڕینی بیرۆکەکە بە شێوەیەکی سادە و ڕوون بەکاردێت. (بۆ شیکردنەوەی وردتر سێرڤەری AI چالاک بکە).`;
      }
      if (lang === 'ar') {
        return `توضيح «${fixed}»: عبارة تُستخدم للتعبير عن المعنى المقصود بوضوح.`;
      }
      return `Explanation of "${fixed}": expresses the intended idea clearly in context.`;
    }

    case 'tone': {
      if (tone?.length === 'very_short' || tone?.length === 'short') {
        return runOfflineSmartRewrite(clean, 'shorten');
      }
      if (tone?.length === 'long' || tone?.length === 'detailed') {
        return runOfflineSmartRewrite(clean, 'expand');
      }
      if (tone?.style === 'professional' || tone?.style === 'academic' || tone?.intent === 'email') {
        return runOfflineSmartRewrite(clean, 'formal');
      }
      if (tone?.intent === 'humor' || tone?.style === 'casual') {
        return runOfflineSmartRewrite(clean, 'friendly');
      }
      return fixGeneralText(clean, lang);
    }

    case 'custom':
      return fixGeneralText(clean, lang);

    case 'reply': {
      const lower = clean.toLowerCase();
      if (lang === 'ckb') {
        if (/(سڵاو|سلاڤ|الس|مەرحەبا|بەیانی|ئێوارە)/.test(clean)) {
          return 'وعلیکم السلام، سڵاو و ڕێز! سوپاس بۆ هەواڵپرسیت، باشم تۆ چۆنیت؟';
        }
        if (/(چۆنیت|چۆنی|چەوانی|باشی|هەواڵت)/.test(clean)) {
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
