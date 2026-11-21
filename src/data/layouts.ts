import layoutsBundleRaw from './generated/layoutsBundle.json';
import {
  BottomRowPresetId,
  KeyboardSettings,
  KeyboardViewMode,
  KeySpec,
  KeyType,
  LanguageConfig,
  NumberStyle,
  PopupOption,
} from '../types/keyboard';

// Types for the compiled FlorisBoard/KurdiKeyboard JSON bundle
interface RawKeyNode {
  $?: string;
  code?: number;
  label?: string;
  type?: string;
  groupId?: number;
  width?: number;
  popup?: RawPopupSet;
  // Selectors
  default?: RawKeyNode;
  ltr?: RawKeyNode;
  rtl?: RawKeyNode;
  lower?: RawKeyNode;
  upper?: RawKeyNode;
  unshifted?: RawKeyNode;
  shiftedManual?: RawKeyNode;
  shiftedAuto?: RawKeyNode;
  capsLock?: RawKeyNode;
  hira?: RawKeyNode;
  kata?: RawKeyNode;
  full?: RawKeyNode;
  half?: RawKeyNode;
  codePoints?: number[];
}

interface RawPopupSet {
  main?: RawKeyNode;
  relevant?: RawKeyNode[];
}

interface RawManifestItem {
  id: string;
  label: string;
  direction?: 'rtl' | 'ltr';
  modifier?: string;
}

interface RawSubtypePreset {
  languageTag: string;
  composer?: string;
  currencySet: string;
  popupMapping: string;
  showNumberRow?: boolean;
  preferred: {
    characters: string;
    symbols?: string;
    symbols2?: string;
    numericRow?: string;
    numericAdvanced?: string;
  };
}

interface RawCurrencySet {
  id: string;
  label: string;
  slots: { code: number; label: string }[];
}

interface CompiledLayoutsBundle {
  subtypePresets: RawSubtypePreset[];
  currencySets: RawCurrencySet[];
  manifest: {
    characters: RawManifestItem[];
    charactersMod: RawManifestItem[];
  };
  popupMappings: Record<string, { all?: Record<string, RawPopupSet>; lower?: Record<string, RawPopupSet>; upper?: Record<string, RawPopupSet> }>;
  layouts: {
    characters: Record<string, RawKeyNode[][]>;
    charactersMod: Record<string, RawKeyNode[][]>;
    numeric: Record<string, RawKeyNode[][]>;
    numericAdvanced: Record<string, RawKeyNode[][]>;
    numericRow: Record<string, RawKeyNode[][]>;
    phone: Record<string, RawKeyNode[][]>;
    phone2: Record<string, RawKeyNode[][]>;
    symbols: Record<string, RawKeyNode[][]>;
    symbolsMod: Record<string, RawKeyNode[][]>;
    symbols2: Record<string, RawKeyNode[][]>;
    symbols2Mod: Record<string, RawKeyNode[][]>;
  };
}

const bundle = layoutsBundleRaw as unknown as CompiledLayoutsBundle;

function stripNs(ref: string | undefined, fallback: string): string {
  if (!ref) return fallback;
  const idx = ref.indexOf(':');
  return idx >= 0 ? ref.slice(idx + 1) : ref;
}

const LANGUAGE_META: Record<
  string,
  { name: string; nativeName: string; dir: 'rtl' | 'ltr'; defaultNumberRow: boolean }
> = {
  ckb: { name: 'Kurdish (Sorani)', nativeName: 'کوردی', dir: 'rtl', defaultNumberRow: false },
  hac: { name: 'Kurdish (Hawrami)', nativeName: 'هۉرامی', dir: 'rtl', defaultNumberRow: false },
  sdh: { name: 'Kurdish (Southern)', nativeName: 'کوردی خوارین', dir: 'rtl', defaultNumberRow: false },
  ku: { name: 'Kurdish (Kurmanji)', nativeName: 'Kurdî (Kurmancî)', dir: 'ltr', defaultNumberRow: true },
  en: { name: 'English', nativeName: 'English', dir: 'ltr', defaultNumberRow: true },
  ar: { name: 'Arabic', nativeName: 'العربية', dir: 'rtl', defaultNumberRow: false },
  fa: { name: 'Persian', nativeName: 'فارسی', dir: 'rtl', defaultNumberRow: false },
  de: { name: 'German', nativeName: 'Deutsch', dir: 'ltr', defaultNumberRow: true },
  fr: { name: 'French', nativeName: 'Français', dir: 'ltr', defaultNumberRow: true },
  it: { name: 'Italian', nativeName: 'Italiano', dir: 'ltr', defaultNumberRow: true },
  es: { name: 'Spanish', nativeName: 'Español', dir: 'ltr', defaultNumberRow: true },
  pt: { name: 'Portuguese', nativeName: 'Português', dir: 'ltr', defaultNumberRow: true },
  no: { name: 'Norwegian', nativeName: 'Norsk', dir: 'ltr', defaultNumberRow: true },
  sv: { name: 'Swedish', nativeName: 'Svenska', dir: 'ltr', defaultNumberRow: true },
  fi: { name: 'Finnish', nativeName: 'Suomi', dir: 'ltr', defaultNumberRow: true },
  da: { name: 'Danish', nativeName: 'Dansk', dir: 'ltr', defaultNumberRow: true },
  ru: { name: 'Russian', nativeName: 'Русский', dir: 'ltr', defaultNumberRow: true },
  el: { name: 'Greek', nativeName: 'Ελληνικά', dir: 'ltr', defaultNumberRow: true },
  ko: { name: 'Korean', nativeName: '한국어', dir: 'ltr', defaultNumberRow: true },
  zgh: { name: 'Amazigh', nativeName: 'ⵜⴰⵎⴰⵣⵉⵖⵜ', dir: 'ltr', defaultNumberRow: true },
};

