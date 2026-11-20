import richDataRaw from './generated/richData.json';

export interface EmojiEntry {
  c: string; // Base emoji character
  e?: string; // English keyword / name
  k?: string; // Kurdish Sorani keyword / name
  v?: string[]; // Skin-tone variations from xanda.txt
}

export interface EmojiCategory {
  id: string;
  label: string;
  icon: string;
  items: EmojiEntry[];
}

export interface ZikrEntry {
  d: string; // Display label on tile
  v: string; // Full inserted value
}

interface RichDataShape {
  emojiCategories: EmojiCategory[];
  zikrData: {
    duaa: ZikrEntry[];
    quran: ZikrEntry[];
    salawat: ZikrEntry[];
  };
  kaomojiList: string[];
}

const richData = richDataRaw as RichDataShape;

export const EMOJI_SKIN_TONES = [
  { id: 'default', label: 'بنەڕەتی', sample: '👋', mod: '', index: -1 },
  { id: 'light', label: 'سپی', sample: '👋🏻', mod: '🏻', index: 0 },
  { id: 'medium-light', label: 'گەنمڕەنگ', sample: '👋🏼', mod: '🏼', index: 1 },
  { id: 'medium', label: 'مامناوەند', sample: '👋🏽', mod: '🏽', index: 2 },
  { id: 'medium-dark', label: 'ئەسمەر', sample: '👋🏾', mod: '🏾', index: 3 },
  { id: 'dark', label: 'تۆخ', sample: '👋🏿', mod: '🏿', index: 4 },
];

export const EMOJI_CATEGORIES: EmojiCategory[] = richData.emojiCategories;
export const ALL_EMOJI_ENTRIES: EmojiEntry[] = EMOJI_CATEGORIES.flatMap((cat) => cat.items);

export const ZIKR_CATEGORIES = richData.zikrData;
export const KAOMOJI_LIST: string[] = richData.kaomojiList;

export function resolveEmojiWithSkinTone(entry: EmojiEntry, skinToneMod: string): string {
  if (!skinToneMod || !entry.v || entry.v.length === 0) return entry.c;
  const toneObj = EMOJI_SKIN_TONES.find((t) => t.mod === skinToneMod);
  if (toneObj && toneObj.index >= 0 && entry.v[toneObj.index]) {
    return entry.v[toneObj.index];
  }
  const match = entry.v.find((variant) => variant.includes(skinToneMod));
  return match || entry.c;
}

export function searchEmojis(query: string, limit = 70): EmojiEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const results: EmojiEntry[] = [];
  for (const item of ALL_EMOJI_ENTRIES) {
    if (
      item.c === q ||
      (item.k && item.k.toLowerCase().includes(q)) ||
      (item.e && item.e.toLowerCase().includes(q))
    ) {
      results.push(item);
      if (results.length >= limit) break;
    }
  }
  return results;
}

// Text Decoration Styles ("جوانکاری نووسین")
export interface TextDecoratorStyle {
  id: string;
  nameKu: string;
  preview: string;
  transform: (input: string) => string;
}

const BOLD_MAP: Record<string, string> = {};
const SCRIPT_MAP: Record<string, string> = {};
const MONO_MAP: Record<string, string> = {};
const BUBBLE_MAP: Record<string, string> = {};

