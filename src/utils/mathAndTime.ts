const DIGIT_MAP: Record<string, string> = {
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
  '۰': '0',
  '۱': '1',
  '۲': '2',
  '۳': '3',
  '۴': '4',
  '۵': '5',
  '۶': '6',
  '۷': '7',
  '۸': '8',
  '۹': '9',
};

export function normalizeDigits(input: string): string {
  return input.replace(/[٠-٩۰-۹]/g, (ch) => DIGIT_MAP[ch] ?? ch);
}

/**
 * Safe recursive-descent arithmetic evaluator (no eval / Function).
 * Supports +, -, *, /, %, parentheses, decimals, and unary minus/plus.
 */
export function evaluateSafeMath(rawExpression: string): number | null {
  const normalized = normalizeDigits(rawExpression)
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .replace(/،/g, '')
    .replace(/\s+/g, '');

  if (!normalized || normalized.length > 80) return null;
  if (!/^[0-9+\-*/().%]+$/.test(normalized)) return null;

  let pos = 0;

  const peek = () => normalized[pos] || '';

  const parseExpression = (): number | null => {
    let left = parseTerm();
    if (left === null) return null;
    while (peek() === '+' || peek() === '-') {
      const op = normalized[pos++];
      const right = parseTerm();
      if (right === null) return null;
      left = op === '+' ? left + right : left - right;
    }
    return left;
  };

  const parseTerm = (): number | null => {
    let left = parseUnary();
    if (left === null) return null;
    while (peek() === '*' || peek() === '/' || peek() === '%') {
      const op = normalized[pos++];
      const right = parseUnary();
      if (right === null) return null;
      if (op === '*') left *= right;
      else if (op === '/') {
        if (right === 0) return null;
        left /= right;
      } else {
        if (right === 0) return null;
        left %= right;
      }
    }
    return left;
  };

  const parseUnary = (): number | null => {
    if (peek() === '+') {
      pos++;
      return parseUnary();
    }
    if (peek() === '-') {
      pos++;
      const val = parseUnary();
      return val === null ? null : -val;
    }
    return parsePrimary();
  };

  const parsePrimary = (): number | null => {
    if (peek() === '(') {
      pos++;
      const inner = parseExpression();
      if (inner === null || peek() !== ')') return null;
      pos++;
      return inner;
    }
    const start = pos;
    let hasDot = false;
    while (pos < normalized.length) {
      const ch = normalized[pos];
      if (ch >= '0' && ch <= '9') {
        pos++;
      } else if (ch === '.' && !hasDot) {
        hasDot = true;
        pos++;
      } else {
        break;
      }
    }
    if (pos === start) return null;
    const numStr = normalized.slice(start, pos);
    if (numStr === '.') return null;
    const num = Number(numStr);
    return Number.isFinite(num) ? num : null;
  };

  const result = parseExpression();
  if (result === null || pos !== normalized.length || !Number.isFinite(result)) {
    return null;
  }
  return result;
}

export function formatMathResult(value: number): string {
  if (!Number.isFinite(value)) return '';
  const rounded = Math.round(value * 1_000_000) / 1_000_000;
  if (Object.is(rounded, -0)) return '0';
  return String(rounded);
}

/**
 * Detects a trailing arithmetic expression inside live editor text (e.g., "250*4" or "١٥٠٠+٣٥٠=").
 */
export function detectInlineMath(editorText: string): {
  rawMatch: string;
  hasTrailingEquals: boolean;
  formatted: string;
} | null {
  if (!editorText) return null;
  const match = editorText.match(/([0-9٠-٩۰-۹(][0-9٠-٩۰-۹+\-*/×÷−().%\s]*[0-9٠-٩۰-۹)])\s*(=)?$/);
  if (!match) return null;

  const exprPart = match[1].trim();
  const hasTrailingEquals = Boolean(match[2]);
  const rawMatch = match[0];

  // Must include at least one binary arithmetic operator so plain numbers/phone numbers don't trigger
  if (!/[+\-*/×÷−%]/.test(exprPart.slice(1))) return null;
  // Avoid dates like 2026-11-20 or phone numbers like 0750-123-4567
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(normalizeDigits(exprPart))) return null;
  if (/^0\d{2,3}-\d{3,4}-\d{3,4}$/.test(normalizeDigits(exprPart))) return null;

  const val = evaluateSafeMath(exprPart);
  if (val === null) return null;

  return {
    rawMatch,
    hasTrailingEquals,
    formatted: formatMathResult(val),
  };
}

const KURDISH_MONTHS = [
  'کانوونی دووەم',
  'شوبات',
  'ئازار',
  'نیسان',
  'ئایار',
  'حوزەیران',
  'تەممووز',
  'ئاب',
  'ئەیلوول',
  'تشرینی یەکەم',
  'تشرینی دووەم',
  'کانوونی یەکەم',
];

const KURDISH_WEEKDAYS = [
  'یەکشەممە',
  'دووشەممە',
  'سێشەممە',
  'چوارشەممە',
  'پێنجشەممە',
  'هەینی',
  'شەممە',
];

export interface QuickDateTimeChip {
  id: string;
  label: string;
  value: string;
}

export function getQuickDateTimeChips(now: Date = new Date()): QuickDateTimeChip[] {
  const year = now.getFullYear();
  const monthIdx = now.getMonth();
  const day = now.getDate();
  const weekday = KURDISH_WEEKDAYS[now.getDay()] || '';
  const pad = (n: number) => String(n).padStart(2, '0');
  const hh = pad(now.getHours());
  const mm = pad(now.getMinutes());

  return [
    {
      id: 'time',
      label: 'کاتژمێر',
      value: `${hh}:${mm}`,
    },
    {
      id: 'date_num',
      label: 'بەروار',
      value: `${year}/${pad(monthIdx + 1)}/${pad(day)}`,
    },
    {
      id: 'date_ku',
      label: 'بەرواری کوردی',
      value: `${weekday}، ${day}ی ${KURDISH_MONTHS[monthIdx]}ی ${year}`,
    },
  ];
}