const manifestCharMap = new Map<string, RawManifestItem>();
for (const item of bundle.manifest.characters) {
  manifestCharMap.set(item.id, item);
}

export interface CharacterLayoutOption {
  id: string;
  label: string;
  direction: 'rtl' | 'ltr';
  modifierId: string;
  group: 'kurdish' | 'fancy' | 'arabic_persian' | 'international';
}

const KURDISH_LAYOUT_IDS = new Set([
  'kurdi_qvfgh',
  'kurdi_chpqv',
  'kurdi_qwerty_nwe',
  'kurdi_qwerty',
  'kurdi_qvfp',
  'kurdi_qfghh',
  'kurdi_vaeq',
  'kurdi_alfbe',
  'horami',
  'xwarg',
  'kurdi_hybrid',
  'qwerty_kurdi',
  'kurmanci',
]);

export const CHARACTER_LAYOUT_OPTIONS: CharacterLayoutOption[] = bundle.manifest.characters
  .filter((m) => Boolean(bundle.layouts.characters[m.id]))
  .map((m) => {
    let group: CharacterLayoutOption['group'] = 'international';
    if (KURDISH_LAYOUT_IDS.has(m.id)) group = 'kurdish';
    else if (m.id.startsWith('fancy_')) group = 'fancy';
    else if (m.id.startsWith('arabic') || m.id.startsWith('persian')) group = 'arabic_persian';
    return {
      id: m.id,
      label: m.label,
      direction: m.direction || 'ltr',
      modifierId: stripNs(m.modifier, 'default'),
      group,
    };
  });

export function getCharacterLayoutLabel(layoutId: string): string {
  return manifestCharMap.get(layoutId)?.label || layoutId;
}

export const ALL_SUBTYPE_PRESETS: LanguageConfig[] = bundle.subtypePresets.map((preset) => {
  const charId = stripNs(preset.preferred.characters, 'qwerty');
  const meta = LANGUAGE_META[preset.languageTag] || {
    name: preset.languageTag.toUpperCase(),
    nativeName: preset.languageTag.toUpperCase(),
    dir: (manifestCharMap.get(charId)?.direction || 'ltr') as 'rtl' | 'ltr',
    defaultNumberRow: false,
  };
  return {
    code: preset.languageTag,
    name: meta.name,
    nativeName: meta.nativeName,
    subtitle: getCharacterLayoutLabel(charId),
    numberRow: preset.showNumberRow ?? meta.defaultNumberRow,
    dir: meta.dir,
    characterLayoutId: charId,
    popupMappingId: stripNs(preset.popupMapping, 'default'),
    currencySetId: stripNs(preset.currencySet, 'dollar'),
    symbolsLayoutId: stripNs(preset.preferred.symbols, 'sym_alt'),
    symbols2LayoutId: stripNs(preset.preferred.symbols2, 'sym_alt'),
    numericRowId: stripNs(preset.preferred.numericRow, 'latin'),
    numericAdvancedId: stripNs(preset.preferred.numericAdvanced, 'latin'),
    composerId: preset.composer,
  };
});

export function findSubtypePreset(code: string): LanguageConfig {
  return (
    ALL_SUBTYPE_PRESETS.find((p) => p.code === code) ||
    ALL_SUBTYPE_PRESETS[0]
  );
}

export const BOTTOM_ROW_PRESETS: { id: BottomRowPresetId; labelKu: string; descKu: string }[] = [
  { id: 'auto', labelKu: 'خۆکار (بەپێی زمان)', descKu: 'ڕیزی خوارەوەی تایبەت بە هەر زمان و شێوازێک' },
  { id: 'kurdish', labelKu: 'کوردی بنەڕەتی', descKu: 'هێما، فاریزە، گۆڕینی زمان، بۆشایی، خەندە، خاڵ، ناردن' },
  { id: 'default', labelKu: 'ستانداردی جیهانی', descKu: 'ڕیزی خوارەوەی کلاسیکی گشتگیر' },
  { id: 'bottom_row_compact', labelKu: 'کۆمپاکت (تێکەڵ)', descKu: 'قەبارەی بۆشایی فراوانتر و دوگمەی کەمتر' },
  { id: 'bottom_row_simple', labelKu: 'سادە و پاک', descKu: 'دوگمە بنەڕەتییەکان بەبێ قەرەباڵغی' },
  { id: 'bottom_row_full', labelKu: 'تەواو (هەموو دوگمەکان)', descKu: 'هەموو دوگمەکان لەگەڵ نیشانەی سەرسوڕمان (!)' },
  { id: 'bottom_row_anysoft_classic', labelKu: 'کلاسیکی AnySoft', descKu: 'شێوازی کلاسیکی دوگمەکانی خوارەوە' },
  { id: 'bottom_row_right_handed', labelKu: 'دەستی ڕاست', descKu: 'گونجاو بۆ بەکارهێنانی دەستی ڕاست' },
  { id: 'bottom_row_left_handed', labelKu: 'دەستی چەپ', descKu: 'گونجاو بۆ بەکارهێنانی دەستی چەپ' },
];

