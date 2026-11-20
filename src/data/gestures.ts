import { AppLanguageCode, PopupOption, SwipeAction } from '../types/keyboard';
import { tOfficial } from './officialData';

export const ALL_SWIPE_ACTIONS: SwipeAction[] = [
  'no_action',
  'shift',
  'hide_keyboard',
  'switch_to_next_subtype',
  'switch_to_prev_subtype',
  'show_subtype_picker',
  'show_input_method_picker',
  'space_bar_custom_menu',
  'show_arabic_harakat',
  'move_cursor_left',
  'move_cursor_right',
  'move_cursor_up',
  'move_cursor_down',
  'move_cursor_start_of_line',
  'move_cursor_end_of_line',
  'move_cursor_start_of_page',
  'move_cursor_end_of_page',
  'delete_character',
  'delete_characters_precisely',
  'delete_word',
  'delete_words_precisely',
  'select_characters_precisely',
  'select_words_precisely',
  'undo',
  'redo',
  'insert_space',
  'switch_to_clipboard_context',
  'switch_to_media_context',
  'switch_to_symbols_keyboard',
  'switch_to_prev_keyboard',
  'cycle_to_next_keyboard_mode',
  'cycle_to_previous_keyboard_mode',
  'toggle_compact_layout',
  'toggle_smartbar_visibility',
];

export const GENERAL_SWIPE_ACTIONS: SwipeAction[] = [
  'no_action',
  'shift',
  'hide_keyboard',
  'switch_to_next_subtype',
  'switch_to_prev_subtype',
  'show_subtype_picker',
  'delete_word',
  'delete_character',
  'move_cursor_left',
  'move_cursor_right',
  'move_cursor_up',
  'move_cursor_down',
  'move_cursor_start_of_line',
  'move_cursor_end_of_line',
  'move_cursor_start_of_page',
  'move_cursor_end_of_page',
  'undo',
  'redo',
  'insert_space',
  'show_arabic_harakat',
  'space_bar_custom_menu',
  'switch_to_clipboard_context',
  'switch_to_media_context',
  'switch_to_symbols_keyboard',
  'cycle_to_next_keyboard_mode',
  'cycle_to_previous_keyboard_mode',
  'toggle_compact_layout',
  'toggle_smartbar_visibility',
  'switch_to_prev_keyboard',
  'show_input_method_picker',
];

export const SPACEBAR_SWIPE_ACTIONS: SwipeAction[] = [
  'no_action',
  'switch_to_next_subtype',
  'switch_to_prev_subtype',
  'move_cursor_left',
  'move_cursor_right',
  'move_cursor_up',
  'move_cursor_down',
  'move_cursor_start_of_line',
  'move_cursor_end_of_line',
  'show_subtype_picker',
  'space_bar_custom_menu',
  'show_arabic_harakat',
  'switch_to_clipboard_context',
  'switch_to_media_context',
  'switch_to_symbols_keyboard',
  'toggle_compact_layout',
  'toggle_smartbar_visibility',
  'undo',
  'redo',
  'hide_keyboard',
];

export const SPACEBAR_LONG_PRESS_ACTIONS: SwipeAction[] = [
  'no_action',
  'space_bar_custom_menu',
  'show_subtype_picker',
  'show_arabic_harakat',
  'show_input_method_picker',
  'switch_to_next_subtype',
  'switch_to_prev_subtype',
  'switch_to_clipboard_context',
  'switch_to_media_context',
  'switch_to_symbols_keyboard',
  'toggle_compact_layout',
  'toggle_smartbar_visibility',
  'hide_keyboard',
];

export const DELETE_SWIPE_LEFT_ACTIONS: SwipeAction[] = [
  'no_action',
  'delete_word',
  'delete_words_precisely',
  'delete_characters_precisely',
  'delete_character',
  'select_words_precisely',
  'select_characters_precisely',
  'undo',
];

export const DELETE_LONG_PRESS_ACTIONS: SwipeAction[] = [
  'no_action',
  'delete_character',
  'delete_word',
  'delete_characters_precisely',
  'delete_words_precisely',
];

export const SWIPE_DISTANCE_THRESHOLDS = [24, 32, 48, 64, 80] as const;
export const SWIPE_VELOCITY_THRESHOLDS = [100, 200, 350, 500, 700] as const;

