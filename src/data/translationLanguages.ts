export interface TranslationLanguage {
  code: string;
  label: string;
  shortLabel: string;
  native: string;
  english: string;
}

export const AUTO_DETECT_LANG: TranslationLanguage = {
  code: 'auto',
  label: 'ناسینەوەی خۆکار',
  shortLabel: 'خۆکار',
  native: 'Auto',
  english: 'Auto-detect',
};

export const TRANSLATION_LANGUAGES: TranslationLanguage[] = [
  { code: 'ckb', label: 'کوردی (سۆرانی)', shortLabel: 'کوردی', native: 'کوردی', english: 'Kurdish Sorani' },
  { code: 'ku', label: 'کوردی (کرمانجی)', shortLabel: 'کرمانجی', native: 'Kurmancî', english: 'Kurdish Kurmanji' },
  { code: 'en', label: 'ئینگلیزی', shortLabel: 'EN', native: 'English', english: 'English' },
  { code: 'ar', label: 'عەرەبی', shortLabel: 'عەرەبی', native: 'العربية', english: 'Arabic' },
  { code: 'fa', label: 'فارسی', shortLabel: 'فارسی', native: 'فارسی', english: 'Persian' },
  { code: 'tr', label: 'تورکی', shortLabel: 'تورکی', native: 'Türkçe', english: 'Turkish' },
  { code: 'de', label: 'ئەڵمانی', shortLabel: 'ئەڵمانی', native: 'Deutsch', english: 'German' },
  { code: 'fr', label: 'فەرەنسی', shortLabel: 'فەرەنسی', native: 'Français', english: 'French' },
  { code: 'es', label: 'ئیسپانی', shortLabel: 'ئیسپانی', native: 'Español', english: 'Spanish' },
  { code: 'it', label: 'ئیتاڵی', shortLabel: 'ئیتاڵی', native: 'Italiano', english: 'Italian' },
  { code: 'ru', label: 'ڕووسی', shortLabel: 'ڕووسی', native: 'Русский', english: 'Russian' },
  { code: 'sv', label: 'سویدی', shortLabel: 'سویدی', native: 'Svenska', english: 'Swedish' },
  { code: 'nl', label: 'هۆڵەندی', shortLabel: 'هۆڵەندی', native: 'Nederlands', english: 'Dutch' },
  { code: 'no', label: 'نەرویجی', shortLabel: 'نەرویجی', native: 'Norsk', english: 'Norwegian' },
  { code: 'da', label: 'دانیمارکی', shortLabel: 'دانیمارکی', native: 'Dansk', english: 'Danish' },
  { code: 'fi', label: 'فینلەندی', shortLabel: 'فینلەندی', native: 'Suomi', english: 'Finnish' },
  { code: 'pt', label: 'پورتوگالی', shortLabel: 'پورتوگالی', native: 'Português', english: 'Portuguese' },
  { code: 'pl', label: 'پۆڵەندی', shortLabel: 'پۆڵەندی', native: 'Polski', english: 'Polish' },
  { code: 'el', label: 'یۆنانی', shortLabel: 'یۆنانی', native: 'Ελληνικά', english: 'Greek' },
  { code: 'uk', label: 'ئۆکراینی', shortLabel: 'ئۆکراینی', native: 'Українська', english: 'Ukrainian' },
  { code: 'zh-CN', label: 'چینی', shortLabel: 'چینی', native: '中文', english: 'Chinese (Simplified)' },
  { code: 'ja', label: 'ژاپۆنی', shortLabel: 'ژاپۆنی', native: '日本語', english: 'Japanese' },
  { code: 'ko', label: 'کۆری', shortLabel: 'کۆری', native: '한국어', english: 'Korean' },
  { code: 'hi', label: 'هیندی', shortLabel: 'هیندی', native: 'हिन्दी', english: 'Hindi' },
  { code: 'ur', label: 'ئوردوو', shortLabel: 'ئوردوو', native: 'اردو', english: 'Urdu' },
  { code: 'az', label: 'ئازەربایجانی', shortLabel: 'ئازەری', native: 'Azərbaycan', english: 'Azerbaijani' },
  { code: 'hy', label: 'ئەرمەنی', shortLabel: 'ئەرمەنی', native: 'Հայերեն', english: 'Armenian' },
  { code: 'ka', label: 'جۆرجی', shortLabel: 'جۆرجی', native: 'ქართული', english: 'Georgian' },
  { code: 'he', label: 'عیبری', shortLabel: 'عیبری', native: 'עברית', english: 'Hebrew' },
  { code: 'id', label: 'ئیندۆنیزی', shortLabel: 'ئیندۆنیزی', native: 'Indonesia', english: 'Indonesian' },
  { code: 'ms', label: 'مالیزی', shortLabel: 'مالیزی', native: 'Melayu', english: 'Malay' },
  { code: 'th', label: 'تایلەندی', shortLabel: 'تایلەندی', native: 'ไทย', english: 'Thai' },
  { code: 'vi', label: 'ڤێتنامی', shortLabel: 'ڤێتنامی', native: 'Tiếng Việt', english: 'Vietnamese' },
  { code: 'tl', label: 'فلیپینی', shortLabel: 'فلیپینی', native: 'Filipino', english: 'Filipino' },
  { code: 'bn', label: 'بەنگالی', shortLabel: 'بەنگالی', native: 'বাংলা', english: 'Bengali' },
  { code: 'ps', label: 'پەشتۆ', shortLabel: 'پەشتۆ', native: 'پښتو', english: 'Pashto' },
  { code: 'cs', label: 'چیکی', shortLabel: 'چیکی', native: 'Čeština', english: 'Czech' },
  { code: 'ro', label: 'ڕۆمانی', shortLabel: 'ڕۆمانی', native: 'Română', english: 'Romanian' },
  { code: 'hu', label: 'هەنگاری', shortLabel: 'هەنگاری', native: 'Magyar', english: 'Hungarian' },
  { code: 'bg', label: 'بولگاری', shortLabel: 'بولگاری', native: 'Български', english: 'Bulgarian' },
  { code: 'sr', label: 'سربی', shortLabel: 'سربی', native: 'Српски', english: 'Serbian' },
  { code: 'hr', label: 'کرواتی', shortLabel: 'کرواتی', native: 'Hrvatski', english: 'Croatian' },
  { code: 'bs', label: 'بۆسنی', shortLabel: 'بۆسنی', native: 'Bosanski', english: 'Bosnian' },
  { code: 'sq', label: 'ئەلبانی', shortLabel: 'ئەلبانی', native: 'Shqip', english: 'Albanian' },
  { code: 'sk', label: 'سلۆڤاکی', shortLabel: 'سلۆڤاکی', native: 'Slovenčina', english: 'Slovak' },
  { code: 'sl', label: 'سلۆڤینی', shortLabel: 'سلۆڤینی', native: 'Slovenščina', english: 'Slovenian' },
  { code: 'lt', label: 'لیتوانی', shortLabel: 'لیتوانی', native: 'Lietuvių', english: 'Lithuanian' },
  { code: 'lv', label: 'لاتڤی', shortLabel: 'لاتڤی', native: 'Latviešu', english: 'Latvian' },
  { code: 'et', label: 'ئیستۆنی', shortLabel: 'ئیستۆنی', native: 'Eesti', english: 'Estonian' },
  { code: 'ca', label: 'کاتالۆنی', shortLabel: 'کاتالۆنی', native: 'Català', english: 'Catalan' },
  { code: 'sw', label: 'سواحیلی', shortLabel: 'سواحیلی', native: 'Kiswahili', english: 'Swahili' },
  { code: 'am', label: 'ئەمهەری', shortLabel: 'ئەمهەری', native: 'አማርኛ', english: 'Amharic' },
  { code: 'so', label: 'سۆماڵی', shortLabel: 'سۆماڵی', native: 'Soomaali', english: 'Somali' },
  { code: 'uz', label: 'ئۆزبەکی', shortLabel: 'ئۆزبەکی', native: 'Oʻzbek', english: 'Uzbek' },
  { code: 'kk', label: 'کازاخی', shortLabel: 'کازاخی', native: 'Қазақ', english: 'Kazakh' },
  { code: 'tg', label: 'تاجیکی', shortLabel: 'تاجیکی', native: 'Тоҷикӣ', english: 'Tajik' },
  { code: 'tk', label: 'تورکمانی', shortLabel: 'تورکمانی', native: 'Türkmen', english: 'Turkmen' },
  { code: 'pa', label: 'پەنجابی', shortLabel: 'پەنجابی', native: 'ਪੰਜਾਬੀ', english: 'Punjabi' },
  { code: 'ta', label: 'تامیلی', shortLabel: 'تامیلی', native: 'தமிழ்', english: 'Tamil' },
  { code: 'is', label: 'ئایسلەندی', shortLabel: 'ئایسلەندی', native: 'Íslenska', english: 'Icelandic' },
  { code: 'ga', label: 'ئێرلەندی', shortLabel: 'ئێرلەندی', native: 'Gaeilge', english: 'Irish' },
  { code: 'af', label: 'ئەفریکانی', shortLabel: 'ئەفریکانی', native: 'Afrikaans', english: 'Afrikaans' },
];

const LANG_BY_CODE = new Map<string, TranslationLanguage>(
  [AUTO_DETECT_LANG, ...TRANSLATION_LANGUAGES].map((l) => [l.code, l])
);

export function getTranslationLang(code: string): TranslationLanguage {
  return (
    LANG_BY_CODE.get(code) || {
      code,
      label: code,
      shortLabel: code.toUpperCase(),
      native: code,
      english: code,
    }
  );
}

export function filterTranslationLanguages(
  query: string,
  includeAuto: boolean
): TranslationLanguage[] {
  const base = includeAuto
    ? [AUTO_DETECT_LANG, ...TRANSLATION_LANGUAGES]
    : TRANSLATION_LANGUAGES;
  const q = query.trim().toLowerCase();
  if (!q) return base;
  return base.filter(
    (l) =>
      l.label.toLowerCase().includes(q) ||
      l.shortLabel.toLowerCase().includes(q) ||
      l.native.toLowerCase().includes(q) ||
      l.english.toLowerCase().includes(q) ||
      l.code.toLowerCase().includes(q)
  );
}