export const NUMBER_STYLE_OPTIONS: { id: NumberStyle; labelKu: string; sample: string }[] = [
  { id: 'latin', labelKu: 'لاتینی (123)', sample: '1234567890' },
  { id: 'kurdish', labelKu: 'کوردی / عەرەبی (١٢٣)', sample: '١٢٣٤٥٦٧٨٩٠' },
  { id: 'urdu_farsi', labelKu: 'فارسی / ئوردو (۱۲۳)', sample: '۱۲۳۴۵۶۷۸۹۰' },
  { id: 'hindi', labelKu: 'هیندی (१२३)', sample: '१२३४५६७८९०' },
];

export const EXTRA_EDITOR_KEYS: string[] = [
  'پ', 'چ', 'ژ', 'ڤ', 'گ', 'ێ', 'ۆ', 'ڵ', 'ڕ', 'ئ', 'ە', 'ێ', 'ۆ',
  'ص', 'ض', 'ث', 'ذ', 'ط', 'ظ', 'غ', 'ع', 'ح', 'خ', 'ه', 'ة', 'ى',
  'ـ', '؟', '،', '؛', '«', '»', 'ئە', 'لا', 'ڵا', 'ﷺ', '۞', 'ـَ', 'ـِ', 'ـُ', 'ـّ',
];

export const EMAIL_DOMAIN_POPUP_OPTIONS: PopupOption[] = [
  { label: '@gmail.com', value: '@gmail.com' },
  { label: '@outlook.com', value: '@outlook.com' },
  { label: '@yahoo.com', value: '@yahoo.com' },
  { label: '@hotmail.com', value: '@hotmail.com' },
  { label: '@icloud.com', value: '@icloud.com' },
  { label: '@apple.com', value: '@apple.com' },
  { label: '@live.com', value: '@live.com' },
  { label: '@proton.me', value: '@proton.me' },
  { label: '@protonmail.com', value: '@protonmail.com' },
  { label: '@me.com', value: '@me.com' },
  { label: '@aol.com', value: '@aol.com' },
  { label: '@yandex.com', value: '@yandex.com' },
  { label: '@mail.com', value: '@mail.com' },
  { label: '@zoho.com', value: '@zoho.com' },
  { label: '@msn.com', value: '@msn.com' },
  { label: '@gmx.com', value: '@gmx.com' },
  { label: '@fastmail.com', value: '@fastmail.com' },
  { label: '@pm.me', value: '@pm.me' },
  { label: '@edu.iq', value: '@edu.iq' },
];

function getCurrencySlots(currencySetId: string): { code: number; label: string }[] {
  const found = bundle.currencySets.find((c) => c.id === currencySetId);
  return found?.slots || bundle.currencySets[1]?.slots || [
    { code: 36, label: '$' },
    { code: 162, label: '¢' },
    { code: 8364, label: '€' },
    { code: 163, label: '£' },
    { code: 165, label: '¥' },
    { code: 8369, label: '₱' },
  ];
}

function resolveRawNode(
  node: RawKeyNode | undefined,
  dir: 'rtl' | 'ltr',
  shiftState: 'off' | 'once' | 'caps',
  kanaMode: 'hira' | 'kata'
): RawKeyNode | null {
  if (!node) return null;
  let current: RawKeyNode | undefined = node;
  let safety = 0;

  while (current && current.$ && safety < 8) {
    safety += 1;
    switch (current.$) {
      case 'variation_selector':
        current = current.default;
        break;
      case 'layout_direction_selector':
        current = dir === 'rtl' ? current.rtl || current.ltr : current.ltr || current.rtl;
        break;
      case 'case_selector':
        current = shiftState !== 'off' ? current.upper || current.lower : current.lower || current.upper;
        break;
      case 'shift_state_selector':
        if (shiftState === 'caps') {
          current = current.capsLock || current.default || current.unshifted || current.shiftedManual;
        } else if (shiftState === 'once') {
          current = current.shiftedManual || current.shiftedAuto || current.default || current.unshifted;
        } else {
          current = current.unshifted || current.default || current.shiftedManual;
        }
        break;
      case 'kana_selector':
        current = kanaMode === 'kata' ? current.kata || current.hira : current.hira || current.kata;
        break;
      case 'char_width_selector':
        current = current.half || current.full;
        break;
      case 'auto_text_key':
      case 'multi_text_key':
        // Leaf key with code/label/codePoints
        return current;
      default:
        return current;
    }
  }
  return current || null;
}

