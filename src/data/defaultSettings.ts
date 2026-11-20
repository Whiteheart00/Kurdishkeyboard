import { ClipboardItem, KeyboardSettings } from '../types/keyboard';
import { DEFAULT_CUSTOM_THEME } from './themes';
import { findSubtypePreset } from './layouts';

export const DEFAULT_TOOLS_ORDER = [
  'translate',
  'resize',
  'decorate',
  'themes',
  'voice',
  'settings',
  'redo',
  'undo',
  'one_handed',
  'switch_lang',
  'ai_smart',
  'clipboard',
];

export const DEFAULT_SETTINGS: KeyboardSettings = {
  notificationsEnabled: false,
  proUnlocked: false,
  ratingDismissed: false,
  userRating: 0,
  appLanguage: 'ckb',
  appTheme: 'amoled',
  appAccentColor: '#2990FF',

  activeThemeId: 'amoled_cobalt',
  keyShapeStyle: 'default',
  downloadedThemeIds: [],
  customTheme: DEFAULT_CUSTOM_THEME,
  keyboardThemeMode: 'dark',
  fontStyle: 'kurdifont2',
  fontSizePercent: 130,
  iconSizePercent: 130,
  keySpacingPercent: 100,
  keyboardHeightPx: 292,
  numberStyle: 'latin',

  keyAnimation: true,
  dynamicBackgroundGlow: false,
  keyPopupPreview: true,
  showSecondaryHints: true,
  showTopToolbar: true,
  showBottomKeys: true,
  bottomRowPreset: 'auto',
  showGlobeKey: true,
  showLanguagePickerOnLongPress: true,
  showEmojiKey: true,
  showCommaKey: true,
  swapGlobeAndEmoji: false,
  spacebarLabelMode: 'language',
  customSpacebarText: 'تەختەکلیلی کوردی',
  oneHandedMode: 'off',

  enabledLanguages: [
    findSubtypePreset('ckb'),
    findSubtypePreset('en'),
  ],
  activeLanguage: 'ckb',

  smartReplyEnabled: true,
  aiTextSource: 'selected_or_all',
  translationEngine: 'google_fast',
  aiServerUrl: '',

  emojiStyle: 'system',
  emojiSkinTone: '',
  emojiSuggestions: true,
  emojiHistoryEnabled: true,
  emojiColumns: 7,
  recentEmojis: ['😂', '❤️', '🙏', '😍', '🔥', '🥹', '👋'],
  recentZikr: [
    'السَّلَاْمُ ‌عَلَیْکُم وَرَحْمَـةُ اللّٰهِ وَبَرَکَـاتُه‌',
    'بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ',
    'جَزَاكَ اللَّهُ خَيْرًا',
    'اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ',
  ],
  recentKaomoji: ['¯\\_(ツ)_/¯', '( ͡° ͜ʖ ͡°)', '(*^^*)♡', '( ಠ_ಠ )'],

  clipboardEnabled: true,
  clipboardHistoryEnabled: true,
  clipboardSuggestLatest: true,
  clipboardSuggestLimit60s: false,
  clipboardAutoDeleteOld: false,
  clipboardMaxItems: 20,

  soundEnabled: true,
  soundPack: 'modern',
  soundVolume: 0.75,
  vibrationEnabled: true,

  swipeUpAction: 'shift',
  swipeDownAction: 'hide',
  swipeLeftAction: 'next_lang',
  swipeRightAction: 'prev_lang',
  spacebarSwipeAction: 'switch_lang',
  backspaceSwipeDeleteWord: true,

  wordSuggestions: true,
  autoComplete: false,
  doubleSpacePeriod: true,
  personalDictionaryEnabled: true,
  personalDictionary: ['تەختەکلیلی کوردی', 'بەخێربێن', 'دەستخۆش'],
  textShortcutsEnabled: true,
  textShortcuts: [
    { id: 'sc_1', shortcut: 'س', expansion: 'السَّلَاْمُ عَلَیْکُم براکەم' },
    { id: 'sc_2', shortcut: 'وس', expansion: 'وَعَلَيْكُمُ السَّلَامُ وَرَحْمَةُ اللَّهِ وَبَرَكَاتُهُ' },
    { id: 'sc_3', shortcut: 'جز', expansion: 'جَزَاكَ اللَّهُ خَيْرًا' },
  ],

  physicalKeyboardSync: true,
  toolsOrder: DEFAULT_TOOLS_ORDER,
  customLayouts: {},
};

export const INITIAL_CLIPBOARD: ClipboardItem[] = [
  {
    id: 'clip_1',
    text: 'سڵاو، هیوادارم ڕۆژێکی خۆشت هەبێت!',
    timestamp: Date.now() - 1000 * 60 * 3,
    pinned: true,
  },
  {
    id: 'clip_2',
    text: 'www.kurdikebord.io',
    timestamp: Date.now() - 1000 * 60 * 12,
  },
  {
    id: 'clip_3',
    text: 'جَزَاكَ اللَّهُ خَيْرًا، دەستەکانت خۆش بێت.',
    timestamp: Date.now() - 1000 * 60 * 25,
  },
];