const FALLBACK_LABELS_KU: Record<SwipeAction, string> = {
  no_action: 'هیچ فرمانێک',
  cycle_to_previous_keyboard_mode: 'گەڕانەوە بۆ شێوازی پێشوو',
  cycle_to_next_keyboard_mode: 'گەڕانەوە بۆ شێوازی دواتر',
  delete_character: 'سڕینەوەی پیتی پێش هێما',
  delete_characters_precisely: 'سڕینەوەی پیتەکان یەک بە یەک',
  delete_word: 'سڕینەوەی ووشەی پێش هێما',
  delete_words_precisely: 'سڕینەوەی ووشەکان یەک بە یەک',
  hide_keyboard: 'لابردنی تەختەکلیل',
  insert_space: 'زیادکردنی ماوە',
  move_cursor_up: 'بردن بۆ سەرەوە',
  move_cursor_down: 'بردن بۆ خوارەوە',
  move_cursor_left: 'بردن بۆ لای چەپ',
  move_cursor_right: 'بردن بۆ لای ڕاست',
  move_cursor_start_of_line: 'چوون بۆ سەرەتای ڕستە',
  move_cursor_end_of_line: 'چوون بۆ کۆتایی ڕستە',
  move_cursor_start_of_page: 'چوون بۆ سەرەتای پەڕە',
  move_cursor_end_of_page: 'چوون بۆ کۆتایی پەڕە',
  redo: 'هەنگاوێک پێشتر',
  select_characters_precisely: 'دیاریکردنی پیتەکان یەک بە یەک',
  select_words_precisely: 'دیاریکردنی ووشەکان یەک بە یەک',
  shift: 'گەورەکردن (Shift)',
  show_arabic_harakat: 'پیشاندانی حەرەکاتی عەرەبی',
  show_input_method_picker: 'گۆڕینی تەختەکلیل',
  show_subtype_picker: 'پیشاندانی لیستی زمانەکان',
  space_bar_custom_menu: 'پیشاندانی فرمانەکانی درێژکردنەوە و نیو بزوێن',
  switch_to_prev_subtype: 'گۆڕین بۆ زمانی پێشوو',
  switch_to_next_subtype: 'گۆڕین بۆ زمانی دواتر',
  switch_to_clipboard_context: 'کردنەوەی لەبەرگیراوەکان',
  switch_to_media_context: 'پیشاندانی ئیمۆجیەکان',
  switch_to_prev_keyboard: 'گۆڕین بۆ تەختەکلیلی پێشوو',
  switch_to_symbols_keyboard: 'پیشاندانی هێماکان',
  toggle_compact_layout: 'کردنەوەی دۆخی یەکدەست',
  toggle_smartbar_visibility: 'شاردنەوە/ پیشاندانی بەشی سەرەوە',
  undo: 'هەنگاوێک دواتر',
};

export function getSwipeActionLabel(
  action: SwipeAction,
  appLanguage: AppLanguageCode | string | undefined
): string {
  return tOfficial(
    appLanguage,
    `enum__swipe_action__${action}`,
    FALLBACK_LABELS_KU[action] || action
  );
}

export function normalizeSwipeAction(
  raw: unknown,
  fallback: SwipeAction
): SwipeAction {
  if (typeof raw !== 'string') return fallback;
  if (ALL_SWIPE_ACTIONS.includes(raw as SwipeAction)) {
    return raw as SwipeAction;
  }
  switch (raw) {
    case 'none':
      return 'no_action';
    case 'hide':
      return 'hide_keyboard';
    case 'numbers':
      return 'switch_to_symbols_keyboard';
    case 'next_lang':
      return 'switch_to_next_subtype';
    case 'prev_lang':
      return 'switch_to_prev_subtype';
    default:
      return fallback;
  }
}

export const ARABIC_HARAKAT_OPTIONS: PopupOption[] = [
  { label: 'ـَ فەتحە', value: '\u064E' },
  { label: 'ـُ زەممە', value: '\u064F' },
  { label: 'ـِ کەسرە', value: '\u0650' },
  { label: 'ـّ شەددە', value: '\u0651' },
  { label: 'ـْ سکون', value: '\u0652' },
  { label: 'ـً تەنوین', value: '\u064B' },
  { label: 'ـٌ تەنوین', value: '\u064C' },
  { label: 'ـٍ تەنوین', value: '\u064D' },
  { label: 'ـٰ ئەلف', value: '\u0670' },
  { label: 'ـٓ مەددە', value: '\u0653' },
  { label: 'ئـ ء', value: 'ء' },
];

export const SPACEBAR_CUSTOM_MENU_OPTIONS: PopupOption[] = [
  { label: 'ـ درێژکردنەوە', value: 'ـ' },
  { label: 'ـ ـ ـ درێژ', value: 'ـــ' },
  { label: 'نیوبزوێن (ZWNJ)', value: '\u200C' },
  { label: '«»', value: '«»' },
  { label: '—', value: '—' },
  { label: '…', value: '…' },
  { label: '،', value: '،' },
  { label: '؟', value: '؟' },
];