function parseDisplayAndOutput(node: RawKeyNode, isQwertyKurdi: boolean): { label: string; output: string } {
  // Handle codePoints array (multi_text_key)
  if (Array.isArray(node.codePoints) && node.codePoints.length > 0) {
    const out = String.fromCodePoint(...node.codePoints);
    const lbl = node.label || out;
    return { label: lbl, output: out };
  }

  const rawLabel = node.label ?? (node.code && node.code > 0 ? String.fromCodePoint(node.code) : '');

  // Pipe syntax: "display|output" (used heavily in Kurdish quick phrases & Islamic blessings)
  if ((node.code === -255 || node.code === -1001 || rawLabel.includes('|')) && rawLabel.includes('|') && rawLabel !== '<|>') {
    const pipeIdx = rawLabel.indexOf('|');
    const display = rawLabel.slice(0, pipeIdx).trim() || rawLabel;
    const output = rawLabel.slice(pipeIdx + 1);
    return { label: display, output };
  }

  // Special Kurdish Kashida / Tatweel key (code 1600 displayed as ━)
  if (node.code === 1600) {
    return { label: rawLabel || '━', output: '\u0640' };
  }

  // Zero-width non-joiner
  if (node.code === 8204) {
    return { label: rawLabel || '<|>', output: '\u200C' };
  }

  // qwerty_kurdi: Latin display label ("Q") mapped to Kurdish Sorani Unicode codepoint (1602 = "ق")
  if (isQwertyKurdi && node.code && node.code > 32) {
    return {
      label: rawLabel,
      output: String.fromCodePoint(node.code),
    };
  }

  return { label: rawLabel, output: rawLabel };
}

function extractPopupOptions(
  popupSet: RawPopupSet | undefined,
  dir: 'rtl' | 'ltr',
  shiftState: 'off' | 'once' | 'caps',
  kanaMode: 'hira' | 'kata',
  currencySlots: { code: number; label: string }[]
): { secondary?: string; alts: PopupOption[] } {
  if (!popupSet) return { alts: [] };

  const alts: PopupOption[] = [];
  const seen = new Set<string>();
  let secondary: string | undefined;

  const pushNode = (raw: RawKeyNode | undefined, isMain: boolean) => {
    const resolved = resolveRawNode(raw, dir, shiftState, kanaMode);
    if (!resolved) return;

    // Resolve currency slots inside popups
    if (resolved.code && resolved.code <= -801 && resolved.code >= -806) {
      const slot = currencySlots[Math.abs(resolved.code) - 801];
      if (slot) {
        if (isMain && !secondary) secondary = slot.label;
        if (!seen.has(slot.label)) {
          seen.add(slot.label);
          alts.push({ label: slot.label, value: slot.label, code: slot.code });
        }
      }
      return;
    }

    const { label, output } = parseDisplayAndOutput(resolved, false);
    if (!label && !output) return;
    if (isMain && !secondary) {
      secondary = label;
    }
    const dedupeKey = `${label}::${output}`;
    if (!seen.has(dedupeKey)) {
      seen.add(dedupeKey);
      alts.push({ label: label || output, value: output, code: resolved.code });
    }
  };

  if (popupSet.main) pushNode(popupSet.main, true);
  if (Array.isArray(popupSet.relevant)) {
    for (const rel of popupSet.relevant) {
      pushNode(rel, false);
    }
  }

  if (!secondary && alts.length > 0) {
    secondary = alts[0].label;
  }

  return { secondary, alts };
}

function mapKeyCodeToType(code: number | undefined, label: string): KeyType {
  switch (code) {
    case -7:
      return 'backspace';
    case -11:
      return 'shift';
    case 32:
    case 12288:
      return 'space';
    case 10:
      return 'enter';
    case -201:
      return 'characters';
    case -202:
      return 'symbols';
    case -203:
      return 'symbols2';
    case -205:
      return 'numeric_advanced';
    case -206:
      return 'phone';
    case -207:
      return 'phone2';
    case -212:
      return 'emoji';
    case -227:
      return 'globe';
    case -301:
      return 'settings';
    case -31:
      return 'copy';
    case -32:
      return 'cut';
    case -33:
      return 'paste';
    case -35:
      return 'select_all';
    case -111:
      return 'compact_left';
    case -9710:
      return 'kana_toggle';
    case 8204:
      return 'zwnj';
    default:
      if (label === ',' || label === '،') return 'comma';
      if (label === '.') return 'period';
      return 'char';
  }
}

function getDefaultKeyWidth(type: KeyType, code: number | undefined, explicitWidth?: number): number {
  if (explicitWidth && explicitWidth > 0) return explicitWidth;
  switch (type) {
    case 'space':
      return 5.0;
    case 'shift':
    case 'backspace':
      return 1.55;
    case 'enter':
      return 1.5;
    case 'symbols':
    case 'symbols2':
    case 'characters':
      return 1.4;
    case 'numeric_advanced':
    case 'phone':
    case 'phone2':
    case 'kana_toggle':
      return 1.2;
    case 'globe':
    case 'emoji':
      return 1.12;
    case 'comma':
    case 'period':
      return 1.0;
    default:
      if (code === 1600) return 1.55; // Symmetrical Tatweel key matching Backspace
      return 1;
  }
}

