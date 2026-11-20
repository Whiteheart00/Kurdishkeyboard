export type LanguageCode = string;
export type AppLanguageCode = 'ckb' | 'kmr' | 'en';

export type KeyShapeStyle =
  | 'default'
  | 'flat'
  | 'three_dimensional'
  | 'pill_rounded'
  | 'glass_crystal'
  | 'outline_only'
  | 'borderless'
  | 'soft_neumorphic'
  | 'animated_glow';

export type SettingsRoute =
  | 'home'
  | 'languages'
  | 'ai_settings'
  | 'themes'
  | 'theme_store'
  | 'custom_theme'
  | 'keyboard_prefs'
  | 'emoji_settings'
  | 'layout_editor'
  | 'clipboard_settings'
  | 'sound_vibration'
  | 'gestures'
  | 'predictions'
  | 'more_settings'
  | 'faq'
  | 'about';

export type KeyboardFontStyle =
  | 'kurdifont2'
  | 'kurdifont5'
  | 'kurdifont1'
  | 'kurdifont3'
  | 'kurdifont4'
  | 'kurdifont6'
  | 'kurdifont7'
  | 'kurdifont8'
  | 'kurdifont9'
  | 'kurdifont10'
  | 'system'
  | 'vazir'
  | 'naskh'
  | 'kufi'
  | 'amiri';

export type NumberStyle = 'latin' | 'kurdish' | 'urdu_farsi' | 'hindi';
export type AppThemeMode = 'amoled' | 'dark' | 'light';
export type KeyboardThemeMode = 'dark' | 'light' | 'auto';
export type TranslationEngine = 'google_fast' | 'ai_fluent';
export type SpacebarLabelMode = 'language' | 'none' | 'custom';
export type OneHandedMode = 'off' | 'left' | 'right';
export type EmojiStyleMode = 'system' | 'rounded' | 'minimal' | 'classic';
export type SoundPackId = 'modern' | 'blip' | 'surface' | 'traditional' | 'synth';
export type BottomRowPresetId =
  | 'auto'
  | 'default'
  | 'kurdish'
  | 'bottom_row_compact'
  | 'bottom_row_simple'
  | 'bottom_row_anysoft_classic'
  | 'bottom_row_full'
  | 'bottom_row_left_handed'
  | 'bottom_row_right_handed';

export type KeyboardViewMode =
  | 'characters'
  | 'symbols'
  | 'symbols2'
  | 'numeric_advanced'
  | 'phone'
  | 'phone2';

export interface PopupOption {
  label: string;
  value: string;
  code?: number;
}

export type KeyType =
  | 'char'
  | 'shift'
  | 'backspace'
  | 'space'
  | 'enter'
  | 'symbols'
  | 'symbols2'
  | 'characters'
  | 'numeric_advanced'
  | 'phone'
  | 'phone2'
  | 'emoji'
  | 'globe'
  | 'comma'
  | 'period'
  | 'zwnj'
  | 'sym_toggle'
  | 'kana_toggle'
  | 'settings'
  | 'copy'
  | 'cut'
  | 'paste'
  | 'select_all'
  | 'compact_left';

export interface KeySpec {
  id: string;
  code?: number;
  primary: string;
  output?: string; // Exact string inserted if different from display label (e.g., qwerty_kurdi or display|output)
  shiftPrimary?: string;
  secondary?: string; // Top-right hint shown on key
  alts?: (string | PopupOption)[]; // Long-press options
  width?: number; // Flex weight, default 1
  type?: KeyType;
  groupId?: number;
}

export interface KeyboardTheme {
  id: string;
  name: string;
  nameKu: string;
  isStore?: boolean;
  isPro?: boolean;
  isLight?: boolean;
  bg: string;
  toolbarBg: string;
  keyBg: string;
  keyHoverBg: string;
  keyBorder: string;
  keyBorderWidth?: number;
  keyText: string;
  secondaryText: string;
  specialKeyBg: string;
  specialKeyText: string;
  shiftBg?: string;
  shiftText?: string;
  backspaceBg?: string;
  backspaceText?: string;
  symbolsBg?: string;
  symbolsText?: string;
  enterBg: string;
  enterText: string;
  enterBorder?: string;
  spaceBg: string;
  spaceText?: string;
  popupBg?: string;
  popupBorder?: string;
  keyShadow?: string;
  accent: string;
  borderRadius: number;
  hasKeyBorder?: boolean;
}

