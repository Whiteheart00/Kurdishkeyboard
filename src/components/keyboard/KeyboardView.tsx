import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  ArrowRight,
  Calculator,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Maximize2,
  MicOff,
  MoveVertical,
  RotateCcw,
  Search,
  Send,
  X,
} from 'lucide-react';
import {
  ClipboardItem,
  KeyboardSettings,
  KeyboardViewMode,
  KeySpec,
  LanguageCode,
  PopupOption,
  SettingsRoute,
  SwipeAction,
} from '../../types/keyboard';
import { ARABIC_HARAKAT_OPTIONS, SPACEBAR_CUSTOM_MENU_OPTIONS } from '../../data/gestures';
import { findThemeById } from '../../data/themes';
import { composeHangul, EMAIL_DOMAIN_POPUP_OPTIONS, resolveLayoutRows } from '../../data/layouts';
import {
  EMOJI_CATEGORIES,
  EMOJI_KEYWORD_MAP,
  EMOJI_NAME_LOOKUP,
  searchEmojis,
  TEXT_DECORATORS,
} from '../../data/richContent';
import { recordHistoryUsage } from '../../utils/emojiHistory';
import {
  buildIndexedDictionary,
  getBaseDictionaryForLang,
  getNextWordPredictions,
  loadLearnedWords,
  normalizeForPrediction,
  queryDictionarySuggestions,
  saveLearnedWords,
} from '../../data/dictionaries';
import { getKeyShapeStyleProps } from '../../data/officialData';
import { detectInlineMath } from '../../utils/mathAndTime';
import { playKeyFeedback, preloadSoundPack } from '../../utils/sound';
import { KurdiIcon } from '../icons/KurdiIcons';
import {
  ActiveKeyboardPanel,
  ClipboardPanel,
  EmojiZikrKaomojiPanel,
  QuickThemesPanel,
  ResizePanel,
  RichInsertSource,
  RichTab,
  SmartAIPanel,
  TextDecoratorPanel,
  ToolsGridPanel,
  TranslatePanel,
} from './KeyboardPanels';
import { CursorControlPanel, SnippetsCalcPanel } from './PowerPanels';
import { getTranslationLang } from '../../data/translationLanguages';
import { TranslationLanguagePicker } from './TranslationLanguagePicker';

const readSavedTranslateLang = (key: string, fallback: string) => {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
};

interface KeyboardViewProps {
  settings: KeyboardSettings;
  onUpdateSettings: (patch: Partial<KeyboardSettings>) => void;
  editorText: string;
  onInsertText: (text: string) => void;
  onReplaceText: (text: string) => void;
  onReplaceAllText?: (text: string) => void;
  onBackspace: () => void;
  onDeleteWord: () => void;
  onMoveCursor: (delta: number) => void;
  onMoveCursorEx?: (dx: number, dy: number, select: boolean) => void;
  onMoveLineEdge?: (toEnd: boolean, select: boolean) => void;
  onSelectAll: () => void;
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onEnter: () => void;
  clipboardItems: ClipboardItem[];
  onSaveToClipboard: (text: string) => void;
  onTogglePinClipboard: (id: string) => void;
  onEditClipboard: (id: string, newText: string) => void;
  onDeleteClipboard: (id: string) => void;
  onClearUnpinnedClipboard: () => void;
  onOpenSettingsRoute: (route: SettingsRoute) => void;
  onHideKeyboard?: () => void;
  highlightedPhysicalKey?: string | null;
}