function lookupExternalPopup(
  popupMappingId: string,
  lookupKey: string,
  shiftState: 'off' | 'once' | 'caps'
): RawPopupSet | undefined {
  const mapping = bundle.popupMappings[popupMappingId] || bundle.popupMappings.default;
  const def = bundle.popupMappings.default;
  const caseBucket = shiftState !== 'off' ? mapping?.upper : mapping?.lower;
  const defCaseBucket = shiftState !== 'off' ? def?.upper : def?.lower;

  return (
    caseBucket?.[lookupKey] ||
    mapping?.all?.[lookupKey] ||
    mapping?.all?.[lookupKey.toLowerCase()] ||
    defCaseBucket?.[lookupKey] ||
    def?.all?.[lookupKey]
  );
}

function convertRawKeyToSpec(
  rawNode: RawKeyNode,
  rowIdx: number,
  colIdx: number,
  ctx: {
    dir: 'rtl' | 'ltr';
    shiftState: 'off' | 'once' | 'caps';
    kanaMode: 'hira' | 'kata';
    popupMappingId: string;
    currencySlots: { code: number; label: string }[];
    isQwertyKurdi: boolean;
    viewMode: KeyboardViewMode;
  }
): KeySpec | null {
  const node = resolveRawNode(rawNode, ctx.dir, ctx.shiftState, ctx.kanaMode);
  if (!node) return null;

  // Currency slot keys (-801 .. -806)
  if (node.code && node.code <= -801 && node.code >= -806) {
    const slot = ctx.currencySlots[Math.abs(node.code) - 801] || { code: 36, label: '$' };
    const inlinePop = extractPopupOptions(node.popup, ctx.dir, ctx.shiftState, ctx.kanaMode, ctx.currencySlots);
    return {
      id: `k_${rowIdx}_${colIdx}_cur_${slot.code}`,
      code: slot.code,
      primary: slot.label,
      output: slot.label,
      secondary: inlinePop.secondary,
      alts: inlinePop.alts,
      width: node.width || 1,
      type: 'char',
      groupId: node.groupId,
    };
  }

  // Auto-casing for Latin letters when $ === 'auto_text_key' or standard ASCII letters
  let { label, output } = parseDisplayAndOutput(node, ctx.isQwertyKurdi);
  const keyType = mapKeyCodeToType(node.code, label);

  if (
    keyType === 'char' &&
    ctx.shiftState !== 'off' &&
    !ctx.isQwertyKurdi &&
    label.length === 1 &&
    label.toLowerCase() !== label.toUpperCase()
  ) {
    label = label.toUpperCase();
    output = output.toUpperCase();
  }

  // Gather popups: inline popup + external popupMappings (including ~right on period key)
  const inlinePop = extractPopupOptions(node.popup, ctx.dir, ctx.shiftState, ctx.kanaMode, ctx.currencySlots);
  let extPopSet: RawPopupSet | undefined;
  if (keyType === 'period') {
    extPopSet = lookupExternalPopup(ctx.popupMappingId, '~right', ctx.shiftState);
  } else if (keyType === 'char' || keyType === 'comma') {
    const lookupChar = ctx.isQwertyKurdi ? output : label;
    extPopSet = lookupExternalPopup(ctx.popupMappingId, lookupChar, ctx.shiftState);
  }
  const extPop = extractPopupOptions(extPopSet, ctx.dir, ctx.shiftState, ctx.kanaMode, ctx.currencySlots);

  const mergedAlts: PopupOption[] = [];
  const seen = new Set<string>();
  const isAtKey = node.code === 64 || label === '@' || output === '@';
  const sourceAlts = isAtKey
    ? [...EMAIL_DOMAIN_POPUP_OPTIONS, ...inlinePop.alts, ...extPop.alts]
    : [...inlinePop.alts, ...extPop.alts];
  for (const item of sourceAlts) {
    const k = `${item.label}::${item.value}`;
    if (!seen.has(k)) {
      seen.add(k);
      mergedAlts.push(item);
    }
  }

  // Friendly labels for special control keys
  let displayPrimary = label;
  if (keyType === 'symbols') displayPrimary = '!#1';
  else if (keyType === 'symbols2') displayPrimary = '1/2';
  else if (keyType === 'characters') displayPrimary = ctx.dir === 'rtl' ? 'ئەب' : 'ABC';
  else if (keyType === 'numeric_advanced') displayPrimary = ctx.dir === 'rtl' ? '١٢٣' : '1234';
  else if (keyType === 'phone2') displayPrimary = '*#';
  else if (keyType === 'phone') displayPrimary = '123';
  else if (node.code === -9701) displayPrimary = '全/半';
  else if (node.code === -9702) displayPrimary = '全';
  else if (node.code === -9703) displayPrimary = '半';

  return {
    id: `k_${ctx.viewMode}_${rowIdx}_${colIdx}_${node.code ?? label}`,
    code: node.code,
    primary: displayPrimary,
    output,
    secondary: isAtKey ? '.com' : inlinePop.secondary || extPop.secondary,
    alts: mergedAlts,
    width: getDefaultKeyWidth(keyType, node.code, node.width),
    type: keyType,
    groupId: node.groupId,
  };
}