export interface TextShortcut {
  id: string;
  shortcut: string;
  expansion: string;
}

export interface ClipboardItem {
  id: string;
  text: string;
  timestamp: number;
  pinned?: boolean;
}

export interface LanguageConfig {
  code: LanguageCode;
  name: string;
  nativeName: string;
  subtitle: string;
  numberRow: boolean;
  dir: 'rtl' | 'ltr';
  characterLayoutId: string;
  popupMappingId: string;
  currencySetId: string;
  symbolsLayoutId: string;
  symbols2LayoutId: string;
  numericRowId: string;
  numericAdvancedId: string;
  composerId?: string;
}

export interface KeyboardSettings {
  // General & Notifications
  notificationsEnabled: boolean;
  proUnlocked: boolean;
  ratingDismissed: boolean;
  userRating: number;
  appLanguage: AppLanguageCode;
  appTheme: AppThemeMode;
  appAccentColor: string;

  // Theme & Appearance
  activeThemeId: string;
  keyShapeStyle: KeyShapeStyle;
  downloadedThemeIds: string[];
  customTheme: KeyboardTheme;
  keyboardThemeMode: KeyboardThemeMode;
  fontStyle: KeyboardFontStyle;
  fontSizePercent: number; // 80 - 160
  iconSizePercent: number; // 80 - 160
  keySpacingPercent: number; // 50 - 150
  keyboardHeightPx: number; // 240 - 360
  numberStyle: NumberStyle;

  // Key Visuals & Bottom Row
  keyAnimation: boolean;
  dynamicBackgroundGlow: boolean;
  keyPopupPreview: boolean;
  showSecondaryHints: boolean;
  showTopToolbar: boolean;
  showBottomKeys: boolean;
  bottomRowPreset: BottomRowPresetId;
  showGlobeKey: boolean;
  showLanguagePickerOnLongPress: boolean;
  showEmojiKey: boolean;
  showCommaKey: boolean;
  swapGlobeAndEmoji: boolean;
  spacebarLabelMode: SpacebarLabelMode;
  customSpacebarText: string;
  oneHandedMode: OneHandedMode;

  // Languages
  enabledLanguages: LanguageConfig[];
  activeLanguage: LanguageCode;

  // AI & Translation
  smartReplyEnabled: boolean;
  aiTextSource: 'selected_or_all' | 'all';
  translationEngine: TranslationEngine;

  // Emoji & Zikr
  emojiStyle: EmojiStyleMode;
  emojiSkinTone: string;
  emojiSuggestions: boolean;
  emojiHistoryEnabled: boolean;
  emojiColumns: number;
  recentEmojis: string[];
  recentZikr: string[];
  recentKaomoji: string[];

  // Clipboard
  clipboardEnabled: boolean;
  clipboardHistoryEnabled: boolean;
  clipboardSuggestLatest: boolean;
  clipboardSuggestLimit60s: boolean;
  clipboardAutoDeleteOld: boolean;
  clipboardMaxItems: number;

  // Sound & Vibration
  soundEnabled: boolean;
  soundPack: SoundPackId;
  soundVolume: number; // 0.1 - 1.0
  vibrationEnabled: boolean;

  // Gestures
  swipeUpAction: 'shift' | 'none' | 'numbers';
  swipeDownAction: 'hide' | 'none';
  swipeLeftAction: 'next_lang' | 'prev_lang' | 'none';
  swipeRightAction: 'prev_lang' | 'next_lang' | 'none';
  spacebarSwipeAction: 'switch_lang' | 'move_cursor' | 'none';
  backspaceSwipeDeleteWord: boolean;

  // Predictions & Dictionary
  wordSuggestions: boolean;
  autoComplete: boolean;
  doubleSpacePeriod: boolean;
  personalDictionaryEnabled: boolean;
  personalDictionary: string[];
  textShortcutsEnabled: boolean;
  textShortcuts: TextShortcut[];

  // External Keyboard & Tools Order
  physicalKeyboardSync: boolean;
  toolsOrder: string[];

  // Custom Layouts (per layout id, rows of primary strings)
  customLayouts: Record<string, string[][]>;
}