export const KeyboardView: React.FC<KeyboardViewProps> = ({
  settings,
  onUpdateSettings,
  editorText,
  onInsertText,
  onReplaceText,
  onReplaceAllText,
  onBackspace,
  onDeleteWord,
  onMoveCursor,
  onMoveCursorEx,
  onMoveLineEdge,
  onSelectAll,
  onCopy,
  onCut,
  onPaste,
  onUndo,
  onRedo,
  onEnter,
  clipboardItems,
  onSaveToClipboard,
  onTogglePinClipboard,
  onEditClipboard,
  onDeleteClipboard,
  onClearUnpinnedClipboard,
  onOpenSettingsRoute,
  onHideKeyboard,
  highlightedPhysicalKey,
}) => {
  const [activePanel, setActivePanel] = useState<ActiveKeyboardPanel>('keys');
  const [richInitialTab, setRichInitialTab] = useState<RichTab>('emoji');
  const [snippetsCalcTab, setSnippetsCalcTab] = useState<'snippets' | 'calc'>('snippets');
  const [emojiSearchMode, setEmojiSearchMode] = useState<boolean>(false);
  const [emojiSearchQuery, setEmojiSearchQuery] = useState<string>('');
  const [liveTranslateMode, setLiveTranslateMode] = useState<boolean>(false);
  const [liveTranslateQuery, setLiveTranslateQuery] = useState<string>('');
  const [liveTranslateOutput, setLiveTranslateOutput] = useState<string>('');
  const [liveTranslateLoading, setLiveTranslateLoading] = useState<boolean>(false);
  const [liveTranslateSrc, setLiveTranslateSrc] = useState<string>(() =>
    readSavedTranslateLang('kurdi_tr_src', 'ckb')
  );
  const [liveTranslateTgt, setLiveTranslateTgt] = useState<string>(() =>
    readSavedTranslateLang('kurdi_tr_tgt', 'en')
  );
  const [liveTranslatePickingLang, setLiveTranslatePickingLang] = useState<'src' | 'tgt' | null>(
    null
  );
  const updateLiveSrc = (code: string) => {
    setLiveTranslateSrc(code);
    try {
      localStorage.setItem('kurdi_tr_src', code);
    } catch {
      // ignore storage errors
    }
  };
  const updateLiveTgt = (code: string) => {
    setLiveTranslateTgt(code);
    try {
      localStorage.setItem('kurdi_tr_tgt', code);
    } catch {
      // ignore storage errors
    }
  };
  const [translateInitialText, setTranslateInitialText] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<KeyboardViewMode>('characters');
  const [kanaMode, setKanaMode] = useState<'hira' | 'kata'>('hira');
  const [shiftState, setShiftState] = useState<'off' | 'once' | 'caps'>('off');
  const [activeDecoratorId, setActiveDecoratorId] = useState<string>('none');
  const [inlineResizeMode, setInlineResizeMode] = useState(false);
  const emojiSearchModeRef = useRef(false);
  emojiSearchModeRef.current = emojiSearchMode;
  const liveTranslateModeRef = useRef(false);
  liveTranslateModeRef.current = liveTranslateMode;
  const liveTranslateCacheRef = useRef<Map<string, string>>(new Map());
  const suggestionsScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (activePanel !== 'keys' && emojiSearchMode) {
      setEmojiSearchMode(false);
    }
    if (activePanel !== 'keys' && liveTranslateMode) {
      setLiveTranslateMode(false);
      setLiveTranslatePickingLang(null);
    }
    if (activePanel !== 'keys' && inlineResizeMode) {
      setInlineResizeMode(false);
    }
  }, [activePanel, emojiSearchMode, liveTranslateMode, inlineResizeMode]);

  // Debounced Direct Google Translate for Live Inline Translate Bar (~250ms debounce)
  useEffect(() => {
    if (!liveTranslateMode) return;
    const clean = liveTranslateQuery.trim();
    if (!clean) {
      setLiveTranslateOutput('');
      setLiveTranslateLoading(false);
      return;
    }

    const cacheKey = `${liveTranslateSrc}::${liveTranslateTgt}::${clean}`;
    const cached = liveTranslateCacheRef.current.get(cacheKey);
    if (cached) {
      setLiveTranslateOutput(cached);
      setLiveTranslateLoading(false);
      return;
    }

    const controller = new AbortController();
    setLiveTranslateLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(
          liveTranslateSrc
        )}&tl=${encodeURIComponent(liveTranslateTgt)}&dt=t&q=${encodeURIComponent(clean)}`;
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error('HTTP error');
        const data = await res.json();
        const translated =
          Array.isArray(data?.[0])
            ? data[0]
                .map((seg: unknown) => (Array.isArray(seg) && typeof seg[0] === 'string' ? seg[0] : ''))
                .join('')
                .trim()
            : '';
        if (translated) {
          if (liveTranslateCacheRef.current.size > 60) {
            const firstKey = liveTranslateCacheRef.current.keys().next().value;
            if (firstKey) liveTranslateCacheRef.current.delete(firstKey);
          }
          liveTranslateCacheRef.current.set(cacheKey, translated);
          setLiveTranslateOutput(translated);
        }
      } catch (err) {
        if ((err as { name?: string })?.name !== 'AbortError') {
          setLiveTranslateOutput('');
        }
      } finally {
        setLiveTranslateLoading(false);
      }
    }, 240);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [liveTranslateMode, liveTranslateQuery, liveTranslateSrc, liveTranslateTgt]);

  // O(1) tail slice so typing in long documents never slows down regex matching
  const editorTail = editorText.length > 80 ? editorText.slice(-80) : editorText;
  const inlineMath = useMemo(() => detectInlineMath(editorTail), [editorTail]);

  const emojiSearchResults = useMemo(() => {
    if (!emojiSearchMode) return [];
    const q = emojiSearchQuery.trim();
    if (q) {
      return searchEmojis(q, 48).map((e) => e.c);
    }
    const base = [
      ...settings.recentEmojis,
      ...(EMOJI_CATEGORIES[0]?.items.slice(0, 28).map((e) => e.c) || []),
    ];
    return Array.from(new Set(base)).slice(0, 36);
  }, [emojiSearchMode, emojiSearchQuery, settings.recentEmojis]);
  const [longPressMenu, setLongPressMenu] = useState<{
    keyId: string;
    options: PopupOption[];
    anchorRect: {
      left: number;
      top: number;
      width: number;
      height: number;
      deckWidth: number;
      deckHeight: number;
    };
    isPhrasePopup: boolean;
    isEmailPopup: boolean;
  } | null>(null);
  const [longPressActiveIdx, setLongPressActiveIdx] = useState<number>(0);
  const [gesturePopup, setGesturePopup] = useState<{
    title: string;
    options: PopupOption[];
  } | null>(null);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [isListeningVoice, setIsListeningVoice] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);

  const maxHalfScreenHeight = useMemo(() => {
    if (typeof window === 'undefined') return 440;
    const nativeScreenDp = window.AndroidIME?.getScreenHeightDp?.();
    if (nativeScreenDp && nativeScreenDp > 400) {
      // Half of total Android screen height (minus ~60dp for toolbar/suggestion bar)
      return Math.max(380, Math.min(540, Math.round(nativeScreenDp * 0.5)));
    }
    const dpr = window.devicePixelRatio || 1;
    const rawScreenH = window.screen?.height || 0;
    const cssScreenH = rawScreenH > 1200 && dpr > 1.2 ? rawScreenH / dpr : rawScreenH;
    const refH = Math.max(window.innerHeight || 0, cssScreenH || 840);
    return Math.max(380, Math.min(540, Math.round(refH * 0.5)));
  }, []);

  const deckContainerRef = useRef<HTMLDivElement | null>(null);
  const keyPreviewRef = useRef<HTMLDivElement | null>(null);
  const extendedPopupRef = useRef<HTMLDivElement | null>(null);
  const longPressMenuRef = useRef<typeof longPressMenu>(null);
  longPressMenuRef.current = longPressMenu;
  const longPressActiveIdxRef = useRef<number>(0);
  longPressActiveIdxRef.current = longPressActiveIdx;
  const activePointersRef = useRef<
    Map<
      number,
      {
        keyId: string;
        startX: number;
        startY: number;
        time: number;
        slidAway: boolean;
        keyRect: { left: number; right: number; top: number; bottom: number };
      }
    >
  >(new Map());
  const emailSlidRef = useRef<boolean>(false);
  const emojiLongPressedRef = useRef<boolean>(false);
  const resizeDragRef = useRef<{ pointerId: number; startY: number; startHeight: number } | null>(null);
  const deckGapSwipeRef = useRef<{ pointerId: number; startX: number; startY: number; time: number } | null>(null);
  const lastSpaceTapRef = useRef<number>(0);
  const lastShiftTapRef = useRef<number>(0);
  const longPressTimerRef = useRef<number | null>(null);
  const backspaceRepeatRef = useRef<number | null>(null);
  const spaceDragStartRef = useRef<{
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    time: number;
  } | null>(null);
  const spaceDraggedRef = useRef<boolean>(false);
  const spaceLongPressedRef = useRef<boolean>(false);
  const bkspDragStartXRef = useRef<{ startX: number; lastX: number } | null>(null);
  const bkspDraggedRef = useRef<boolean>(false);
  const speechRecRef = useRef<{ stop: () => void } | null>(null);

  const theme = useMemo(
    () => findThemeById(settings.activeThemeId, settings.customTheme),
    [settings.activeThemeId, settings.customTheme]
  );

  const activeLangConfig = useMemo(() => {
    return (
      settings.enabledLanguages.find((l) => l.code === settings.activeLanguage) ||
      settings.enabledLanguages[0]
    );
  }, [settings.enabledLanguages, settings.activeLanguage]);

  const fontClass = `font-style-${settings.fontStyle}`;

  // Preload active real sound pack on mount / change
  useEffect(() => {
    if (settings.soundEnabled) {
      preloadSoundPack(settings.soundPack);
    }
  }, [settings.soundEnabled, settings.soundPack]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
      if (backspaceRepeatRef.current) window.clearInterval(backspaceRepeatRef.current);
      if (speechRecRef.current) speechRecRef.current.stop();
    };
  }, []);

  const triggerSound = (type: 'char' | 'space' | 'backspace' | 'enter' | 'special') => {
    playKeyFeedback(
      type,
      settings.soundEnabled,
      settings.vibrationEnabled,
      settings.soundPack,
      settings.soundVolume
    );
  };

  const [learnedWordsMap, setLearnedWordsMap] = useState<Record<string, number>>(() =>
    loadLearnedWords()
  );

  const recordFinishedWord = (rawWord: string) => {
    if (!settings.personalDictionaryEnabled) return;
    const clean = rawWord.trim();
    if (clean.length < 2 || clean.length > 28) return;
    if (/^[0-9٠-٩۰-۹]+$/.test(clean)) return;
    setLearnedWordsMap((prev) => {
      const next = { ...prev, [clean]: (prev[clean] || 0) + 1 };
      saveLearnedWords(next);
      return next;
    });
  };

  // Compute current word & previous word in O(1) using editorTail
  const currentWord = useMemo(() => {
    const match = editorTail.match(/([^\s.,!?؟،:;()[\]{}"'«»]+)$/);
    return match ? match[1] : '';
  }, [editorTail]);

  const previousWord = useMemo(() => {
    if (currentWord) return '';
    const trimmed = editorTail.trimEnd();
    if (!trimmed) return '';
    const match = trimmed.match(/([^\s.,!?؟،:;()[\]{}"'«»]+)$/);
    return match ? match[1] : '';
  }, [editorTail, currentWord]);

  useEffect(() => {
    if (suggestionsScrollRef.current) {
      suggestionsScrollRef.current.scrollLeft = 0;
    }
  }, [currentWord]);

  const isLatinLike =
    activeLangConfig?.dir === 'ltr' &&
    activeLangConfig?.characterLayoutId !== 'qwerty_kurdi' &&
    !(activeLangConfig?.characterLayoutId === 'kurdi_hybrid' && kanaMode === 'hira');

  const indexedDictionaryPool = useMemo(() => {
    const base = getBaseDictionaryForLang(settings.activeLanguage, isLatinLike);
    const personal =
      settings.personalDictionaryEnabled && settings.personalDictionary.length > 0
        ? settings.personalDictionary
        : [];
    const learnedSorted = settings.personalDictionaryEnabled
      ? Object.entries(learnedWordsMap)
          .sort((a, b) => b[1] - a[1])
          .map(([word]) => word)
      : [];
    return buildIndexedDictionary([...personal, ...learnedSorted, ...base]);
  }, [
    settings.activeLanguage,
    isLatinLike,
    settings.personalDictionaryEnabled,
    settings.personalDictionary,
    learnedWordsMap,
  ]);

  const suggestions = useMemo(() => {
    const shortcutsEnabled = settings.textShortcutsEnabled ?? true;
    if (!settings.wordSuggestions && !shortcutsEnabled && !settings.emojiSuggestions) return [];

    const results: {
      value: string;
      displayLabel?: string;
      isShortcut?: boolean;
      shortcutKey?: string;
      isEmail?: boolean;
      isEmoji?: boolean;
      replaceLength?: number;
    }[] = [];
    const seen = new Set<string>();

    // 0. Live Email Domain Suggestions when typing after "@" (e.g. "name@" or "name@g")
    const emailMatch = editorTail.match(/([^\s]*@)([a-zA-Z0-9.-]*)$/);
    if (emailMatch) {
      const partialDomain = (emailMatch[2] || '').toLowerCase();
      for (const opt of EMAIL_DOMAIN_POPUP_OPTIONS) {
        const domainWithoutAt = opt.value.slice(1);
        if (!partialDomain || domainWithoutAt.startsWith(partialDomain)) {
          if (!seen.has(opt.value)) {
            seen.add(opt.value);
            results.push({ value: opt.value, isEmail: true });
            if (results.length >= 8) break;
          }
        }
      }
      if (results.length > 0) return results;
    }

    // 0.5 Leading-Colon Emoji Suggestions (e.g. ":دڵ" or ":heart")
    if (settings.emojiSuggestions && settings.emojiSuggestionType === 'leading_colon') {
      const colonMatch = editorTail.match(/:([^\s:]{1,24})$/);
      const minLen = Math.max(1, settings.emojiSuggestionQueryMinLength || 2);
      if (colonMatch && colonMatch[1].length >= minLen) {
        const q = colonMatch[1];
        const maxEmoji = Math.max(1, Math.min(5, settings.emojiSuggestionMaxCount || 3));
        const directHits =
          EMOJI_KEYWORD_MAP[q.toLowerCase()] ||
          EMOJI_KEYWORD_MAP[q] ||
          EMOJI_KEYWORD_MAP[normalizeForPrediction(q)] ||
          [];
        const fallbackHits =
          directHits.length < maxEmoji ? searchEmojis(q, maxEmoji + 2).map((e) => e.c) : [];
        const combined = Array.from(new Set([...directHits, ...fallbackHits])).slice(0, maxEmoji);
        for (const em of combined) {
          if (!seen.has(em)) {
            seen.add(em);
            const name = settings.emojiSuggestionShowName ? EMOJI_NAME_LOOKUP[em] : undefined;
            results.push({
              value: em,
              displayLabel: name ? `${em} ${name}` : em,
              isEmoji: true,
              replaceLength: colonMatch[0].length,
            });
          }
        }
        if (results.length > 0) return results;
      }
    }

    // 1. Custom Text Shortcuts (Exact match first, then prefix match)
    if (shortcutsEnabled && currentWord && Array.isArray(settings.textShortcuts)) {
      const lower = currentWord.toLowerCase();
      const normCurrent = normalizeForPrediction(currentWord);
      const exactMatches = settings.textShortcuts.filter((sc) => {
        const k = sc.shortcut.trim().toLowerCase();
        return k === lower || normalizeForPrediction(k) === normCurrent;
      });
      const prefixMatches = settings.textShortcuts.filter((sc) => {
        const k = sc.shortcut.trim().toLowerCase();
        return (
          k !== lower &&
          normalizeForPrediction(k) !== normCurrent &&
          (k.startsWith(lower) || normalizeForPrediction(k).startsWith(normCurrent))
        );
      });

      for (const sc of [...exactMatches, ...prefixMatches]) {
        if (sc.expansion && !seen.has(sc.expansion)) {
          seen.add(sc.expansion);
          results.push({
            value: sc.expansion,
            isShortcut: true,
            shortcutKey: sc.shortcut,
          });
          if (results.length >= 3) break;
        }
      }
    }

    if (!settings.wordSuggestions) {
      return results;
    }

    // 2. Inline-Text Emoji suggestions for current word
    if (
      settings.emojiSuggestions &&
      (settings.emojiSuggestionType || 'inline_text') === 'inline_text' &&
      currentWord &&
      currentWord.length >= Math.max(1, settings.emojiSuggestionQueryMinLength || 2)
    ) {
      const maxEmoji = Math.max(1, Math.min(5, settings.emojiSuggestionMaxCount || 3));
      const emojiHits =
        EMOJI_KEYWORD_MAP[currentWord.toLowerCase()] ||
        EMOJI_KEYWORD_MAP[currentWord] ||
        EMOJI_KEYWORD_MAP[normalizeForPrediction(currentWord)];
      if (emojiHits) {
        for (const em of emojiHits.slice(0, maxEmoji)) {
          if (!seen.has(em)) {
            seen.add(em);
            const name = settings.emojiSuggestionShowName ? EMOJI_NAME_LOOKUP[em] : undefined;
            results.push({
              value: em,
              displayLabel: name ? `${em} ${name}` : em,
              isEmoji: true,
            });
          }
        }
      }
    }

    if (currentWord) {
      const matches = queryDictionarySuggestions(indexedDictionaryPool, currentWord, 6, seen);
      for (const w of matches) {
        seen.add(w);
        results.push({ value: w });
      }
      // If user typed a brand-new word not in dictionary yet, still offer quick-save/confirm chip so bar never looks dead
      if (results.length === 0 && currentWord.length >= 2) {
        results.push({ value: currentWord });
      }
    } else {
      // Next-word bi-gram prediction right after a space (e.g. "سڵاو " -> "هاوڕێ", "چۆنیت"...)
      const nextWords = getNextWordPredictions(previousWord, settings.activeLanguage, isLatinLike);
      for (const w of nextWords) {
        if (!seen.has(w)) {
          seen.add(w);
          results.push({ value: w });
        }
      }

      const defaults =
        settings.activeLanguage === 'ar'
          ? ['السلام', 'شكرا', 'مرحبا', 'إن شاء الله']
          : settings.activeLanguage === 'fa'
          ? ['سلام', 'ممنون', 'خوبی', 'لطفا']
          : settings.activeLanguage === 'tr'
          ? ['Merhaba', 'Teşekkürler', 'Nasılsın', 'Tamam']
          : isLatinLike
          ? ['Hello', 'Thanks', 'Please', 'Kurdistan', 'Awesome']
          : ['سڵاو', 'سوپاس', 'چۆنیت', 'دەستخۆش', 'کوردستان'];
      for (const w of defaults) {
        if (!seen.has(w) && results.length < 6) {
          seen.add(w);
          results.push({ value: w });
        }
      }
    }

    return results.slice(0, 6);
  }, [
    editorTail,
    currentWord,
    previousWord,
    settings.activeLanguage,
    settings.wordSuggestions,
    settings.textShortcutsEnabled,
    settings.textShortcuts,
    settings.emojiSuggestions,
    settings.emojiSuggestionType,
    settings.emojiSuggestionQueryMinLength,
    settings.emojiSuggestionMaxCount,
    settings.emojiSuggestionShowName,
    indexedDictionaryPool,
    isLatinLike,
  ]);

  const latestClipboardSuggestion = useMemo(() => {
    if (!settings.clipboardEnabled || !settings.clipboardSuggestLatest) return null;
    const latest = clipboardItems[0];
    if (!latest) return null;
    if (settings.clipboardSuggestLimit60s && Date.now() - latest.timestamp > 60000) return null;
    return latest;
  }, [
    clipboardItems,
    settings.clipboardEnabled,
    settings.clipboardSuggestLatest,
    settings.clipboardSuggestLimit60s,
  ]);

  const cycleLanguage = (direction: 1 | -1 = 1) => {
    const langs = settings.enabledLanguages;
    if (langs.length <= 1) return;
    const idx = langs.findIndex((l) => l.code === settings.activeLanguage);
    const nextIdx = (idx + direction + langs.length) % langs.length;
    onUpdateSettings({ activeLanguage: langs[nextIdx].code });
    setViewMode('characters');
    setShiftState('off');
    triggerSound('special');
  };

  const executeSwipeAction = (action: SwipeAction): boolean => {
    if (!action || action === 'no_action') return false;
    switch (action) {
      case 'shift':
        triggerSound('special');
        setShiftState((prev) => (prev === 'off' ? 'once' : prev === 'once' ? 'caps' : 'off'));
        return true;
      case 'hide_keyboard':
        triggerSound('special');
        onHideKeyboard?.();
        return true;
      case 'insert_space':
        triggerSound('space');
        onInsertText(' ');
        return true;
      case 'delete_character':
      case 'delete_characters_precisely':
        triggerSound('backspace');
        onBackspace();
        return true;
      case 'delete_word':
      case 'delete_words_precisely':
        triggerSound('backspace');
        onDeleteWord();
        return true;
      case 'move_cursor_left':
        triggerSound('special');
        if (onMoveCursorEx) onMoveCursorEx(-1, 0, false);
        else onMoveCursor(-1);
        return true;
      case 'move_cursor_right':
        triggerSound('special');
        if (onMoveCursorEx) onMoveCursorEx(1, 0, false);
        else onMoveCursor(1);
        return true;
      case 'move_cursor_up':
        triggerSound('special');
        if (onMoveCursorEx) onMoveCursorEx(0, -1, false);
        return true;
      case 'move_cursor_down':
        triggerSound('special');
        if (onMoveCursorEx) onMoveCursorEx(0, 1, false);
        return true;
      case 'move_cursor_start_of_line':
      case 'move_cursor_start_of_page':
        triggerSound('special');
        if (onMoveLineEdge) onMoveLineEdge(false, false);
        else onMoveCursor(-100);
        return true;
      case 'move_cursor_end_of_line':
      case 'move_cursor_end_of_page':
        triggerSound('special');
        if (onMoveLineEdge) onMoveLineEdge(true, false);
        else onMoveCursor(100);
        return true;
      case 'select_characters_precisely':
        triggerSound('special');
        if (onMoveCursorEx) onMoveCursorEx(-1, 0, true);
        return true;
      case 'select_words_precisely':
        triggerSound('special');
        if (onMoveLineEdge) onMoveLineEdge(false, true);
        else onSelectAll();
        return true;
      case 'undo':
        triggerSound('special');
        onUndo();
        return true;
      case 'redo':
        triggerSound('special');
        onRedo();
        return true;
      case 'show_arabic_harakat':
        triggerSound('special');
        setGesturePopup({ title: 'حەرەکاتی عەرەبی', options: ARABIC_HARAKAT_OPTIONS });
        return true;
      case 'space_bar_custom_menu':
        triggerSound('special');
        setGesturePopup({ title: 'درێژکردنەوە و نیوبزوێن', options: SPACEBAR_CUSTOM_MENU_OPTIONS });
        return true;
      case 'show_subtype_picker':
      case 'show_input_method_picker':
        triggerSound('special');
        setShowLangPicker(true);
        return true;
      case 'switch_to_next_subtype':
        cycleLanguage(1);
        return true;
      case 'switch_to_prev_subtype':
      case 'switch_to_prev_keyboard':
        cycleLanguage(-1);
        return true;
      case 'switch_to_clipboard_context':
        triggerSound('special');
        setActivePanel('clipboard');
        return true;
      case 'switch_to_media_context':
        triggerSound('special');
        setRichInitialTab('emoji');
        setActivePanel('emoji');
        return true;
      case 'switch_to_symbols_keyboard':
        triggerSound('special');
        setViewMode((prev) => (prev === 'symbols' ? 'characters' : 'symbols'));
        return true;
      case 'cycle_to_next_keyboard_mode': {
        triggerSound('special');
        const modes: KeyboardViewMode[] = ['characters', 'symbols', 'symbols2', 'numeric_advanced'];
        setViewMode((prev) => modes[(modes.indexOf(prev) + 1) % modes.length]);
        return true;
      }
      case 'cycle_to_previous_keyboard_mode': {
        triggerSound('special');
        const modes: KeyboardViewMode[] = ['characters', 'symbols', 'symbols2', 'numeric_advanced'];
        setViewMode((prev) => modes[(modes.indexOf(prev) - 1 + modes.length) % modes.length]);
        return true;
      }
      case 'toggle_compact_layout':
        triggerSound('special');
        onUpdateSettings({
          oneHandedMode: settings.oneHandedMode === 'off' ? 'right' : 'off',
        });
        return true;
      case 'toggle_smartbar_visibility':
        triggerSound('special');
        onUpdateSettings({ showTopToolbar: !settings.showTopToolbar });
        return true;
      default:
        return false;
    }
  };

  const applyActiveDecorator = (text: string): string => {
    if (activeDecoratorId === 'none') return text;
    if (
      ['royal_frame', 'hearts_frame', 'stars_frame', 'kurdish_ornate'].includes(activeDecoratorId)
    ) {
      return text;
    }
    const dec = TEXT_DECORATORS.find((d) => d.id === activeDecoratorId);
    return dec ? dec.transform(text) : text;
  };

  const commitLiveTranslation = () => {
    const out = (liveTranslateOutput || liveTranslateQuery).trim();
    if (!out) return;
    onInsertText(`${out} `);
    setLiveTranslateQuery('');
    setLiveTranslateOutput('');
  };

  const handleInlineMathTap = () => {
    if (!inlineMath) return;
    triggerSound('char');
    if (inlineMath.hasTrailingEquals) {
      onInsertText(` ${inlineMath.formatted} `);
      return;
    }
    const replaced =
      editorText.slice(0, editorText.length - inlineMath.rawMatch.length) +
      `${inlineMath.formatted} `;
    onReplaceText(replaced);
  };

  const commitCharacter = (raw: string) => {
    if (emojiSearchMode) {
      setEmojiSearchQuery((prev) => prev + raw);
      if (shiftState === 'once') setShiftState('off');
      return;
    }
    if (liveTranslateMode) {
      setLiveTranslateQuery((prev) => prev + raw);
      if (shiftState === 'once') setShiftState('off');
      return;
    }

    // Support authentic Korean Hangul Unicode Jamo syllable composition
    if (
      activeLangConfig?.composerId?.includes('hangul-unicode') &&
      activeDecoratorId === 'none' &&
      raw.length === 1
    ) {
      const composed = composeHangul(editorText, raw);
      if (composed.replaceLen > 0) {
        onReplaceText(editorText.slice(0, -composed.replaceLen) + composed.text);
        if (shiftState === 'once') setShiftState('off');
        return;
      }
    }

    // Email domain insertion (e.g. "@gmail.com"): keep plain Latin & prevent double "@@"
    if (raw.startsWith('@') && raw.includes('.')) {
      const textToInsert = editorText.endsWith('@') ? raw.slice(1) : raw;
      onInsertText(textToInsert);
      if (shiftState === 'once') {
        setShiftState('off');
      }
      return;
    }

    const decorated = applyActiveDecorator(raw);
    onInsertText(decorated);
    if (shiftState === 'once') {
      setShiftState('off');
    }
  };

  const handleSuggestionTap = (
    word: string,
    isEmail?: boolean,
    isEmoji?: boolean,
    replaceLength?: number
  ) => {
    triggerSound('char');
    if (isEmail && word.startsWith('@')) {
      const emailMatch = editorText.match(/@[a-zA-Z0-9.-]*$/);
      if (emailMatch) {
        const replaced = editorText.slice(0, editorText.length - emailMatch[0].length) + word;
        onReplaceText(replaced);
        return;
      }
      onInsertText(word);
      return;
    }
    const looksLikeEmoji =
      isEmoji || (/^\p{Emoji}/u.test(word) && !/[a-zA-Z0-9\u0600-\u06FF]/.test(word));
    if (looksLikeEmoji) {
      if (replaceLength && replaceLength > 0) {
        const replaced = editorText.slice(0, Math.max(0, editorText.length - replaceLength)) + `${word} `;
        onReplaceText(replaced);
      } else {
        onInsertText(` ${word} `);
      }
      if (settings.emojiHistoryEnabled && settings.emojiSuggestionUpdateHistory !== false) {
        const nextStore = recordHistoryUsage(
          { pinned: settings.emojiPinned || [], recent: settings.recentEmojis || [] },
          word,
          settings.emojiHistoryUpdateStrategy || 'auto_prepend',
          settings.emojiHistoryRecentMaxSize || 40
        );
        onUpdateSettings({ emojiPinned: nextStore.pinned, recentEmojis: nextStore.recent });
      }
      return;
    }
    if (!currentWord) {
      onInsertText(`${word} `);
      return;
    }
    recordFinishedWord(word);
    const replaced = editorText.slice(0, editorText.length - currentWord.length) + `${word} `;
    onReplaceText(replaced);
  };

  const handleSpaceClick = () => {
    triggerSound('space');
    if (emojiSearchMode) {
      setEmojiSearchQuery((prev) => prev + ' ');
      return;
    }
    if (liveTranslateMode) {
      setLiveTranslateQuery((prev) => prev + ' ');
      return;
    }
    if (currentWord) {
      recordFinishedWord(currentWord);
    }
    const now = Date.now();
    if (
      settings.doubleSpacePeriod &&
      now - lastSpaceTapRef.current < 320 &&
      editorText.endsWith(' ') &&
      !editorText.endsWith('. ')
    ) {
      onReplaceText(`${editorText.slice(0, -1)}. `);
      lastSpaceTapRef.current = 0;
      return;
    }
    lastSpaceTapRef.current = now;
    onInsertText(' ');
  };

  const handleKeyTap = (key: KeySpec) => {
    if (longPressMenu) setLongPressMenu(null);
    if (gesturePopup) setGesturePopup(null);
    if (showLangPicker && key.type !== 'globe') setShowLangPicker(false);
    switch (key.type) {
      case 'shift': {
        triggerSound('special');
        const now = Date.now();
        if (now - lastShiftTapRef.current < 320) {
          setShiftState((prev) => (prev === 'caps' ? 'off' : 'caps'));
        } else {
          setShiftState((prev) => (prev === 'off' ? 'once' : 'off'));
        }
        lastShiftTapRef.current = now;
        return;
      }
      case 'backspace':
        triggerSound('backspace');
        if (emojiSearchMode) {
          setEmojiSearchQuery((prev) => {
            const chars = [...prev];
            chars.pop();
            return chars.join('');
          });
          return;
        }
        if (liveTranslateMode) {
          setLiveTranslateQuery((prev) => {
            const chars = [...prev];
            chars.pop();
            return chars.join('');
          });
          return;
        }
        onBackspace();
        return;
      case 'space':
        handleSpaceClick();
        return;
      case 'enter':
        triggerSound('enter');
        if (emojiSearchMode) {
          if (emojiSearchQuery.trim() && emojiSearchResults[0]) {
            handleRichInsert(emojiSearchResults[0], 'emoji');
          } else {
            setEmojiSearchMode(false);
          }
          return;
        }
        if (liveTranslateMode) {
          if (liveTranslateQuery.trim()) {
            commitLiveTranslation();
          } else {
            setLiveTranslateMode(false);
          }
          return;
        }
        if (currentWord) {
          recordFinishedWord(currentWord);
        }
        onEnter();
        return;
      case 'characters':
        triggerSound('special');
        setViewMode('characters');
        return;
      case 'symbols':
        triggerSound('special');
        setViewMode((prev) => (prev === 'symbols' ? 'characters' : 'symbols'));
        return;
      case 'symbols2':
      case 'sym_toggle':
        triggerSound('special');
        setViewMode((prev) => (prev === 'symbols2' ? 'symbols' : 'symbols2'));
        return;
      case 'numeric_advanced':
        triggerSound('special');
        setViewMode('numeric_advanced');
        return;
      case 'phone':
        triggerSound('special');
        setViewMode('phone');
        return;
      case 'phone2':
        triggerSound('special');
        setViewMode('phone2');
        return;
      case 'emoji':
        triggerSound('special');
        setEmojiSearchMode(false);
        setRichInitialTab('emoji');
        setActivePanel('emoji');
        return;
      case 'globe':
        cycleLanguage(1);
        return;
      case 'kana_toggle':
        triggerSound('special');
        setKanaMode((prev) => (prev === 'hira' ? 'kata' : 'hira'));
        return;
      case 'settings':
        triggerSound('special');
        onOpenSettingsRoute('home');
        return;
      case 'copy':
        triggerSound('special');
        onCopy();
        return;
      case 'cut':
        triggerSound('special');
        onCut();
        return;
      case 'paste':
        triggerSound('special');
        onPaste();
        return;
      case 'select_all':
        triggerSound('special');
        onSelectAll();
        return;
      case 'compact_left':
        triggerSound('special');
        onUpdateSettings({
          oneHandedMode: settings.oneHandedMode === 'left' ? 'off' : 'left',
        });
        return;
      case 'zwnj':
        triggerSound('special');
        onInsertText('\u200C');
        return;
      default: {
        triggerSound('char');
        const out =
          key.output !== undefined
            ? key.output
            : shiftState !== 'off' && key.shiftPrimary
            ? key.shiftPrimary
            : key.primary;
        commitCharacter(out);
      }
    }
  };

  const showKeyPreviewBubble = (label: string, targetEl: HTMLElement | null) => {
    const bubble = keyPreviewRef.current;
    const deck = deckContainerRef.current;
    if (!bubble || !deck || !targetEl) return;
    const deckRect = deck.getBoundingClientRect();
    const keyRect = targetEl.getBoundingClientRect();
    bubble.textContent = label;
    bubble.style.left = `${keyRect.left - deckRect.left + keyRect.width / 2}px`;
    bubble.style.top = `${keyRect.top - deckRect.top - 48}px`;
    bubble.style.opacity = '1';
  };

  const hideKeyPreviewBubble = () => {
    const bubble = keyPreviewRef.current;
    if (bubble && bubble.style.opacity !== '0') {
      bubble.style.opacity = '0';
    }
  };

  const handleKeyPointerDown = (key: KeySpec, targetEl: HTMLElement | null) => {
    const isPrintable = !key.type || key.type === 'char' || key.type === 'comma' || key.type === 'period';
    if (settings.keyPopupPreview && isPrintable) {
      const label = shiftState !== 'off' && key.shiftPrimary ? key.shiftPrimary : key.primary;
      showKeyPreviewBubble(label, targetEl);
    }

    if (key.type === 'backspace') {
      const longAction = settings.deleteKeyLongPressAction || 'delete_character';
      if (longAction === 'no_action') return;
      if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = window.setTimeout(() => {
        if (bkspDraggedRef.current) return;
        const deleteByWord =
          longAction === 'delete_word' || longAction === 'delete_words_precisely';
        backspaceRepeatRef.current = window.setInterval(() => {
          if (emojiSearchModeRef.current) {
            setEmojiSearchQuery((prev) => {
              const chars = [...prev];
              chars.pop();
              return chars.join('');
            });
          } else if (liveTranslateModeRef.current) {
            setLiveTranslateQuery((prev) => {
              const chars = [...prev];
              chars.pop();
              return chars.join('');
            });
          } else if (deleteByWord) {
            onDeleteWord();
          } else {
            onBackspace();
          }
        }, deleteByWord ? 180 : 75);
      }, 360);
      return;
    }

    if (key.type === 'space') {
      const spaceLong = settings.spaceBarLongPressAction;
      if (spaceLong && spaceLong !== 'no_action') {
        if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = window.setTimeout(() => {
          if (!spaceDraggedRef.current && spaceDragStartRef.current) {
            spaceLongPressedRef.current = true;
            executeSwipeAction(spaceLong);
          }
        }, 430);
      }
      return;
    }

    if (key.type === 'globe' && settings.showLanguagePickerOnLongPress) {
      if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = window.setTimeout(() => {
        setShowLangPicker(true);
        triggerSound('special');
      }, 420);
      return;
    }

    // Long-press on Emoji (smiley) key activates Live Interactive Keyboard Resize (up to 50% of screen)
    if (key.type === 'emoji') {
      emojiLongPressedRef.current = false;
      if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = window.setTimeout(() => {
        emojiLongPressedRef.current = true;
        hideKeyPreviewBubble();
        setLongPressMenu(null);
        setShowLangPicker(false);
        setActivePanel('keys');
        setInlineResizeMode(true);
        triggerSound('special');
        if (settings.vibrationEnabled && navigator.vibrate) {
          try {
            navigator.vibrate(16);
          } catch {
            // ignore
          }
        }
      }, 360);
      return;
    }

    const rawAlts =
      key.alts && key.alts.length > 0 ? key.alts : key.secondary ? [key.secondary] : [];
    const normalized: PopupOption[] = [];
    const seen = new Set<string>();
    for (const item of rawAlts) {
      const opt: PopupOption =
        typeof item === 'string' ? { label: item, value: item } : item;
      const dedupeKey = `${opt.label}::${opt.value}`;
      if (!seen.has(dedupeKey)) {
        seen.add(dedupeKey);
        normalized.push(opt);
      }
    }

    if (normalized.length > 0) {
      if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
      const isEmailPopup = normalized.some(
        (o) => o.value.startsWith('@') && o.value.includes('.')
      );
      const isPhrasePopup =
        !isEmailPopup &&
        normalized.some(
          (o) =>
            o.code === -255 ||
            o.code === -1001 ||
            o.label.trim().length > 2 ||
            o.value.trim().length > 2
        );
      longPressTimerRef.current = window.setTimeout(() => {
        hideKeyPreviewBubble();
        const deck = deckContainerRef.current;
        const deckRect = deck?.getBoundingClientRect();
        const keyRect = targetEl?.getBoundingClientRect();
        const anchorRect =
          deckRect && keyRect
            ? {
                left: keyRect.left - deckRect.left,
                top: keyRect.top - deckRect.top,
                width: keyRect.width,
                height: keyRect.height,
                deckWidth: deckRect.width,
                deckHeight: deckRect.height,
              }
            : {
                left: 120,
                top: 120,
                width: 36,
                height: 44,
                deckWidth: 360,
                deckHeight: 280,
              };
        emailSlidRef.current = false;
        longPressActiveIdxRef.current = isEmailPopup ? -1 : 0;
        setLongPressActiveIdx(isEmailPopup ? -1 : 0);
        setLongPressMenu({
          keyId: key.id,
          options: normalized,
          anchorRect,
          isPhrasePopup,
          isEmailPopup,
        });
        triggerSound('special');
      }, 270);
    }
  };

  const updateLongPressHover = (clientX: number, clientY: number) => {
    const menu = longPressMenuRef.current;
    const container = extendedPopupRef.current;
    if (!menu || !container) return;

    const buttons = container.querySelectorAll<HTMLElement>('[data-popup-opt-idx]');
    let hitIdx = -1;
    let nearestIdx = -1;
    let nearestDist = Infinity;

    buttons.forEach((btn) => {
      const idx = Number(btn.dataset.popupOptIdx);
      const rect = btn.getBoundingClientRect();
      // Direct hit with 6px finger tolerance
      if (
        clientX >= rect.left - 6 &&
        clientX <= rect.right + 6 &&
        clientY >= rect.top - 6 &&
        clientY <= rect.bottom + 6
      ) {
        hitIdx = idx;
      }
      const cx = Math.max(rect.left, Math.min(clientX, rect.right));
      const cy = Math.max(rect.top, Math.min(clientY, rect.bottom));
      const d = Math.hypot(clientX - cx, clientY - cy);
      if (d < nearestDist) {
        nearestDist = d;
        nearestIdx = idx;
      }
    });

    let nextIdx = -1;
    if (hitIdx >= 0) {
      nextIdx = hitIdx;
      if (menu.isEmailPopup) emailSlidRef.current = true;
    } else if (!menu.isEmailPopup && nearestIdx >= 0 && nearestDist <= 68) {
      nextIdx = nearestIdx;
    } else if (!menu.isEmailPopup) {
      // Keep main option (0) selected while thumb stays on or right over the held key
      const deckRect = deckContainerRef.current?.getBoundingClientRect();
      if (deckRect) {
        const keyLeft = deckRect.left + menu.anchorRect.left;
        const keyTop = deckRect.top + menu.anchorRect.top;
        const kx = Math.max(keyLeft, Math.min(clientX, keyLeft + menu.anchorRect.width));
        const ky = Math.max(keyTop, Math.min(clientY, keyTop + menu.anchorRect.height));
        if (Math.hypot(clientX - kx, clientY - ky) <= 44) {
          nextIdx = 0;
        }
      }
    }

    if (nextIdx !== longPressActiveIdxRef.current) {
      longPressActiveIdxRef.current = nextIdx;
      setLongPressActiveIdx(nextIdx);
      if (nextIdx >= 0 && settings.vibrationEnabled && navigator.vibrate) {
        try {
          navigator.vibrate(6);
        } catch {
          // ignore
        }
      }
    }
  };

  const clearPointerState = () => {
    hideKeyPreviewBubble();
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (backspaceRepeatRef.current) {
      window.clearInterval(backspaceRepeatRef.current);
      backspaceRepeatRef.current = null;
    }
  };

  // FlorisBoard-authentic global swipe detector: mutually exclusive with key taps so swipes NEVER type a character
  const tryExecuteGlobalSwipe = (
    dx: number,
    dy: number,
    elapsedSec: number
  ): boolean => {
    const distThreshold = Math.max(40, (settings.swipeDistanceThreshold || 48) * 1.15);
    const velThreshold = Math.max(70, (settings.swipeVelocityThreshold || 200) * 0.4);
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const dist = Math.hypot(dx, dy);
    const velocity = dist / Math.max(0.03, elapsedSec);

    if (dist < distThreshold) return false;
    if (velocity < velThreshold && dist < distThreshold * 1.55) return false;

    let action: SwipeAction | undefined;
    if (absY > absX * 1.25) {
      action = dy > 0 ? settings.swipeDownAction : settings.swipeUpAction;
    } else if (absX > absY * 1.25) {
      action = dx < 0 ? settings.swipeLeftAction : settings.swipeRightAction;
    }
    if (!action) return false;

    if (action !== 'no_action') {
      executeSwipeAction(action);
    }
    return true;
  };

  const toggleVoiceTyping = () => {
    if (isListeningVoice) {
      speechRecRef.current?.stop();
      setIsListeningVoice(false);
      return;
    }
    const SpeechRecognitionCtor =
      (window as unknown as {
        SpeechRecognition?: new () => unknown;
        webkitSpeechRecognition?: new () => unknown;
      }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => unknown })
        .webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setVoiceNotice('گەڕانی دەنگی لەم وێبگەڕەدا پشتگیری ناکرێت.');
      window.setTimeout(() => setVoiceNotice(null), 3000);
      return;
    }

    try {
      const rec = new SpeechRecognitionCtor() as {
        lang: string;
        interimResults: boolean;
        onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
        onerror: () => void;
        onend: () => void;
        start: () => void;
        stop: () => void;
      };
      rec.lang =
        settings.activeLanguage === 'en'
          ? 'en-US'
          : settings.activeLanguage === 'ar'
          ? 'ar-IQ'
          : 'ku-IQ';
      rec.interimResults = false;
      rec.onresult = (e) => {
        const transcript = e.results[0]?.[0]?.transcript;
        if (transcript) {
          onInsertText(`${transcript} `);
        }
      };
      rec.onerror = () => {
        setIsListeningVoice(false);
        setVoiceNotice('دەنگەکە نەبیسترا، تکایە مۆڵەتی مایکرۆفۆن بدە.');
        window.setTimeout(() => setVoiceNotice(null), 3000);
      };
      rec.onend = () => {
        setIsListeningVoice(false);
      };
      speechRecRef.current = rec;
      rec.start();
      setIsListeningVoice(true);
      setActivePanel('keys');
    } catch {
      setIsListeningVoice(false);
    }
  };

  const handleRichInsert = (text: string, source: RichInsertSource) => {
    triggerSound('char');
    onInsertText(text);
    if (!settings.emojiHistoryEnabled) return;
    const strategy = settings.emojiHistoryUpdateStrategy || 'auto_prepend';
    const maxRecent = settings.emojiHistoryRecentMaxSize || 40;
    const clean = text.trim();
    if (!clean) return;

    if (source === 'emoji') {
      const next = recordHistoryUsage(
        { pinned: settings.emojiPinned || [], recent: settings.recentEmojis || [] },
        clean,
        strategy,
        maxRecent
      );
      onUpdateSettings({ emojiPinned: next.pinned, recentEmojis: next.recent });
    } else if (source === 'kaomoji') {
      const next = recordHistoryUsage(
        { pinned: settings.kaomojiPinned || [], recent: settings.recentKaomoji || [] },
        clean,
        strategy,
        maxRecent
      );
      onUpdateSettings({ kaomojiPinned: next.pinned, recentKaomoji: next.recent });
    } else {
      const currentAll = settings.zikrHistories || {
        duaa: { pinned: [], recent: [] },
        quran: { pinned: [], recent: [] },
        salawat: { pinned: [], recent: [] },
      };
      const sectionStore = currentAll[source] || { pinned: [], recent: [] };
      const nextSection = recordHistoryUsage(sectionStore, clean, strategy, maxRecent);
      const nextHistories = { ...currentAll, [source]: nextSection };
      const combinedRecent = Array.from(
        new Set([
          ...nextHistories.duaa.pinned,
          ...nextHistories.quran.pinned,
          ...nextHistories.salawat.pinned,
          ...nextHistories.duaa.recent,
          ...nextHistories.quran.recent,
          ...nextHistories.salawat.recent,
        ])
      ).slice(0, maxRecent);
      onUpdateSettings({ zikrHistories: nextHistories, recentZikr: combinedRecent });
    }
  };

  const handleSelectTool = (toolId: string) => {
    triggerSound('special');
    switch (toolId) {
      case 'live_translate':
        setEmojiSearchMode(false);
        setLiveTranslateMode(true);
        setViewMode('characters');
        setActivePanel('keys');
        break;
      case 'text_edit':
        setActivePanel('cursor_control');
        break;
      case 'snippets_calc':
        setSnippetsCalcTab('snippets');
        setActivePanel('snippets_calc');
        break;
      case 'translate':
        setTranslateInitialText(null);
        setActivePanel('translate');
        break;
      case 'resize':
        setActivePanel('keys');
        setInlineResizeMode(true);
        break;
      case 'decorate':
        setActivePanel('decorate');
        break;
      case 'themes':
        setActivePanel('themes');
        break;
      case 'voice':
        toggleVoiceTyping();
        break;
      case 'settings':
        onOpenSettingsRoute('home');
        setActivePanel('keys');
        break;
      case 'redo':
        onRedo();
        break;
      case 'undo':
        onUndo();
        break;
      case 'one_handed':
        onUpdateSettings({
          oneHandedMode:
            settings.oneHandedMode === 'off'
              ? 'right'
              : settings.oneHandedMode === 'right'
              ? 'left'
              : 'off',
        });
        setActivePanel('keys');
        break;
      case 'switch_lang':
        cycleLanguage(1);
        setActivePanel('keys');
        break;
      case 'ai_smart':
        setActivePanel('ai_smart');
        break;
      case 'clipboard':
        setActivePanel('clipboard');
        break;
      default:
        break;
    }
  };

  // Resolve ALL rows (numeric + characters/symbols/numpad + modifier bottom row) directly from authentic JSON layouts!
  const resolvedLayout = useMemo(() => {
    return resolveLayoutRows(activeLangConfig, viewMode, shiftState, kanaMode, settings);
  }, [
    activeLangConfig,
    viewMode,
    shiftState,
    kanaMode,
    settings.numberStyle,
    settings.showBottomKeys,
    settings.bottomRowPreset,
    settings.showGlobeKey,
    settings.showEmojiKey,
    settings.showCommaKey,
    settings.swapGlobeAndEmoji,
    settings.customLayouts,
  ]);

  const hGapPx = Math.max(2.5, Math.round((settings.keySpacingPercent / 100) * 3.6 * 2) / 2);
  const vGapPx = Math.max(4, Math.round((settings.keySpacingPercent / 100) * 6));
  const heightRatio = settings.keyboardHeightPx / 248;
  const keyContentScale = Math.max(0.9, Math.min(1.48, 1 + (heightRatio - 1) * 0.65));
  const letterFontSize = Math.round(16 * (settings.fontSizePercent / 100) * keyContentScale);
  const iconSize = Math.round(17 * (settings.iconSizePercent / 100) * keyContentScale);
  const spaceLabel =
    settings.spacebarLabelMode === 'none'
      ? ''
      : settings.spacebarLabelMode === 'custom'
      ? settings.customSpacebarText
      : activeLangConfig?.characterLayoutId === 'kurdi_hybrid'
      ? kanaMode === 'kata'
        ? 'Kurdî (Latînî)'
        : 'کوردی'
      : activeLangConfig?.nativeName || 'کوردی';

  const isLight = Boolean(theme.isLight);
  const toolbarIconColor = isLight
    ? 'text-slate-800 hover:bg-black/5'
    : 'text-white hover:bg-white/10';
  const borderWidth = theme.keyBorderWidth ?? (theme.hasKeyBorder ? 1 : 0);
  const keyBorderCss = borderWidth > 0 ? `${borderWidth}px solid ${theme.keyBorder}` : 'none';
  const keyShadowCss = theme.keyShadow || undefined;
  const isEmailLongPress = Boolean(longPressMenu?.isEmailPopup);

  // Keep latest handlers in a ref so memoized key rows NEVER re-render when editorText/suggestions update!
  const keyActionRef = useRef({
    settings,
    longPressMenu,
    showLangPicker,
    handleKeyPointerDown,
    updateLongPressHover,
    tryExecuteGlobalSwipe,
    hideKeyPreviewBubble,
    handleKeyTap,
    clearPointerState,
    executeSwipeAction,
    triggerSound,
    commitCharacter,
    onMoveCursor,
    onMoveCursorEx,
    onDeleteWord,
    onBackspace,
    onUpdateSettings,
  });
  keyActionRef.current = {
    settings,
    longPressMenu,
    showLangPicker,
    handleKeyPointerDown,
    updateLongPressHover,
    tryExecuteGlobalSwipe,
    hideKeyPreviewBubble,
    handleKeyTap,
    clearPointerState,
    executeSwipeAction,
    triggerSound,
    commitCharacter,
    onMoveCursor,
    onMoveCursorEx,
    onDeleteWord,
    onBackspace,
    onUpdateSettings,
  };

  const hasDedicatedNumRow =
    viewMode === 'characters' && Boolean(activeLangConfig?.numberRow) && resolvedLayout.rows.length >= 6;
  const computedDeckHeight = hasDedicatedNumRow
    ? settings.keyboardHeightPx + 30
    : settings.keyboardHeightPx;

  const memoizedKeyRows = useMemo(() => {
    const cleanPunctuationFaces = new Set(['؟', '،', ':', ',', '.']);
    const stripArabicMarks = (s: string) => s.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '');

    return resolvedLayout.rows.map((row, rIdx) => {
      const isLastRow = rIdx === resolvedLayout.rows.length - 1;
      const isNumTopRow = hasDedicatedNumRow && rIdx === 0;
      const isCompactMidRow =
        viewMode === 'characters' &&
        !isLastRow &&
        resolvedLayout.direction === 'ltr' &&
        row.length === 9 &&
        row.every((k) => !k.type || k.type === 'char');

      return (
        <div
          key={`row_${rIdx}`}
          className={`${isNumTopRow ? 'flex-[0.76]' : 'flex-1'} flex items-stretch ${isCompactMidRow ? 'px-3.5' : ''}`}
          style={{ gap: `${hGapPx}px` }}
        >
          {row.map((key) => {
            const isPhysicalHighlight = Boolean(
              highlightedPhysicalKey &&
                key.type === 'char' &&
                highlightedPhysicalKey.toLowerCase() === key.primary.toLowerCase()
            );
            const isTatweelKey = key.code === 1600;
            const isPunctuationKey = key.type === 'comma' || key.type === 'period';
            const isSpecial =
              isTatweelKey || Boolean(key.type && key.type !== 'char' && !isPunctuationKey);
            const displayLabel =
              key.type === 'space'
                ? spaceLabel
                : shiftState !== 'off' && key.shiftPrimary
                ? key.shiftPrimary
                : key.primary;

            let bg = theme.keyBg;
            let textCol = theme.keyText;
            let btnBorder = keyBorderCss;

            if (key.type === 'enter') {
              bg = theme.enterBg;
              textCol = theme.enterText;
              btnBorder = theme.enterBorder ? `1px solid ${theme.enterBorder}` : 'none';
            } else if (key.type === 'space') {
              bg = theme.spaceBg;
              textCol = theme.spaceText || theme.secondaryText;
            } else if (key.type === 'shift') {
              bg = shiftState !== 'off' ? theme.accent : theme.shiftBg || theme.specialKeyBg;
              textCol =
                shiftState !== 'off'
                  ? theme.enterText
                  : theme.shiftText || theme.specialKeyText;
            } else if (key.type === 'backspace' || isTatweelKey) {
              bg = theme.backspaceBg || theme.specialKeyBg;
              textCol = theme.backspaceText || theme.specialKeyText;
            } else if (
              key.type === 'symbols' ||
              key.type === 'symbols2' ||
              key.type === 'characters' ||
              key.type === 'numeric_advanced' ||
              key.type === 'phone' ||
              key.type === 'phone2'
            ) {
              bg = theme.symbolsBg || theme.specialKeyBg;
              textCol = theme.symbolsText || theme.specialKeyText;
            } else if (key.type === 'kana_toggle') {
              bg = theme.accent;
              textCol = theme.enterText;
            } else if (isSpecial) {
              bg = theme.specialKeyBg;
              textCol = theme.specialKeyText;
            }

            const rawSecondary = key.secondary?.trim() || '';
            const hideClutterHint =
              isTatweelKey ||
              isPunctuationKey ||
              key.type === 'space' ||
              key.type === 'enter' ||
              key.type === 'backspace' ||
              key.type === 'shift' ||
              key.type === 'emoji' ||
              key.type === 'globe' ||
              cleanPunctuationFaces.has(displayLabel.trim());
            const visibleSecondary =
              settings.showSecondaryHints && rawSecondary && !hideClutterHint ? rawSecondary : '';
            const visualSecondaryLen = visibleSecondary
              ? stripArabicMarks(visibleSecondary).length
              : 0;
            const isPhraseHint = visualSecondaryLen > 2;
            const phraseHintFontPx =
              visualSecondaryLen <= 4
                ? 9.4
                : visualSecondaryLen <= 7
                ? 8.7
                : visualSecondaryLen <= 10
                ? 8.0
                : visualSecondaryLen <= 12
                ? 7.4
                : 6.7;

            const shapeStyleProps = getKeyShapeStyleProps(
              settings.keyShapeStyle || 'default',
              theme,
              bg,
              btnBorder,
              keyShadowCss,
              key.type === 'enter',
              isPhysicalHighlight
            );

            return (
              <div
                key={key.id}
                className="relative flex-1 flex min-w-0"
                style={{ flex: key.width || 1 }}
              >
                {/* Language Picker Popup on Globe Long-Press / ContextMenu */}
                {key.type === 'globe' && showLangPicker && (
                  <div
                    className="absolute bottom-12 left-0 z-50 min-w-[165px] max-h-56 overflow-y-auto custom-scroll rounded-xl shadow-2xl p-1.5 flex flex-col gap-1"
                    style={{
                      backgroundColor: theme.popupBg || '#15181F',
                      border: `1px solid ${theme.popupBorder || 'rgba(255,255,255,0.12)'}`,
                    }}
                    onClick={(e) => e.stopPropagation()}
                    dir="rtl"
                  >
                    {settings.enabledLanguages.map((lang) => (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => {
                          keyActionRef.current.onUpdateSettings({
                            activeLanguage: lang.code as LanguageCode,
                          });
                          setViewMode('characters');
                          setShiftState('off');
                          setShowLangPicker(false);
                        }}
                        className={`px-3 py-2 rounded-lg text-xs font-semibold text-right flex items-center justify-between ${
                          settings.activeLanguage === lang.code
                            ? 'bg-sky-600 text-white'
                            : 'text-zinc-200 hover:bg-white/10'
                        }`}
                      >
                        <span>{lang.nativeName}</span>
                        {settings.activeLanguage === lang.code && (
                          <Check className="w-3.5 h-3.5" />
                        )}
                      </button>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  data-key-type={key.type || 'char'}
                  onClick={(e) => e.stopPropagation()}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    if (
                      key.type === 'globe' &&
                      keyActionRef.current.settings.showLanguagePickerOnLongPress
                    ) {
                      setShowLangPicker((v) => !v);
                    }
                  }}
                  onPointerDown={(e) => {
                    try {
                      e.currentTarget.setPointerCapture(e.pointerId);
                    } catch {
                      // ignore unsupported capture
                    }
                    if (key.type === 'backspace') {
                      bkspDragStartXRef.current = { startX: e.clientX, lastX: e.clientX };
                      bkspDraggedRef.current = false;
                    } else if (key.type === 'space') {
                      spaceDragStartRef.current = {
                        startX: e.clientX,
                        startY: e.clientY,
                        lastX: e.clientX,
                        lastY: e.clientY,
                        time: Date.now(),
                      };
                      spaceDraggedRef.current = false;
                      spaceLongPressedRef.current = false;
                    } else {
                      const rect = e.currentTarget.getBoundingClientRect();
                      activePointersRef.current.set(e.pointerId, {
                        keyId: key.id,
                        startX: e.clientX,
                        startY: e.clientY,
                        time: Date.now(),
                        slidAway: false,
                        keyRect: {
                          left: rect.left,
                          right: rect.right,
                          top: rect.top,
                          bottom: rect.bottom,
                        },
                      });
                    }
                    keyActionRef.current.handleKeyPointerDown(key, e.currentTarget);
                  }}
                  onPointerMove={(e) => {
                    const act = keyActionRef.current;
                    // Active Extended Key Popup: slide finger to highlight any phrase/char without lifting!
                    if (longPressMenuRef.current?.keyId === key.id) {
                      act.updateLongPressHover(e.clientX, e.clientY);
                      return;
                    }
                    // Track drag/swipe movement on regular keys so swiping cancels long-press & key preview
                    const ptr = activePointersRef.current.get(e.pointerId);
                    if (ptr && ptr.keyId === key.id) {
                      const moved = Math.hypot(e.clientX - ptr.startX, e.clientY - ptr.startY);
                      if (moved > 18) {
                        if (longPressTimerRef.current) {
                          window.clearTimeout(longPressTimerRef.current);
                          longPressTimerRef.current = null;
                        }
                        act.hideKeyPreviewBubble();
                      }
                      if (moved > 28) {
                        ptr.slidAway = true;
                      }
                    }
                    // Spacebar continuous cursor glide & swipe detection
                    if (key.type === 'space' && spaceDragStartRef.current !== null) {
                      const totalDx = e.clientX - spaceDragStartRef.current.startX;
                      const totalDy = e.clientY - spaceDragStartRef.current.startY;
                      if (Math.hypot(totalDx, totalDy) > 12 && longPressTimerRef.current) {
                        window.clearTimeout(longPressTimerRef.current);
                        longPressTimerRef.current = null;
                      }
                      const stepDx = e.clientX - spaceDragStartRef.current.lastX;
                      if (Math.abs(stepDx) >= 15 && Math.abs(totalDx) > Math.abs(totalDy)) {
                        const dirAction =
                          stepDx < 0
                            ? act.settings.spaceBarSwipeLeftAction
                            : act.settings.spaceBarSwipeRightAction;
                        if (
                          dirAction === 'move_cursor_left' ||
                          dirAction === 'move_cursor_right'
                        ) {
                          const delta = stepDx > 0 ? 1 : -1;
                          if (act.onMoveCursorEx) act.onMoveCursorEx(delta, 0, false);
                          else act.onMoveCursor(delta);
                          spaceDragStartRef.current.lastX = e.clientX;
                          spaceDragStartRef.current.lastY = e.clientY;
                          spaceDraggedRef.current = true;
                        } else if (dirAction === 'select_characters_precisely') {
                          const delta = stepDx > 0 ? 1 : -1;
                          if (act.onMoveCursorEx) act.onMoveCursorEx(delta, 0, true);
                          spaceDragStartRef.current.lastX = e.clientX;
                          spaceDragStartRef.current.lastY = e.clientY;
                          spaceDraggedRef.current = true;
                        }
                      }
                    }
                    // Continuous precise delete while dragging backspace left
                    if (key.type === 'backspace' && bkspDragStartXRef.current !== null) {
                      const delAction = act.settings.deleteKeySwipeLeftAction;
                      const totalDx = bkspDragStartXRef.current.startX - e.clientX;
                      if (Math.abs(totalDx) > 14 && longPressTimerRef.current) {
                        window.clearTimeout(longPressTimerRef.current);
                        longPressTimerRef.current = null;
                      }
                      const stepDx = bkspDragStartXRef.current.lastX - e.clientX;
                      if (
                        (delAction === 'delete_characters_precisely' ||
                          delAction === 'delete_words_precisely') &&
                        stepDx > 20
                      ) {
                        bkspDraggedRef.current = true;
                        bkspDragStartXRef.current.lastX = e.clientX;
                        act.triggerSound('backspace');
                        if (delAction === 'delete_words_precisely') act.onDeleteWord();
                        else act.onBackspace();
                      }
                    }
                  }}
                  onPointerUp={(e) => {
                    const act = keyActionRef.current;
                    try {
                      if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
                        e.currentTarget.releasePointerCapture(e.pointerId);
                      }
                    } catch {
                      // ignore
                    }

                    const ptr = activePointersRef.current.get(e.pointerId);
                    activePointersRef.current.delete(e.pointerId);

                    // 1. Commit selected Long-Press Extended Popup option immediately on finger release!
                    if (longPressMenuRef.current?.keyId === key.id) {
                      const menu = longPressMenuRef.current;
                      const selIdx = longPressActiveIdxRef.current;
                      act.clearPointerState();
                      if (menu.isEmailPopup) {
                        if (emailSlidRef.current && selIdx >= 0 && menu.options[selIdx]) {
                          act.triggerSound('char');
                          act.commitCharacter(menu.options[selIdx].value);
                          setLongPressMenu(null);
                        }
                        // Otherwise keep Email Accounts Picker open for browsing/tapping
                        return;
                      }
                      if (selIdx >= 0 && menu.options[selIdx]) {
                        act.triggerSound('char');
                        act.commitCharacter(menu.options[selIdx].value);
                      }
                      setLongPressMenu(null);
                      return;
                    }

                    // 2. Backspace swipe-left gesture
                    if (key.type === 'backspace' && bkspDragStartXRef.current !== null) {
                      const totalDx = bkspDragStartXRef.current.startX - e.clientX;
                      bkspDragStartXRef.current = null;
                      if (bkspDraggedRef.current) {
                        bkspDraggedRef.current = false;
                        act.clearPointerState();
                        return;
                      }
                      const delAction = act.settings.deleteKeySwipeLeftAction;
                      const threshold = Math.max(
                        24,
                        Math.min(48, (act.settings.swipeDistanceThreshold || 48) * 0.6)
                      );
                      if (delAction && delAction !== 'no_action' && totalDx > threshold) {
                        act.clearPointerState();
                        act.executeSwipeAction(delAction);
                        return;
                      }
                    }
                    bkspDragStartXRef.current = null;
                    bkspDraggedRef.current = false;

                    // 3. Spacebar 4-way gestures (Up, Left, Right, Long Press)
                    if (key.type === 'space' && spaceDragStartRef.current !== null) {
                      const totalDx = e.clientX - spaceDragStartRef.current.startX;
                      const totalDy = e.clientY - spaceDragStartRef.current.startY;
                      spaceDragStartRef.current = null;
                      if (spaceLongPressedRef.current) {
                        spaceLongPressedRef.current = false;
                        act.clearPointerState();
                        return;
                      }
                      if (spaceDraggedRef.current) {
                        spaceDraggedRef.current = false;
                        act.clearPointerState();
                        return;
                      }
                      const threshold = Math.max(
                        24,
                        Math.min(48, (act.settings.swipeDistanceThreshold || 48) * 0.6)
                      );
                      if (-totalDy > threshold && Math.abs(totalDy) > Math.abs(totalDx) * 1.1) {
                        act.clearPointerState();
                        act.executeSwipeAction(act.settings.spaceBarSwipeUpAction);
                        return;
                      }
                      if (Math.abs(totalDx) > threshold && Math.abs(totalDx) > Math.abs(totalDy)) {
                        const action =
                          totalDx < 0
                            ? act.settings.spaceBarSwipeLeftAction
                            : act.settings.spaceBarSwipeRightAction;
                        act.clearPointerState();
                        act.executeSwipeAction(action);
                        return;
                      }
                    }

                    // 4. Global swipe gesture check (mutually exclusive with typing — NEVER types the starting key!)
                    if (ptr && ptr.keyId === key.id) {
                      const dx = e.clientX - ptr.startX;
                      const dy = e.clientY - ptr.startY;
                      const dist = Math.hypot(dx, dy);
                      const elapsedSec = (Date.now() - ptr.time) / 1000;

                      if (act.tryExecuteGlobalSwipe(dx, dy, elapsedSec)) {
                        act.clearPointerState();
                        return;
                      }

                      // If finger dragged clearly outside the key bounds without triggering a swipe, cancel tap cleanly
                      const tol = 16;
                      const outsideKey =
                        e.clientX < ptr.keyRect.left - tol ||
                        e.clientX > ptr.keyRect.right + tol ||
                        e.clientY < ptr.keyRect.top - tol ||
                        e.clientY > ptr.keyRect.bottom + tol;
                      if (ptr.slidAway && outsideKey && dist > 30) {
                        act.clearPointerState();
                        return;
                      }
                    }

                    // 5. Genuine key tap
                    e.preventDefault();
                    e.stopPropagation();
                    if (key.type === 'emoji' && emojiLongPressedRef.current) {
                      emojiLongPressedRef.current = false;
                      act.clearPointerState();
                      return;
                    }
                    const wasMenuOpen =
                      act.longPressMenu?.keyId === key.id ||
                      (key.type === 'globe' && act.showLangPicker);
                    act.clearPointerState();
                    if (!wasMenuOpen) {
                      act.handleKeyTap(key);
                    }
                  }}
                  onPointerLeave={(e) => {
                    // Pointer capture manages full swipe/long-press lifecycle cleanly
                    if (key.type === 'space' && spaceDragStartRef.current !== null) return;
                    if (key.type === 'backspace' && bkspDragStartXRef.current !== null) return;
                    if (
                      activePointersRef.current.has(e.pointerId) ||
                      longPressMenuRef.current?.keyId === key.id
                    ) {
                      return;
                    }
                    keyActionRef.current.clearPointerState();
                  }}
                  onPointerCancel={(e) => {
                    spaceDragStartRef.current = null;
                    spaceDraggedRef.current = false;
                    spaceLongPressedRef.current = false;
                    bkspDragStartXRef.current = null;
                    bkspDraggedRef.current = false;
                    activePointersRef.current.delete(e.pointerId);
                    if (longPressMenuRef.current?.keyId === key.id) {
                      setLongPressMenu(null);
                    }
                    keyActionRef.current.clearPointerState();
                  }}
                  className={`w-full h-full relative flex items-center justify-center px-[1px] overflow-hidden touch-none select-none ${
                    shapeStyleProps.className
                  } ${
                    settings.keyAnimation ? 'active:scale-[0.94] active:brightness-110' : ''
                  } ${isPhysicalHighlight && settings.keyAnimation ? 'scale-[0.94]' : ''}`}
                  style={{
                    ...shapeStyleProps.style,
                    color: textCol,
                    touchAction: 'none',
                  }}
                >
                  {/* Secondary Hint Character or Full Unclipped Zikr Phrase */}
                  {visibleSecondary &&
                    (isPhraseHint ? (
                      <span
                        className="absolute top-[2.5px] inset-x-[0.5px] text-center whitespace-nowrap leading-none font-semibold pointer-events-none"
                        style={{
                          color: theme.secondaryText,
                          fontSize: `${(phraseHintFontPx * Math.min(1.12, keyContentScale)).toFixed(1)}px`,
                          letterSpacing: visualSecondaryLen > 12 ? '-0.025em' : '0px',
                        }}
                      >
                        {visibleSecondary}
                      </span>
                    ) : (
                      <span
                        className="absolute top-[3px] right-[4px] leading-none font-semibold pointer-events-none"
                        style={{
                          color: theme.secondaryText,
                          fontSize: `${Math.round(10 * Math.min(1.32, keyContentScale))}px`,
                        }}
                      >
                        {visibleSecondary}
                      </span>
                    ))}

                  {/* Main Key Icon / Label using official KurdiKeyboard VectorDrawables */}
                  {key.type === 'shift' ? (
                    <KurdiIcon
                      name={shiftState === 'caps' ? 'ic_shift_lock' : 'ic_shift'}
                      style={{ width: iconSize + 2, height: iconSize + 2 }}
                    />
                  ) : key.code === 1600 ? (
                    <KurdiIcon
                      name="ic_drezh"
                      style={{ width: iconSize + 6, height: iconSize + 6 }}
                    />
                  ) : key.type === 'backspace' ? (
                    <KurdiIcon
                      name="ic_delete"
                      style={{ width: iconSize + 3, height: iconSize + 3 }}
                    />
                  ) : key.type === 'enter' ? (
                    <KurdiIcon
                      name="ic_enter"
                      style={{ width: iconSize + 3, height: iconSize + 3 }}
                    />
                  ) : key.type === 'emoji' ? (
                    <KurdiIcon
                      name="ic_smile"
                      style={{ width: iconSize + 2, height: iconSize + 2 }}
                    />
                  ) : key.type === 'globe' ? (
                    <KurdiIcon
                      name="ic_global"
                      style={{ width: iconSize + 2, height: iconSize + 2 }}
                    />
                  ) : key.type === 'settings' ? (
                    <KurdiIcon
                      name="ic_settings"
                      style={{ width: iconSize + 1, height: iconSize + 1 }}
                    />
                  ) : key.type === 'copy' ? (
                    <KurdiIcon name="ic_copy" style={{ width: iconSize, height: iconSize }} />
                  ) : key.type === 'cut' ? (
                    <KurdiIcon name="ic_cuts" style={{ width: iconSize, height: iconSize }} />
                  ) : key.type === 'paste' ? (
                    <KurdiIcon name="ic_pastes" style={{ width: iconSize, height: iconSize }} />
                  ) : key.type === 'select_all' ? (
                    <KurdiIcon
                      name="ic_select_all"
                      style={{ width: iconSize, height: iconSize }}
                    />
                  ) : key.type === 'space' ? (
                    <span
                      className="font-semibold truncate px-2 flex items-center gap-3 pointer-events-none"
                      style={{ fontSize: `${Math.round(13 * Math.min(1.28, keyContentScale))}px` }}
                    >
                      {spaceLabel ? (
                        <>
                          <span className="opacity-65 text-[0.92em]">‹</span>
                          <span>{spaceLabel}</span>
                          <span className="opacity-65 text-[0.92em]">›</span>
                        </>
                      ) : null}
                    </span>
                  ) : key.type === 'zwnj' ? (
                    <KurdiIcon
                      name="ic_zwnj"
                      style={{ width: iconSize + 1, height: iconSize + 1 }}
                    />
                  ) : (
                    <span
                      className={`font-semibold leading-[1.15] pointer-events-none ${
                        displayLabel.length > 2 ? 'truncate max-w-[94%]' : ''
                      }`}
                      style={{
                        fontSize: `${
                          key.type === 'symbols' ||
                          key.type === 'symbols2' ||
                          key.type === 'characters' ||
                          key.type === 'numeric_advanced' ||
                          key.type === 'kana_toggle'
                            ? Math.max(12, letterFontSize - 4)
                            : key.type === 'period'
                            ? Math.max(22, letterFontSize + 2)
                            : isNumTopRow
                            ? Math.max(15, letterFontSize - 3)
                            : displayLabel.length > 2
                            ? Math.max(12, letterFontSize - 4)
                            : letterFontSize
                        }px`,
                        marginTop: visibleSecondary
                          ? isPhraseHint
                            ? `${Math.round(8 * keyContentScale)}px`
                            : `${Math.round(6 * keyContentScale)}px`
                          : key.type === 'period'
                          ? '-2px'
                          : '0px',
                      }}
                    >
                      {displayLabel}
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      );
    });
  }, [
    resolvedLayout,
    viewMode,
    hGapPx,
    hasDedicatedNumRow,
    highlightedPhysicalKey,
    spaceLabel,
    shiftState,
    theme,
    keyBorderCss,
    keyShadowCss,
    settings.keyShapeStyle,
    settings.keyAnimation,
    settings.showSecondaryHints,
    settings.enabledLanguages,
    settings.activeLanguage,
    showLangPicker,
    keyContentScale,
    iconSize,
    letterFontSize,
  ]);

  return (
    <div
      className={`w-full overflow-visible select-none ${fontClass}`}
      style={{
        backgroundColor: theme.bg,
        boxShadow: settings.dynamicBackgroundGlow
          ? `0 -8px 30px -10px ${theme.accent}55`
          : undefined,
      }}
      dir="ltr"
    >
      {/* Top 7-Icon Editing Toolbar using official KurdiKeyboard vectors */}
      {settings.showTopToolbar && activePanel !== 'emoji' && (
        <div
          className="flex items-center justify-between px-3 py-1.5 border-b border-white/5"
          style={{ backgroundColor: theme.toolbarBg }}
        >
          <button
            type="button"
            onClick={() => {
              triggerSound('special');
              onSelectAll();
            }}
            className={`w-10 h-9 rounded-xl flex items-center justify-center active:scale-90 transition-all ${toolbarIconColor}`}
            title="دیاریکردنی هەموو"
          >
            <KurdiIcon name="ic_select_all" className="w-[20px] h-[20px]" />
          </button>

          <button
            type="button"
            onClick={() => {
              triggerSound('special');
              onCopy();
            }}
            className={`w-10 h-9 rounded-xl flex items-center justify-center active:scale-90 transition-all ${toolbarIconColor}`}
            title="کۆپیکردن"
          >
            <KurdiIcon name="ic_copy" className="w-[20px] h-[20px]" />
          </button>

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              triggerSound('special');
              onMoveCursor(-1);
            }}
            className={`w-10 h-9 rounded-xl flex items-center justify-center active:scale-90 transition-all ${toolbarIconColor}`}
            title="چەپ"
          >
            <KurdiIcon name="ic_left" className="w-[20px] h-[20px]" />
          </button>

          <button
            type="button"
            onClick={() => {
              triggerSound('special');
              setActivePanel((p) => (p === 'clipboard' ? 'keys' : 'clipboard'));
            }}
            className={`w-10 h-9 rounded-xl flex items-center justify-center active:scale-90 transition-all ${
              activePanel === 'clipboard' ? 'text-sky-400 bg-sky-500/15' : toolbarIconColor
            }`}
            title="لەبەرگیراوەکان"
          >
            <KurdiIcon name="ic_clipboards" className="w-[20px] h-[20px]" />
          </button>

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              triggerSound('special');
              onMoveCursor(1);
            }}
            className={`w-10 h-9 rounded-xl flex items-center justify-center active:scale-90 transition-all ${toolbarIconColor}`}
            title="ڕاست"
          >
            <KurdiIcon name="ic_right" className="w-[20px] h-[20px]" />
          </button>

          <button
            type="button"
            onClick={() => {
              triggerSound('special');
              onCut();
            }}
            className={`w-10 h-9 rounded-xl flex items-center justify-center active:scale-90 transition-all ${toolbarIconColor}`}
            title="بڕین"
          >
            <KurdiIcon name="ic_cuts" className="w-[20px] h-[20px]" />
          </button>

          <button
            type="button"
            onClick={() => {
              triggerSound('special');
              onPaste();
            }}
            className={`w-10 h-9 rounded-xl flex items-center justify-center active:scale-90 transition-all ${toolbarIconColor}`}
            title="لکاندن"
          >
            <KurdiIcon name="ic_pastes" className="w-[20px] h-[20px]" />
          </button>
        </div>
      )}

      {/* Voice Notice Banner */}
      {(isListeningVoice || voiceNotice) && (
        <div
          className="px-3 py-1.5 flex items-center justify-between text-xs bg-sky-500/15 text-sky-300 border-b border-sky-500/20"
          dir="rtl"
        >
          <span>{voiceNotice || 'گوێ دەگرێت... بە کوردی یان ئینگلیزی قسە بکە'}</span>
          {isListeningVoice && (
            <button
              type="button"
              onClick={toggleVoiceTyping}
              className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 font-semibold"
            >
              <MicOff className="w-3.5 h-3.5" />
              وەستان
            </button>
          )}
        </div>
      )}

      {/* Sub-Panels or Main Keyboard Deck */}
      {activePanel === 'emoji' ? (
        <EmojiZikrKaomojiPanel
          theme={theme}
          settings={settings}
          onUpdateSettings={onUpdateSettings}
          initialTab={richInitialTab}
          onInsert={handleRichInsert}
          onBackspace={onBackspace}
          onClose={() => setActivePanel('keys')}
          onOpenSettings={onOpenSettingsRoute}
          onStartEmojiSearch={() => {
            setEmojiSearchQuery('');
            setEmojiSearchMode(true);
            setViewMode('characters');
            setActivePanel('keys');
          }}
        />
      ) : activePanel === 'tools' ? (
        <ToolsGridPanel
          theme={theme}
          settings={settings}
          isListeningVoice={isListeningVoice}
          onSelectTool={handleSelectTool}
          onReorderTools={(newOrder) => onUpdateSettings({ toolsOrder: newOrder })}
          onClose={() => setActivePanel('keys')}
        />
      ) : activePanel === 'clipboard' ? (
        <ClipboardPanel
          theme={theme}
          settings={settings}
          items={clipboardItems}
          currentText={editorText}
          onPasteItem={(text) => {
            onInsertText(text);
            setActivePanel('keys');
          }}
          onSaveCurrent={() => onSaveToClipboard(editorText)}
          onTogglePin={onTogglePinClipboard}
          onEditItem={onEditClipboard}
          onTranslateItem={(text) => {
            setTranslateInitialText(text);
            setActivePanel('translate');
          }}
          onDeleteItem={onDeleteClipboard}
          onClearUnpinned={onClearUnpinnedClipboard}
          onClose={() => setActivePanel('keys')}
        />
      ) : activePanel === 'decorate' ? (
        <TextDecoratorPanel
          theme={theme}
          settings={settings}
          activeDecoratorId={activeDecoratorId}
          editorText={editorText}
          onSelectDecorator={(id) => setActiveDecoratorId(id)}
          onApplyToEditor={(transformed) => {
            (onReplaceAllText || onReplaceText)(transformed);
            setActivePanel('keys');
          }}
          onClose={() => setActivePanel('keys')}
        />
      ) : activePanel === 'themes' ? (
        <QuickThemesPanel
          theme={theme}
          settings={settings}
          onSelectTheme={(id) => onUpdateSettings({ activeThemeId: id })}
          onOpenThemeStore={() => {
            onOpenSettingsRoute('theme_store');
            setActivePanel('keys');
          }}
          onClose={() => setActivePanel('keys')}
        />
      ) : activePanel === 'resize' ? (
        <ResizePanel
          theme={theme}
          settings={settings}
          onUpdate={onUpdateSettings}
          onClose={() => setActivePanel('keys')}
        />
      ) : activePanel === 'translate' ? (
        <TranslatePanel
          theme={theme}
          settings={settings}
          editorText={editorText}
          initialText={translateInitialText}
          onUpdateSettings={onUpdateSettings}
          onInsertTranslated={(text, replaceAll) => {
            if (replaceAll) (onReplaceAllText || onReplaceText)(text);
            else onInsertText(text);
          }}
          onStartLiveTranslate={() => {
            setTranslateInitialText(null);
            setEmojiSearchMode(false);
            setLiveTranslateMode(true);
            setViewMode('characters');
            setActivePanel('keys');
          }}
          onClose={() => {
            setTranslateInitialText(null);
            setActivePanel('keys');
          }}
        />
      ) : activePanel === 'ai_smart' ? (
        <SmartAIPanel
          theme={theme}
          settings={settings}
          editorText={editorText}
          onApplyText={(text, replaceAll) => {
            if (replaceAll) (onReplaceAllText || onReplaceText)(text);
            else onInsertText(text);
          }}
          onClose={() => setActivePanel('keys')}
        />
      ) : activePanel === 'cursor_control' ? (
        <CursorControlPanel
          theme={theme}
          settings={settings}
          onMoveCursorEx={(dx, dy, select) => {
            if (onMoveCursorEx) {
              onMoveCursorEx(dx, dy, select);
            } else if (dx !== 0) {
              onMoveCursor(dx);
            }
          }}
          onMoveLineEdge={(toEnd, select) => {
            if (onMoveLineEdge) {
              onMoveLineEdge(toEnd, select);
            }
          }}
          onSelectAll={onSelectAll}
          onCopy={onCopy}
          onCut={onCut}
          onPaste={onPaste}
          onBackspace={onBackspace}
          onDeleteWord={onDeleteWord}
          onClose={() => setActivePanel('keys')}
        />
      ) : activePanel === 'snippets_calc' ? (
        <SnippetsCalcPanel
          theme={theme}
          settings={settings}
          initialTab={snippetsCalcTab}
          onInsertText={onInsertText}
          onUpdateSnippets={(quickSnippets) => onUpdateSettings({ quickSnippets })}
          onClose={() => setActivePanel('keys')}
        />
      ) : liveTranslateMode && liveTranslatePickingLang ? (
        <div
          className="w-full"
          style={{ height: `${Math.max(settings.keyboardHeightPx + 64, 315)}px` }}
        >
          <TranslationLanguagePicker
            title={
              liveTranslatePickingLang === 'src'
                ? 'هەڵبژاردنی زمانی سەرچاوە'
                : 'هەڵبژاردنی زمانی مەبەست'
            }
            selectedCode={
              liveTranslatePickingLang === 'src' ? liveTranslateSrc : liveTranslateTgt
            }
            includeAuto={liveTranslatePickingLang === 'src'}
            isLight={isLight}
            bgColor={theme.bg}
            onSelect={(code) => {
              if (liveTranslatePickingLang === 'src') {
                updateLiveSrc(code);
              } else {
                updateLiveTgt(code);
              }
            }}
            onClose={() => setLiveTranslatePickingLang(null)}
          />
        </div>
      ) : (
        <div className="flex flex-col w-full kb-noselect">
          {/* Inline Gboard-style Live Translate Bar OR Emoji Search Bar (types directly with the keyboard below!) */}
          {liveTranslateMode ? (
            <div className="flex flex-col border-b border-white/10 px-2 pt-1.5 pb-1.5 gap-1.5" dir="rtl">
              <div className="flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => {
                      triggerSound('special');
                      setLiveTranslatePickingLang(null);
                      setLiveTranslateMode(false);
                    }}
                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                      isLight ? 'bg-slate-200 text-slate-800' : 'bg-white/10 text-white'
                    }`}
                    title="داخستنی وەرگێڕانی ڕاستەوخۆ"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      triggerSound('special');
                      setLiveTranslatePickingLang('src');
                    }}
                    className={`h-7 px-2 rounded-lg text-[11px] font-bold border flex items-center gap-1 max-w-[105px] active:scale-95 transition-transform ${
                      isLight
                        ? 'bg-white border-slate-300 text-slate-900'
                        : 'bg-[#171920] border-white/10 text-white'
                    }`}
                    title="گۆڕینی زمانی سەرچاوە"
                  >
                    <span className="truncate">{getTranslationLang(liveTranslateSrc).shortLabel}</span>
                    <ChevronDown className="w-3 h-3 text-zinc-400 shrink-0" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      triggerSound('special');
                      if (liveTranslateSrc === 'auto') {
                        const nextSrc = liveTranslateTgt;
                        const nextTgt = liveTranslateTgt === 'ckb' ? 'en' : 'ckb';
                        updateLiveSrc(nextSrc);
                        updateLiveTgt(nextTgt);
                        return;
                      }
                      const prevSrc = liveTranslateSrc;
                      updateLiveSrc(liveTranslateTgt);
                      updateLiveTgt(prevSrc);
                    }}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 active:scale-95 transition-transform ${
                      isLight ? 'bg-slate-200 text-slate-700' : 'bg-white/10 text-sky-400'
                    }`}
                    title="ئاڵوگۆڕی زمان"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      triggerSound('special');
                      setLiveTranslatePickingLang('tgt');
                    }}
                    className={`h-7 px-2 rounded-lg text-[11px] font-bold border flex items-center gap-1 max-w-[105px] active:scale-95 transition-transform ${
                      isLight
                        ? 'bg-white border-slate-300 text-slate-900'
                        : 'bg-[#171920] border-white/10 text-white'
                    }`}
                    title="گۆڕینی زمانی مەبەست"
                  >
                    <span className="truncate">{getTranslationLang(liveTranslateTgt).shortLabel}</span>
                    <ChevronDown className="w-3 h-3 text-zinc-400 shrink-0" />
                  </button>
                </div>

                <button
                  type="button"
                  disabled={!liveTranslateQuery.trim()}
                  onClick={commitLiveTranslation}
                  className="h-7 px-2.5 rounded-lg bg-[#0B5FA8] hover:bg-[#0D70C7] disabled:opacity-40 text-white text-[11px] font-bold flex items-center gap-1 shrink-0 transition-colors"
                  title="ناردنی دەقە وەرگێڕدراوەکە"
                >
                  <Send className="w-3 h-3" />
                  <span>ناردن</span>
                </button>
              </div>

              {/* Live Input + Translated Output Preview */}
              <div className="grid grid-cols-1 gap-1">
                <div
                  className={`h-8 px-2.5 rounded-xl flex items-center justify-between gap-1.5 border overflow-hidden ${
                    isLight
                      ? 'bg-white border-sky-400 text-slate-900'
                      : 'bg-white/[0.08] border-sky-400/50 text-white'
                  }`}
                >
                  <div className="flex-1 text-xs font-medium truncate flex items-center" dir="auto">
                    {liveTranslateQuery ? (
                      <>
                        <span className="truncate">{liveTranslateQuery}</span>
                        <span className="inline-block w-[2px] h-3.5 bg-sky-400 mr-0.5 shrink-0" />
                      </>
                    ) : (
                      <span className="text-zinc-400 truncate">
                        بە کیبۆرد بنووسە بۆ وەرگێڕانی ڕاستەوخۆ (Enter بۆ ناردن)...
                      </span>
                    )}
                  </div>
                  {liveTranslateQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setLiveTranslateQuery('');
                        setLiveTranslateOutput('');
                      }}
                      className="text-zinc-400 hover:text-white shrink-0 p-0.5"
                      title="پاککردنەوە"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {(liveTranslateOutput || liveTranslateLoading) && (
                  <button
                    type="button"
                    onClick={commitLiveTranslation}
                    className={`min-h-[30px] px-2.5 py-1 rounded-xl flex items-center justify-between gap-2 text-right transition-colors ${
                      isLight
                        ? 'bg-sky-50 border border-sky-200 text-sky-900'
                        : 'bg-sky-500/15 border border-sky-400/30 text-sky-100'
                    }`}
                    dir="auto"
                  >
                    <span className="text-xs font-semibold truncate flex-1">
                      {liveTranslateOutput || 'وەرگێڕان...'}
                    </span>
                    {liveTranslateLoading && (
                      <Loader2 className="w-3.5 h-3.5 text-sky-400 animate-spin shrink-0" />
                    )}
                  </button>
                )}
              </div>
            </div>
          ) : emojiSearchMode ? (
            <div className="flex flex-col border-b border-white/10 px-2 pt-1.5 pb-1 gap-1.5" dir="rtl">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    triggerSound('special');
                    setEmojiSearchMode(false);
                    setRichInitialTab('emoji');
                    setActivePanel('emoji');
                  }}
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                    isLight ? 'bg-slate-200 text-slate-800' : 'bg-white/10 text-white'
                  }`}
                  title="گەڕانەوە بۆ خەندەکان"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
                <div
                  className={`flex-1 h-8 px-2.5 rounded-xl flex items-center gap-1.5 border overflow-hidden ${
                    isLight
                      ? 'bg-white border-sky-400 text-slate-900'
                      : 'bg-white/[0.08] border-sky-400/50 text-white'
                  }`}
                >
                  <Search className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <div className="flex-1 text-xs font-medium truncate flex items-center">
                    {emojiSearchQuery ? (
                      <>
                        <span className="truncate">{emojiSearchQuery}</span>
                        <span className="inline-block w-[2px] h-3.5 bg-sky-400 mr-0.5 shrink-0" />
                      </>
                    ) : (
                      <span className="text-zinc-400 truncate">
                        بە کوردی یان ئینگلیزی بنووسە (دڵ، پێکەنین، heart)...
                      </span>
                    )}
                  </div>
                  {emojiSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setEmojiSearchQuery('')}
                      className="text-zinc-400 hover:text-white shrink-0 p-0.5"
                      title="پاککردنەوە"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Horizontal Matching Emoji Strip */}
              <div className="flex items-center gap-1 overflow-x-auto custom-scroll h-10 px-0.5" dir="ltr">
                {emojiSearchResults.length > 0 ? (
                  emojiSearchResults.map((em, i) => (
                    <button
                      key={`${em}_${i}`}
                      type="button"
                      onClick={() => handleRichInsert(em, 'emoji')}
                      className="w-10 h-9 rounded-xl flex items-center justify-center text-2xl shrink-0 hover:bg-white/10 active:scale-90 transition-transform"
                    >
                      {em}
                    </button>
                  ))
                ) : (
                  <div className="w-full text-center text-xs text-zinc-400" dir="rtl">
                    هیچ خەندەیەک نەدۆزرایەوە
                  </div>
                )}
              </div>
            </div>
          ) : (
          /* Second Utility Strip: Left AI, Translate, Snippets/Calc | Suggestions & Inline Math */
          <div className="flex items-center px-1.5 py-1.5 gap-1.5 overflow-hidden">
            <div className="flex items-center gap-0.5 shrink-0">
              {settings.smartReplyEnabled && (
                <button
                  type="button"
                  onClick={() => {
                    triggerSound('special');
                    setActivePanel('ai_smart');
                  }}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${toolbarIconColor}`}
                  title="وەڵامدەرەوەی زیرەک (AI)"
                >
                  <KurdiIcon name="ic_smart" className="w-[19px] h-[19px]" />
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  triggerSound('special');
                  setTranslateInitialText(null);
                  setActivePanel('translate');
                }}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${toolbarIconColor}`}
                title="وەرگێڕان و وەرگێڕانی ڕاستەوخۆ"
              >
                <KurdiIcon name="ic_translate" className="w-[19px] h-[19px]" />
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerSound('special');
                  setSnippetsCalcTab('snippets');
                  setActivePanel('snippets_calc');
                }}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${toolbarIconColor}`}
                title="کلێشە و بژمێری خێرا"
              >
                <Calculator className="w-[17px] h-[17px]" />
              </button>
            </div>

            <div
              ref={suggestionsScrollRef}
              dir={resolvedLayout.direction === 'rtl' ? 'rtl' : 'ltr'}
              className={`flex-1 min-w-0 flex items-center justify-start gap-1.5 overflow-x-auto custom-scroll px-2 ${
                isLight ? 'border-l border-slate-200/80' : 'border-l border-white/10'
              }`}
            >
              {inlineMath && (
                <button
                  type="button"
                  onClick={handleInlineMathTap}
                  className={`h-7 px-2.5 rounded-lg text-xs font-extrabold font-mono tabular-nums whitespace-nowrap shrink-0 flex items-center gap-1 border transition-transform active:scale-95 ${
                    isLight
                      ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                  }`}
                  title={`ئەنجامی ${inlineMath.rawMatch} — داگرتن بۆ دانان`}
                  dir="ltr"
                >
                  <span>= {inlineMath.formatted}</span>
                </button>
              )}

              {activeDecoratorId !== 'none' && (
                <button
                  type="button"
                  onClick={() => setActiveDecoratorId('none')}
                  className="h-7 px-2.5 rounded-full bg-sky-500/20 text-sky-400 text-[11px] font-semibold whitespace-nowrap shrink-0"
                >
                  جوانکاری ×
                </button>
              )}

              {latestClipboardSuggestion && !currentWord && !inlineMath && (
                <button
                  type="button"
                  onClick={() => onInsertText(latestClipboardSuggestion.text)}
                  className={`h-7 px-2.5 rounded-full text-[11px] font-medium max-w-[160px] truncate shrink-0 flex items-center gap-1 ${
                    isLight
                      ? 'bg-slate-200 text-slate-800'
                      : 'bg-[#191B20] text-zinc-200 border border-white/5'
                  }`}
                  title={latestClipboardSuggestion.text}
                >
                  <KurdiIcon name="ic_clipboards" className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span className="truncate">{latestClipboardSuggestion.text}</span>
                </button>
              )}

              {suggestions.map((item, idx) => (
                <button
                  key={`${item.value}_${idx}`}
                  type="button"
                  onClick={() =>
                    handleSuggestionTap(item.value, item.isEmail, item.isEmoji, item.replaceLength)
                  }
                  title={item.isShortcut ? `${item.shortcutKey} : ${item.value}` : item.displayLabel || item.value}
                  dir={item.isEmail ? 'ltr' : 'auto'}
                  style={item.isEmail ? { unicodeBidi: 'isolate' } : undefined}
                  className={`h-7 px-2.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors flex items-center gap-1.5 ${
                    item.isEmoji ? `emoji-style-${settings.emojiStyle || 'system'}` : ''
                  } ${
                    item.isEmail
                      ? isLight
                        ? 'bg-sky-100 text-sky-900 border border-sky-300 font-semibold'
                        : 'bg-sky-500/20 text-sky-200 border border-sky-400/35 font-semibold'
                      : item.isShortcut
                      ? isLight
                        ? 'bg-sky-100 text-sky-900 border border-sky-300 font-bold max-w-[210px]'
                        : 'bg-sky-500/20 text-sky-200 border border-sky-400/35 font-bold max-w-[210px]'
                      : idx === 0 && currentWord
                      ? isLight
                        ? 'bg-sky-100 text-sky-800 font-bold'
                        : 'bg-sky-500/15 text-sky-300 font-bold'
                      : isLight
                      ? 'text-slate-700 hover:bg-slate-200'
                      : 'text-zinc-300 hover:bg-white/10'
                  }`}
                >
                  <span className="truncate">{item.displayLabel || item.value}</span>
                </button>
              ))}
            </div>
          </div>
          )}

          {/* Live Interactive Drag-to-Resize Top Handle Bar (activated via long-press on Emoji or Resize tool) */}
          {inlineResizeMode && (
            <div
              className="w-full px-3 py-1.5 flex items-center justify-between gap-2 cursor-ns-resize touch-none select-none border-t-2 border-b"
              style={{
                borderTopColor: theme.accent,
                borderBottomColor: `${theme.accent}44`,
                backgroundColor: isLight ? 'rgba(14,165,233,0.12)' : 'rgba(14,165,233,0.16)',
                touchAction: 'none',
              }}
              dir="rtl"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                try {
                  e.currentTarget.setPointerCapture(e.pointerId);
                } catch {
                  // ignore
                }
                const startY = e.screenY || e.clientY;
                resizeDragRef.current = {
                  pointerId: e.pointerId,
                  startY,
                  startHeight: settings.keyboardHeightPx,
                };
              }}
              onPointerMove={(e) => {
                const drag = resizeDragRef.current;
                if (!drag || drag.pointerId !== e.pointerId) return;
                const curY = e.screenY || e.clientY;
                // Dragging UP decreases Y -> increases keyboard height smoothly up to half-screen
                const deltaUp = drag.startY - curY;
                const nextH = Math.max(
                  210,
                  Math.min(maxHalfScreenHeight, Math.round(drag.startHeight + deltaUp))
                );
                if (nextH !== settings.keyboardHeightPx) {
                  onUpdateSettings({ keyboardHeightPx: nextH });
                }
              }}
              onPointerUp={(e) => {
                if (resizeDragRef.current?.pointerId === e.pointerId) {
                  resizeDragRef.current = null;
                }
              }}
              onPointerCancel={() => {
                resizeDragRef.current = null;
              }}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <MoveVertical className="w-4 h-4 shrink-0" style={{ color: theme.accent }} />
                <span
                  className={`text-[11px] font-bold truncate ${
                    isLight ? 'text-slate-900' : 'text-white'
                  }`}
                >
                  بەرزی تەختەکلیل ڕابکێشە
                </span>
              </div>

              {/* Center Grab Pill */}
              <div
                className="w-12 h-1.5 rounded-full shrink-0 opacity-85"
                style={{ backgroundColor: theme.accent }}
              />

              <span
                className="text-[11px] font-mono font-bold tabular-nums px-2 py-0.5 rounded-md shrink-0"
                style={{
                  backgroundColor: `${theme.accent}28`,
                  color: isLight ? '#0369A1' : '#FFFFFF',
                }}
              >
                {settings.keyboardHeightPx}px
              </span>
            </div>
          )}

          {/* One-handed wrapper */}
          <div
            className={`flex w-full items-stretch relative ${
              inlineResizeMode ? 'ring-2 ring-inset' : ''
            }`}
            style={
              inlineResizeMode
                ? ({ '--tw-ring-color': `${theme.accent}AA` } as React.CSSProperties)
                : undefined
            }
          >
            {settings.oneHandedMode === 'right' && (
              <div className="w-12 flex flex-col items-center justify-center gap-3 px-1">
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ oneHandedMode: 'left' })}
                  className="w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center"
                  title="گواستنەوە بۆ چەپ"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ oneHandedMode: 'off' })}
                  className="w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center"
                  title="تەختەکلیلی تەواو"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Key Rows Container (Main + Modifier Bottom Row rendered authentically from FlorisBoard JSON) */}
            <div
              ref={deckContainerRef}
              className="flex-1 flex flex-col px-[3px] pt-1 pb-1.5 relative touch-none select-none"
              style={{
                gap: `${vGapPx}px`,
                height: `${computedDeckHeight}px`,
                touchAction: 'none',
              }}
              onPointerDown={(e) => {
                // Only handle swipes that begin in the background gaps between keys (key buttons handle their own swipes exclusively)
                const target = e.target as HTMLElement | null;
                if (target?.closest('button[data-key-type]')) {
                  deckGapSwipeRef.current = null;
                  return;
                }
                deckGapSwipeRef.current = {
                  pointerId: e.pointerId,
                  startX: e.clientX,
                  startY: e.clientY,
                  time: Date.now(),
                };
              }}
              onPointerUp={(e) => {
                const gap = deckGapSwipeRef.current;
                if (!gap || gap.pointerId !== e.pointerId) return;
                deckGapSwipeRef.current = null;
                if (longPressMenuRef.current !== null) return;
                const dx = e.clientX - gap.startX;
                const dy = e.clientY - gap.startY;
                const elapsedSec = (Date.now() - gap.time) / 1000;
                tryExecuteGlobalSwipe(dx, dy, elapsedSec);
              }}
              onPointerCancel={() => {
                deckGapSwipeRef.current = null;
              }}
              onClick={() => {
                if (longPressMenu) setLongPressMenu(null);
                if (showLangPicker) setShowLangPicker(false);
                if (gesturePopup) setGesturePopup(null);
              }}
            >
              {/* Live Interactive Resize Floating Overlay (keeps real keys visible while resizing up to 50% of screen) */}
              {inlineResizeMode && (
                <div
                  className="absolute inset-0 z-50 flex items-center justify-center p-3 backdrop-blur-[1.5px]"
                  style={{
                    backgroundColor: isLight ? 'rgba(248,250,252,0.48)' : 'rgba(6,8,12,0.52)',
                  }}
                  dir="rtl"
                  onPointerDown={(e) => e.stopPropagation()}
                  onPointerUp={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    className={`w-full max-w-[330px] rounded-2xl p-3.5 shadow-2xl border space-y-3 ${
                      isLight
                        ? 'bg-white/95 border-slate-200 text-slate-900'
                        : 'bg-[#151821]/95 border-white/15 text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <KurdiIcon name="ic_resize" className="w-4 h-4 text-sky-400" />
                        <span className="text-xs font-extrabold">گۆڕینی قەبارەی کیبۆرد</span>
                      </div>
                      <span
                        className="text-[11px] font-mono font-bold tabular-nums px-2 py-0.5 rounded-lg"
                        style={{
                          backgroundColor: `${theme.accent}24`,
                          color: theme.accent,
                        }}
                      >
                        {settings.keyboardHeightPx}px ·{' '}
                        {Math.min(50, Math.round((settings.keyboardHeightPx / maxHalfScreenHeight) * 50))}%
                      </span>
                    </div>

                    {/* Smooth Height Slider (up to 50% of screen) */}
                    <div className="space-y-1">
                      <input
                        type="range"
                        min={210}
                        max={maxHalfScreenHeight}
                        value={Math.min(maxHalfScreenHeight, Math.max(210, settings.keyboardHeightPx))}
                        onChange={(e) => onUpdateSettings({ keyboardHeightPx: Number(e.target.value) })}
                        className="w-full accent-sky-500 h-2 cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] opacity-65">
                        <span>بچووک</span>
                        <span>ئاسایی</span>
                        <span>نیوەی شاشە (٥٠٪)</span>
                      </div>
                    </div>

                    {/* Quick 1-Tap Size Presets */}
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { label: 'بچووک', val: 224 },
                        { label: 'ئاسایی', val: 248 },
                        { label: 'نیوەی شاشە', val: maxHalfScreenHeight },
                      ].map((preset) => {
                        const isSel = Math.abs(settings.keyboardHeightPx - preset.val) <= 6;
                        return (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => {
                              triggerSound('special');
                              onUpdateSettings({ keyboardHeightPx: preset.val });
                            }}
                            className={`h-8 rounded-xl text-[11px] font-bold border transition-all active:scale-95 ${
                              isSel
                                ? 'text-white border-transparent'
                                : isLight
                                ? 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                                : 'bg-white/[0.06] border-white/10 text-zinc-200 hover:bg-white/10'
                            }`}
                            style={isSel ? { backgroundColor: theme.accent } : undefined}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Bottom Action Buttons: Reset + Save/Done */}
                    <div className="flex items-center gap-2 pt-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          triggerSound('special');
                          onUpdateSettings({ keyboardHeightPx: 248 });
                        }}
                        className={`h-9 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-colors active:scale-95 ${
                          isLight
                            ? 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                            : 'bg-white/[0.07] border-white/10 text-zinc-200 hover:bg-white/15'
                        }`}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>بنەڕەتی</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          triggerSound('special');
                          setInlineResizeMode(false);
                        }}
                        className="flex-1 h-9 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 text-white shadow-md active:scale-95 transition-transform"
                        style={{ backgroundColor: theme.accent }}
                      >
                        <Check className="w-4 h-4" />
                        <span>تەواو و پاشەکەوت</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Zero-rerender Floating Key Press Preview Bubble */}
              <div
                ref={keyPreviewRef}
                className="absolute z-40 min-w-[44px] h-11 px-2.5 rounded-xl flex items-center justify-center text-2xl font-bold shadow-xl pointer-events-none -translate-x-1/2"
                style={{
                  opacity: 0,
                  left: 0,
                  top: 0,
                  backgroundColor: theme.popupBg || theme.keyHoverBg,
                  color: theme.keyText,
                  border: `1px solid ${theme.popupBorder || `${theme.accent}66`}`,
                }}
              />

              {/* Floating Gesture Popup Strip (Arabic Harakat / Spacebar Custom Menu) */}
              {gesturePopup && (
                <div
                  className="absolute -top-12 left-2 right-2 z-50 flex items-center gap-1.5 px-2 py-1.5 rounded-2xl shadow-2xl overflow-x-auto custom-scroll"
                  style={{
                    backgroundColor: theme.popupBg || (isLight ? '#FFFFFF' : '#181C24'),
                    border: `1px solid ${theme.popupBorder || 'rgba(255,255,255,0.16)'}`,
                  }}
                  onClick={(e) => e.stopPropagation()}
                  dir="rtl"
                >
                  <button
                    type="button"
                    onClick={() => setGesturePopup(null)}
                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                      isLight ? 'bg-slate-200 text-slate-800' : 'bg-white/10 text-white'
                    }`}
                    title="داخستن"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[10.5px] font-bold text-sky-400 whitespace-nowrap shrink-0 px-1">
                    {gesturePopup.title}
                  </span>
                  {gesturePopup.options.map((opt, idx) => (
                    <button
                      key={`${opt.label}_${idx}`}
                      type="button"
                      onClick={() => {
                        triggerSound('char');
                        commitCharacter(opt.value);
                        setGesturePopup(null);
                      }}
                      className="h-8 px-2.5 rounded-xl text-xs font-bold whitespace-nowrap hover:bg-sky-500 hover:text-white transition-colors shrink-0 border border-white/10"
                      style={{ color: isLight ? '#0F172A' : '#FFFFFF' }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Connected Long-Press Extended Popup (Hold + Slide + Release) */}
              {!isEmailLongPress && longPressMenu && (() => {
                const { anchorRect, options, isPhrasePopup } = longPressMenu;
                const popupBg = theme.popupBg || (isLight ? '#FFFFFF' : '#20222A');
                const popupBorder = theme.popupBorder || (isLight ? 'rgba(15,23,42,0.14)' : 'rgba(255,255,255,0.12)');
                const maxTextLen = options.reduce((m, o) => {
                  const cleanVal = o.value.trim();
                  const shown =
                    (o.code === -255 || o.code === -1001) && cleanVal.length > 0 && cleanVal.length <= 28
                      ? cleanVal
                      : o.label.trim();
                  return Math.max(m, shown.length);
                }, 1);
                const estWidth = isPhrasePopup
                  ? Math.min(anchorRect.deckWidth - 12, Math.max(196, Math.min(272, maxTextLen * 9.5 + 48)))
                  : Math.min(anchorRect.deckWidth - 12, Math.max(54, Math.min(options.length, 6) * 46 + 16));
                const idealLeft = anchorRect.left + anchorRect.width / 2 - estWidth / 2;
                const clampedLeft = Math.max(
                  6,
                  Math.min(anchorRect.deckWidth - estWidth - 6, idealLeft)
                );
                const cardBottom = anchorRect.deckHeight - anchorRect.top - 4;

                return (
                  <>
                    {/* Connected Key Stem covering the held key */}
                    <div
                      className="absolute z-40 rounded-b-xl pointer-events-none"
                      style={{
                        left: `${anchorRect.left}px`,
                        top: `${anchorRect.top}px`,
                        width: `${anchorRect.width}px`,
                        height: `${anchorRect.height}px`,
                        backgroundColor: popupBg,
                        borderLeft: `1px solid ${popupBorder}`,
                        borderRight: `1px solid ${popupBorder}`,
                        borderBottom: `1px solid ${popupBorder}`,
                      }}
                    />

                    {/* Extended Popup Bubble above the held key */}
                    <div
                      ref={extendedPopupRef}
                      className={`absolute z-50 rounded-2xl shadow-2xl p-1.5 ${
                        isPhrasePopup
                          ? 'flex flex-col-reverse gap-1.5'
                          : 'flex flex-wrap items-center justify-center gap-1'
                      }`}
                      style={{
                        left: `${clampedLeft}px`,
                        bottom: `${cardBottom}px`,
                        width: isPhrasePopup ? `${estWidth}px` : 'auto',
                        minWidth: isPhrasePopup ? `${estWidth}px` : '52px',
                        maxWidth: `${Math.max(120, anchorRect.deckWidth - 12)}px`,
                        backgroundColor: popupBg,
                        border: `1px solid ${popupBorder}`,
                        boxShadow: '0 14px 36px rgba(0,0,0,0.55)',
                      }}
                      onClick={(e) => e.stopPropagation()}
                      dir="rtl"
                    >
                      {options.map((opt, oIdx) => {
                        const isActive = oIdx === longPressActiveIdx;
                        const isLtrOpt =
                          opt.value.startsWith('@') || /^[a-zA-Z0-9.@_+-]+$/.test(opt.label);
                        const cleanVal = opt.value.trim();
                        const shownLabel =
                          (opt.code === -255 || opt.code === -1001) &&
                          cleanVal.length > 0 &&
                          cleanVal.length <= 28
                            ? cleanVal
                            : opt.label;
                        return (
                          <button
                            key={`${opt.label}_${oIdx}`}
                            data-popup-opt-idx={oIdx}
                            type="button"
                            dir={isLtrOpt ? 'ltr' : 'auto'}
                            onClick={() => {
                              triggerSound('char');
                              commitCharacter(opt.value);
                              setLongPressMenu(null);
                            }}
                            className={`rounded-xl font-bold whitespace-nowrap flex items-center justify-center transition-colors duration-75 select-none ${
                              isPhrasePopup
                                ? 'w-full h-12 px-4 text-[15px]'
                                : 'min-w-[42px] h-11 px-2.5 text-lg'
                            }`}
                            style={{
                              backgroundColor: isActive ? '#FF6D00' : 'transparent',
                              color: isActive
                                ? '#111318'
                                : isLight
                                ? '#0F172A'
                                : '#FFFFFF',
                              boxShadow: isActive ? '0 4px 14px rgba(255,109,0,0.35)' : undefined,
                              unicodeBidi: isLtrOpt ? 'isolate' : undefined,
                            }}
                          >
                            <span className="truncate">{shownLabel}</span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                );
              })()}

              {/* Full-Width LTR Email Accounts Picker on @ Long-Press */}
              {isEmailLongPress && longPressMenu && (
                <div
                  ref={extendedPopupRef}
                  className="absolute inset-x-1.5 bottom-2 z-50 rounded-2xl shadow-2xl p-2 flex flex-col gap-2"
                  style={{
                    backgroundColor: theme.popupBg || (isLight ? '#FFFFFF' : '#181C24'),
                    border: `1px solid ${theme.popupBorder || 'rgba(56,189,248,0.35)'}`,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between px-1" dir="rtl">
                    <span className="text-[11px] font-bold text-sky-400">
                      هەژمارەکانی ئیمەیڵ (@)
                    </span>
                    <button
                      type="button"
                      onClick={() => setLongPressMenu(null)}
                      className={`w-6 h-6 rounded-full flex items-center justify-center ${
                        isLight ? 'bg-slate-200 text-slate-800' : 'bg-white/10 text-white'
                      }`}
                      title="داخستن"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div
                    className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto custom-scroll p-0.5"
                    dir="ltr"
                  >
                    {longPressMenu.options.map((opt, oIdx) => {
                      const isActive = oIdx === longPressActiveIdx;
                      return (
                        <button
                          key={`${opt.value}_${oIdx}`}
                          data-popup-opt-idx={oIdx}
                          type="button"
                          dir="ltr"
                          onClick={() => {
                            triggerSound('char');
                            commitCharacter(opt.value);
                            setLongPressMenu(null);
                          }}
                          className={`h-8 px-2.5 rounded-xl text-[12px] font-semibold whitespace-nowrap transition-colors border ${
                            isActive
                              ? 'bg-[#FF6D00] text-[#111318] border-[#FF6D00]'
                              : isLight
                              ? 'bg-slate-100 hover:bg-sky-500 hover:text-white text-slate-900 border-slate-200'
                              : 'bg-white/[0.07] hover:bg-sky-500 hover:text-white text-white border-white/10'
                          }`}
                          style={{ unicodeBidi: 'isolate' }}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {memoizedKeyRows}
            </div>

            {settings.oneHandedMode === 'left' && (
              <div className="w-12 flex flex-col items-center justify-center gap-3 px-1">
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ oneHandedMode: 'right' })}
                  className="w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center"
                  title="گواستنەوە بۆ ڕاست"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ oneHandedMode: 'off' })}
                  className="w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center"
                  title="تەختەکلیلی تەواو"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