function mergeModifierRows(mainRows: RawKeyNode[][], modRows: RawKeyNode[][] | undefined): RawKeyNode[][] {
  if (!modRows || modRows.length === 0) return mainRows;
  const rowsCopy = mainRows.map((r) => [...r]);
  const modRow0 = modRows[0] || [];
  const hasPlaceholder = modRow0.some((k) => k.code === 0 && k.type === 'placeholder');

  if (hasPlaceholder && rowsCopy.length > 0) {
    const lastMainRow = rowsCopy.pop()!;
    const mergedLastRow: RawKeyNode[] = [];
    for (const k of modRow0) {
      if (k.code === 0 && k.type === 'placeholder') {
        mergedLastRow.push(...lastMainRow);
      } else {
        mergedLastRow.push(k);
      }
    }
    rowsCopy.push(mergedLastRow);
    // Append remaining modifier rows (bottom control bar)
    for (let i = 1; i < modRows.length; i++) {
      rowsCopy.push(modRows[i]);
    }
  } else {
    rowsCopy.push(...modRows);
  }
  return rowsCopy;
}

function getNumericRowNodes(numberStyle: NumberStyle, langNumericRowId: string): RawKeyNode[] {
  const idMap: Record<NumberStyle, string> = {
    latin: 'latin',
    kurdish: 'arabi_kurdi',
    urdu_farsi: 'urdu_farsi',
    hindi: 'hindi',
  };
  const targetId = idMap[numberStyle] || langNumericRowId || 'latin';
  const rows = bundle.layouts.numericRow[targetId] || bundle.layouts.numericRow.latin;
  return rows?.[0] || [];
}