(() => {
  const normal = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bold = [...'𝐀𝐁𝐂𝐃𝐄𝐅𝐆𝐇𝐈𝐉𝐊𝐋𝐌𝐍𝐎𝐏𝐐𝐑𝐒𝐓𝐔𝐕𝐖𝐗𝐘𝐙𝐚𝐛𝐜𝐝𝐞𝐟𝐠𝐡𝐢𝐣𝐤𝐥𝐦𝐧𝐨𝐩𝐪𝐫𝐬𝐭𝐮𝐯𝐰𝐱𝐲𝐳𝟎𝟏𝟐𝟑𝟒𝟓𝟔𝟕𝟖𝟗'];
  const script = [...'𝓐𝓑𝓒𝓓𝓔𝓕𝓖𝓗𝓘𝓙𝓚𝓛𝓜𝓝𝓞𝓟𝓠𝓡𝓢𝓣𝓤𝓥𝓦𝓧𝓨𝓩𝓪𝓫𝓬𝓭𝓮𝓯𝓰𝓱𝓲𝓳𝓴𝓵𝓶𝓷𝓸𝓹𝓺𝓻𝓼𝓽𝓾𝓿𝔀𝔁𝔂𝔃0123456789'];
  const mono = [...'𝙰𝙱𝙲𝙳𝙴𝙵𝙶𝙷𝙸𝙹𝙺𝙻𝙼𝙽𝙾𝙿𝚀𝚁𝚂𝚃𝚄𝚅𝚆𝚇𝚈𝚉𝚊𝚋𝚌𝚍𝚎𝚏𝚐𝚑𝚒𝚓𝚔𝚕𝚖𝚗𝚘𝚙𝚚𝚛𝚜𝚝𝚞𝚟𝚠𝚡𝚢𝚣𝟶𝟷𝟸𝟹𝟺𝟻𝟼𝟽𝟾𝟿'];
  const bubble = [...'ⒶⒷⒸⒹⒺⒻⒼⒽⒾⒿⓀⓁⓂⓃⓄⓅⓆⓇⓈⓉⓊⓋⓌⓍⓎⓏⓐⓑⓒⓓⓔⓕⓖⓗⓘⓙⓚⓛⓜⓝⓞⓟⓠⓡⓢⓣⓤⓥⓦⓧⓨⓩ⓪①②③④⑤⑥⑦⑧⑨'];
  for (let i = 0; i < normal.length; i++) {
    BOLD_MAP[normal[i]] = bold[i] || normal[i];
    SCRIPT_MAP[normal[i]] = script[i] || normal[i];
    MONO_MAP[normal[i]] = mono[i] || normal[i];
    BUBBLE_MAP[normal[i]] = bubble[i] || normal[i];
  }
})();

function mapChars(text: string, map: Record<string, string>): string {
  return [...text].map((ch) => map[ch] || ch).join('');
}

function addKashida(text: string): string {
  const joinable = new Set([
    'ب', 'پ', 'ت', 'ث', 'ج', 'چ', 'ح', 'خ', 'س', 'ش', 'ص', 'ض', 'ط', 'ظ',
    'ع', 'غ', 'ف', 'ڤ', 'ق', 'ک', 'ك', 'گ', 'ل', 'ڵ', 'م', 'ن', 'ه', 'ی', 'ي', 'ێ',
  ]);
  const chars = [...text];
  let out = '';
  for (let i = 0; i < chars.length; i++) {
    out += chars[i];
    if (joinable.has(chars[i]) && i < chars.length - 1 && chars[i + 1] !== ' ' && chars[i + 1] !== '\n') {
      out += 'ـ';
    }
  }
  return out;
}

export const TEXT_DECORATORS: TextDecoratorStyle[] = [
  {
    id: 'none',
    nameKu: 'ئاسایی',
    preview: 'سڵاو کوردستان',
    transform: (t) => t,
  },
  {
    id: 'kashida',
    nameKu: 'درێژکراوەی کوردی',
    preview: 'سـڵاو کـوردسـتـان',
    transform: (t) => addKashida(t),
  },
  {
    id: 'royal_frame',
    nameKu: 'چوارچێوەی شاهانە',
    preview: '꧁༒ سڵاو ༒꧂',
    transform: (t) => (t.trim() ? `꧁༒ ${t.trim()} ༒꧂` : ''),
  },
  {
    id: 'hearts_frame',
    nameKu: 'دڵ و گوڵ',
    preview: '♡︎ سڵاو ♡︎',
    transform: (t) => (t.trim() ? `♡︎ ${t.trim()} ♡︎` : ''),
  },
  {
    id: 'stars_frame',
    nameKu: 'ئەستێرەیی',
    preview: '★彡 سڵاو 彡★',
    transform: (t) => (t.trim() ? `★彡 ${t.trim()} 彡★` : ''),
  },
  {
    id: 'kurdish_ornate',
    nameKu: 'ڕازاوەی کوردی',
    preview: '✦ ༺ سـڵاو ༻ ✦',
    transform: (t) => (t.trim() ? `✦ ༺ ${addKashida(t.trim())} ༻ ✦` : ''),
  },
  {
    id: 'bold_en',
    nameKu: 'تۆخ (Bold)',
    preview: '𝐊𝐮𝐫𝐝𝐢𝐬𝐭𝐚𝐧',
    transform: (t) => mapChars(t, BOLD_MAP),
  },
  {
    id: 'script_en',
    nameKu: 'دەستنووس (Script)',
    preview: '𝓚𝓾𝓻𝓭𝓲𝓼𝓽𝓪𝓷',
    transform: (t) => mapChars(t, SCRIPT_MAP),
  },
  {
    id: 'mono_en',
    nameKu: 'مۆنۆ (Mono)',
    preview: '𝙺𝚞𝚛𝚍𝚒𝚜𝚝𝚊𝚗',
    transform: (t) => mapChars(t, MONO_MAP),
  },
  {
    id: 'bubble_en',
    nameKu: 'بازنەیی (Bubble)',
    preview: 'Ⓚⓤⓡⓓⓘⓢⓣⓐⓝ',
    transform: (t) => mapChars(t, BUBBLE_MAP),
  },
];

// Built-in Kurdish Sorani & English dictionary for live word suggestions
export const KURDISH_DICTIONARY = [
  'سڵاو', 'سڵاوتان', 'چۆنیت', 'چۆنن', 'باشم', 'سوپاس', 'زۆر', 'زۆر سوپاس', 'بەخێربێیت', 'کوردستان', 'کوردی',
  'هەولێر', 'سلێمانی', 'دهۆک', 'کەرکووک', 'هەڵەبجە', 'بەیانیتان باش', 'ئێوارەتان باش', 'شەوتان شاد', 'خواتان لەگەڵ',
  'دەستخۆش', 'ماندوو نەبن', 'سەرکەوتوو بن', 'تەختەکلیل', 'بەرنامە', 'نووسین', 'پێشنیار', 'ڕێکخستن', 'جوانکاری',
  'وەرگێڕان', 'ژیری دەسکرد', 'تکایە', 'ببوورە', 'بەڵێ', 'نەخێر', 'ئەمڕۆ', 'بەیانی', 'دوێنێ', 'ئێستا', 'دواتر',
  'پێشتر', 'هەموو', 'هەندێک', 'زانیاری', 'پەیوەندی', 'هاوڕێ', 'خێزان', 'ماڵەوە', 'کارکردن', 'خوێندن', 'کتێب',
  'مۆبایل', 'تەکنەلۆژیا', 'جوان', 'باشتر', 'خێرا', 'ئاسان', 'پیرۆزە', 'جەژنتان پیرۆز', 'تەمەندرێژ بن',
];

export const ENGLISH_DICTIONARY = [
  'hello', 'thanks', 'thank', 'you', 'please', 'kurdistan', 'kurdish', 'keyboard', 'welcome', 'good', 'morning',
  'evening', 'night', 'awesome', 'great', 'beautiful', 'settings', 'theme', 'translate', 'smart', 'message',
  'friend', 'family', 'today', 'tomorrow', 'always', 'perfect', 'working', 'project', 'design', 'mobile',
];

// Build fast keyword -> emojis lookup from xanda.txt Kurdish & English keywords
export const EMOJI_KEYWORD_MAP: Record<string, string[]> = (() => {
  const map: Record<string, string[]> = {
    سڵاو: ['👋', '😊', '🤝'],
    خۆشەویستی: ['❤️', '🥰', '🌹'],
    دڵ: ['❤️', '💖', '💙'],
    پێکەنین: ['😂', '🤣', '😄'],
    سوپاس: ['🙏', '💐', '❤️'],
    کوردستان: ['🇹🇯', '☀️', '🏔️'],
    پیرۆزە: ['🎉', '🎊', '🥳'],
    باران: ['🌧️', '☔', '⛈️'],
    چا: ['🍵', '☕', '🫖'],
    hello: ['👋', '😊'],
    love: ['❤️', '😍', '💖'],
    happy: ['😄', '🥳', '✨'],
    thanks: ['🙏', '💐'],
    fire: ['🔥', '💯'],
    star: ['⭐', '🌟', '✨'],
  };

  for (const item of ALL_EMOJI_ENTRIES) {
    const tokens = [
      ...(item.k ? item.k.split(/[\s،,]+/) : []),
      ...(item.e ? item.e.toLowerCase().split(/[\s,]+/) : []),
    ];
    for (const rawTok of tokens) {
      const tok = rawTok.trim();
      if (tok.length < 2) continue;
      if (!map[tok]) {
        map[tok] = [item.c];
      } else if (map[tok].length < 4 && !map[tok].includes(item.c)) {
        map[tok].push(item.c);
      }
    }
  }
  return map;
})();