export function resolveLayoutRows(
  langConfig: LanguageConfig,
  viewMode: KeyboardViewMode,
  shiftState: 'off' | 'once' | 'caps',
  kanaMode: 'hira' | 'kata',
  settings: KeyboardSettings
): { rows: KeySpec[][]; direction: 'rtl' | 'ltr' } {
  const manifestItem = manifestCharMap.get(langConfig.characterLayoutId);
  const direction: 'rtl' | 'ltr' =
    langConfig.characterLayoutId === 'kurdi_hybrid'
      ? kanaMode === 'kata'
        ? 'ltr'
        : 'rtl'
      : manifestItem?.direction || langConfig.dir;

  const isQwertyKurdi = langConfig.characterLayoutId === 'qwerty_kurdi';
  const currencySlots = getCurrencySlots(langConfig.currencySetId);

  let rawRows: RawKeyNode[][] = [];

  if (viewMode === 'characters') {
    const baseMain =
      bundle.layouts.characters[langConfig.characterLayoutId] ||
      bundle.layouts.characters.kurdi_qvfgh;

    // Apply custom user layout overrides if saved for this layoutId
    const customOverride = settings.customLayouts[langConfig.characterLayoutId];
    let mainWithOverrides: RawKeyNode[][] = baseMain.map((r) => r.map((k) => ({ ...k })));
    if (customOverride && customOverride.length === mainWithOverrides.length) {
      mainWithOverrides = mainWithOverrides.map((row, rIdx) => {
        const customRow = customOverride[rIdx];
        if (!customRow) return row;
        let cCursor = 0;
        return row.map((node) => {
          const resolved = resolveRawNode(node, direction, 'off', kanaMode);
          const t = mapKeyCodeToType(resolved?.code, resolved?.label || '');
          if (t === 'char' && cCursor < customRow.length) {
            const nextChar = customRow[cCursor++];
            return {
              ...node,
              $: undefined,
              code: nextChar.codePointAt(0),
              label: nextChar,
            };
          }
          return node;
        });
      });
    }

    // Determine bottom modifier row (user preset or layout's authentic modifier)
    const defaultModId = stripNs(manifestItem?.modifier, 'default');
    const chosenModId =
      settings.bottomRowPreset === 'auto'
        ? defaultModId
        : settings.bottomRowPreset;
    const modRows =
      bundle.layouts.charactersMod[chosenModId] ||
      bundle.layouts.charactersMod[defaultModId] ||
      bundle.layouts.charactersMod.default;

    rawRows = mergeModifierRows(mainWithOverrides, modRows);

    // Prepend numeric row if enabled for this language
    if (langConfig.numberRow) {
      const numNodes =
        langConfig.characterLayoutId === 'kurdi_hybrid'
          ? (bundle.layouts.numericRow.kurdi_hybrid?.[0] || getNumericRowNodes(settings.numberStyle, langConfig.numericRowId))
          : getNumericRowNodes(settings.numberStyle, langConfig.numericRowId);
      rawRows = [numNodes, ...rawRows];
    }
  } else if (viewMode === 'symbols') {
    const symBase =
      bundle.layouts.symbols[langConfig.symbolsLayoutId] ||
      bundle.layouts.symbols.sym_alt;
    const symMod =
      langConfig.symbolsLayoutId === 'cjk'
        ? bundle.layouts.symbolsMod.cjk || bundle.layouts.symbolsMod.default
        : bundle.layouts.symbolsMod.default;
    const numNodes = getNumericRowNodes(settings.numberStyle, langConfig.numericRowId);
    rawRows = [numNodes, ...mergeModifierRows(symBase, symMod)];
  } else if (viewMode === 'symbols2') {
    const sym2Base =
      bundle.layouts.symbols2[langConfig.symbols2LayoutId] ||
      bundle.layouts.symbols2.sym_alt;
    const sym2Mod =
      langConfig.symbols2LayoutId === 'cjk'
        ? bundle.layouts.symbols2Mod.cjk || bundle.layouts.symbols2Mod.default
        : bundle.layouts.symbols2Mod.default;
    const numNodes = getNumericRowNodes(settings.numberStyle, langConfig.numericRowId);
    rawRows = [numNodes, ...mergeModifierRows(sym2Base, sym2Mod)];
  } else if (viewMode === 'numeric_advanced') {
    const numAdvId =
      settings.numberStyle === 'kurdish'
        ? 'kurdi_arabi'
        : settings.numberStyle === 'urdu_farsi'
        ? 'urdu_farsi'
        : langConfig.numericAdvancedId || 'latin';
    rawRows =
      bundle.layouts.numericAdvanced[numAdvId] ||
      bundle.layouts.numericAdvanced.latin;
  } else if (viewMode === 'phone') {
    rawRows = bundle.layouts.phone.telpad;
  } else if (viewMode === 'phone2') {
    rawRows = bundle.layouts.phone2.telpad;
  }

  // Convert all rows to KeySpec[][]
  const ctx = {
    dir: direction,
    shiftState,
    kanaMode,
    popupMappingId: langConfig.popupMappingId,
    currencySlots,
    isQwertyKurdi,
    viewMode,
  };

  let specRows: KeySpec[][] = rawRows.map((row, rIdx) => {
    const converted: KeySpec[] = [];
    row.forEach((rawKey, cIdx) => {
      const spec = convertRawKeyToSpec(rawKey, rIdx, cIdx, ctx);
      if (spec) converted.push(spec);
    });
    return converted;
  });

  // When number row is OFF on a 10-key top letter row, surface 1..0 as corner hints & long-press options (matching original KurdiKeyboard)
  if (
    viewMode === 'characters' &&
    !langConfig.numberRow &&
    specRows[0] &&
    specRows[0].length === 10
  ) {
    const numNodes =
      langConfig.characterLayoutId === 'kurdi_hybrid'
        ? bundle.layouts.numericRow.kurdi_hybrid?.[0] ||
          getNumericRowNodes(settings.numberStyle, langConfig.numericRowId)
        : getNumericRowNodes(settings.numberStyle, langConfig.numericRowId);
    if (numNodes.length === 10) {
      specRows[0] = specRows[0].map((k, idx) => {
        const numResolved = resolveRawNode(numNodes[idx], direction, 'off', kanaMode);
        const digit = numResolved ? parseDisplayAndOutput(numResolved, false).label : '';
        if (!digit) return k;
        const existingAlts = k.alts || [];
        const hasDigit = existingAlts.some((a) =>
          typeof a === 'string' ? a === digit : a.value === digit
        );
        return {
          ...k,
          secondary: digit,
          alts: hasDigit
            ? existingAlts
            : [{ label: digit, value: digit }, ...existingAlts],
        };
      });
    }
  }

  // Apply user's bottom-row visibility/swap preferences on the final control row in characters mode
  if (viewMode === 'characters' && specRows.length > 0) {
    const lastIdx = specRows.length - 1;
    let bottomRow = [...specRows[lastIdx]];

    if (!settings.showBottomKeys) {
      bottomRow = bottomRow.filter(
        (k) =>
          k.type === 'symbols' ||
          k.type === 'space' ||
          k.type === 'enter' ||
          k.type === 'backspace' ||
          k.type === 'kana_toggle'
      );
    } else {
      if (!settings.showGlobeKey) {
        bottomRow = bottomRow.filter((k) => k.type !== 'globe');
      }
      if (!settings.showEmojiKey) {
        bottomRow = bottomRow.filter((k) => k.type !== 'emoji');
      }
      if (!settings.showCommaKey) {
        bottomRow = bottomRow.filter((k) => k.type !== 'comma');
      }
      if (settings.swapGlobeAndEmoji) {
        const gIdx = bottomRow.findIndex((k) => k.type === 'globe');
        const eIdx = bottomRow.findIndex((k) => k.type === 'emoji');
        if (gIdx !== -1 && eIdx !== -1) {
          [bottomRow[gIdx], bottomRow[eIdx]] = [bottomRow[eIdx], bottomRow[gIdx]];
        }
      }
    }
    specRows[lastIdx] = bottomRow;
  }

  return { rows: specRows, direction };
}

/**
 * Extract editable character-only rows for LayoutEditorScreen
 */
export function getEditableAlphaRows(
  layoutId: string,
  customLayouts?: Record<string, string[][]>
): string[][] {
  if (customLayouts?.[layoutId]) {
    return customLayouts[layoutId].map((r) => [...r]);
  }
  const baseMain = bundle.layouts.characters[layoutId] || bundle.layouts.characters.kurdi_qvfgh;
  const dir = manifestCharMap.get(layoutId)?.direction || 'ltr';
  return baseMain.map((row) => {
    const chars: string[] = [];
    for (const node of row) {
      const resolved = resolveRawNode(node, dir, 'off', 'hira');
      if (!resolved) continue;
      const t = mapKeyCodeToType(resolved.code, resolved.label || '');
      if (t === 'char') {
        const { label } = parseDisplayAndOutput(resolved, false);
        chars.push(label);
      }
    }
    return chars;
  });
}

/**
 * Authentic Hangul Unicode Jamo syllable composer for Korean layout (com.kurdikeyboard.composers:hangul-unicode)
 */
const CHOSEONG = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const JUNGSEONG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
const JONGSEONG = '\0ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ';

const COMPOUND_VOWELS: Record<string, string> = {
  'ㅗㅏ': 'ㅘ', 'ㅗㅐ': 'ㅙ', 'ㅗㅣ': 'ㅚ',
  'ㅜㅓ': 'ㅝ', 'ㅜㅔ': 'ㅞ', 'ㅜㅣ': 'ㅟ',
  'ㅡㅣ': 'ㅢ',
};

const COMPOUND_JONG: Record<string, string> = {
  'ㄱㅅ': 'ㄳ', 'ㄴㅈ': 'ㄵ', 'ㄴㅎ': 'ㄶ',
  'ㄹㄱ': 'ㄺ', 'ㄹㅁ': 'ㄻ', 'ㄹㅂ': 'ㄼ', 'ㄹㅅ': 'ㄽ', 'ㄹㅌ': 'ㄾ', 'ㄹㅍ': 'ㄿ', 'ㄹㅎ': 'ㅀ',
  'ㅂㅅ': 'ㅄ',
};

export function composeHangul(prevText: string, jamo: string): { replaceLen: number; text: string } {
  if (!prevText || jamo.length !== 1) return { replaceLen: 0, text: jamo };
  const last = prevText[prevText.length - 1];
  const lastCode = last.charCodeAt(0);
  const jungIdx = JUNGSEONG.indexOf(jamo);
  const choIdx = CHOSEONG.indexOf(jamo);

  // Case 1: Last char is a lone consonant and new char is a vowel -> compose syllable
  if (jungIdx >= 0 && CHOSEONG.indexOf(last) >= 0) {
    const c = CHOSEONG.indexOf(last);
    const syl = String.fromCharCode(0xac00 + c * 588 + jungIdx * 28);
    return { replaceLen: 1, text: syl };
  }

  // Case 2: Last char is already a Hangul syllable (AC00..D7A3)
  if (lastCode >= 0xac00 && lastCode <= 0xd7a3) {
    const sIdx = lastCode - 0xac00;
    const c = Math.floor(sIdx / 588);
    const v = Math.floor((sIdx % 588) / 28);
    const t = sIdx % 28;

    // Adding a vowel
    if (jungIdx >= 0) {
      if (t === 0) {
        const comb = COMPOUND_VOWELS[JUNGSEONG[v] + jamo];
        if (comb) {
          const newV = JUNGSEONG.indexOf(comb);
          return { replaceLen: 1, text: String.fromCharCode(0xac00 + c * 588 + newV * 28) };
        }
      } else {
        // Move trailing consonant to next syllable's initial consonant
        const trailingChar = JONGSEONG[t];
        const nextCho = CHOSEONG.indexOf(trailingChar);
        if (nextCho >= 0) {
          const prevSyl = String.fromCharCode(0xac00 + c * 588 + v * 28);
          const nextSyl = String.fromCharCode(0xac00 + nextCho * 588 + jungIdx * 28);
          return { replaceLen: 1, text: prevSyl + nextSyl };
        }
      }
    }

    // Adding a consonant as jongseong
    if (choIdx >= 0) {
      if (t === 0) {
        const jIdx = JONGSEONG.indexOf(jamo);
        if (jIdx > 0) {
          return { replaceLen: 1, text: String.fromCharCode(0xac00 + c * 588 + v * 28 + jIdx) };
        }
      } else {
        const comb = COMPOUND_JONG[JONGSEONG[t] + jamo];
        if (comb) {
          const newT = JONGSEONG.indexOf(comb);
          return { replaceLen: 1, text: String.fromCharCode(0xac00 + c * 588 + v * 28 + newT) };
        }
      }
    }
  }

  return { replaceLen: 0, text: jamo };
}
