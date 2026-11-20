import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Maximize2, MicOff } from 'lucide-react';
import {
  ClipboardItem,
  KeyboardSettings,
  KeyboardViewMode,
  KeySpec,
  LanguageCode,
  PopupOption,
  SettingsRoute,
} from '../../types/keyboard';
import { findThemeById } from '../../data/themes';
import { composeHangul, resolveLayoutRows } from '../../data/layouts';
import {
  EMOJI_KEYWORD_MAP,
  ENGLISH_DICTIONARY,
  KURDISH_DICTIONARY,
  TEXT_DECORATORS,
} from '../../data/richContent';
import { getKeyShapeStyleProps } from '../../data/officialData';
import { playKeyFeedback, preloadSoundPack } from '../../utils/sound';
import { KurdiIcon } from '../icons/KurdiIcons';
import {
  ActiveKeyboardPanel,
  ClipboardPanel,
  EmojiZikrKaomojiPanel,
  QuickThemesPanel,
  ResizePanel,
  RichTab,
  SmartAIPanel,
  TextDecoratorPanel,
  ToolsGridPanel,
  TranslatePanel,
} from './KeyboardPanels';

interface KeyboardViewProps {
  settings: KeyboardSettings;
  onUpdateSettings: (patch: Partial<KeyboardSettings>) => void;
  editorText: string;
  onInsertText: (text: string) => void;
  onReplaceText: (text: string) => void;
  onBackspace: () => void;
  onDeleteWord: () => void;
  onMoveCursor: (delta: number) => void;
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
  onBackspace,
  onDeleteWord,
  onMoveCursor,
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
  const [translateInitialText, setTranslateInitialText] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<KeyboardViewMode>('characters');
  const [kanaMode, setKanaMode] = useState<'hira' | 'kata'>('hira');
  const [shiftState, setShiftState] = useState<'off' | 'once' | 'caps'>('off');
  const [activeDecoratorId, setActiveDecoratorId] = useState<string>('none');
  const [pressedKeyId, setPressedKeyId] = useState<string | null>(null);
  const [popupKey, setPopupKey] = useState<{ id: string; label: string } | null>(null);
  const [longPressMenu, setLongPressMenu] = useState<{
    keyId: string;
    options: PopupOption[];
  } | null>(null);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [isListeningVoice, setIsListeningVoice] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);

  const lastSpaceTapRef = useRef<number>(0);
  const lastShiftTapRef = useRef<number>(0);
  const longPressTimerRef = useRef<number | null>(null);
  const backspaceRepeatRef = useRef<number | null>(null);
  const spaceDragStartXRef = useRef<number | null>(null);
  const spaceDraggedRef = useRef<boolean>(false);
  const bkspDragStartXRef = useRef<number | null>(null);
  const deckTouchStartRef = useRef<{ x: number; y: number } | null>(null);
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

  // Compute current word & live predictions
  const currentWord = useMemo(() => {
    const match = editorText.match(/([^\s.,!?؟،:;]+)$/);
    return match ? match[1] : '';
  }, [editorText]);

  const suggestions = useMemo(() => {
    const shortcutsEnabled = settings.textShortcutsEnabled ?? true;
    if (!settings.wordSuggestions && !shortcutsEnabled) return [];

    const results: { value: string; isShortcut?: boolean; shortcutKey?: string }[] = [];
    const seen = new Set<string>();

    // 1. Custom Text Shortcuts (Exact match first, then prefix match)
    if (shortcutsEnabled && currentWord && Array.isArray(settings.textShortcuts)) {
      const lower = currentWord.toLowerCase();
      const exactMatches = settings.textShortcuts.filter(
        (sc) => sc.shortcut.trim().toLowerCase() === lower
      );
      const prefixMatches = settings.textShortcuts.filter((sc) => {
        const key = sc.shortcut.trim().toLowerCase();
        return key !== lower && key.startsWith(lower);
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

    // 2. Emoji suggestions for current word
    if (settings.emojiSuggestions && currentWord) {
      const emojiHits =
        EMOJI_KEYWORD_MAP[currentWord.toLowerCase()] || EMOJI_KEYWORD_MAP[currentWord];
      if (emojiHits) {
        for (const em of emojiHits.slice(0, 2)) {
          if (!seen.has(em)) {
            seen.add(em);
            results.push({ value: em });
          }
        }
      }
    }

    const isLatinLike =
      activeLangConfig?.dir === 'ltr' &&
      activeLangConfig?.characterLayoutId !== 'qwerty_kurdi' &&
      !(activeLangConfig?.characterLayoutId === 'kurdi_hybrid' && kanaMode === 'hira');

    const pool = [
      ...(settings.personalDictionaryEnabled ? settings.personalDictionary : []),
      ...(isLatinLike ? ENGLISH_DICTIONARY : KURDISH_DICTIONARY),
    ];

    if (currentWord) {
      const lower = currentWord.toLowerCase();
      for (const w of pool) {
        if (w.toLowerCase().startsWith(lower) && w !== currentWord && !seen.has(w)) {
          seen.add(w);
          results.push({ value: w });
          if (results.length >= 5) break;
        }
      }
    } else {
      const defaults = isLatinLike
        ? ['Hello', 'Thanks', 'Kurdistan', 'Awesome']
        : ['سڵاو', 'سوپاس', 'کوردستان', 'دەستخۆش'];
      for (const w of defaults) {
        if (!seen.has(w)) {
          seen.add(w);
          results.push({ value: w });
        }
      }
    }

    return results.slice(0, 5);
  }, [
    currentWord,
    settings.wordSuggestions,
    settings.textShortcutsEnabled,
    settings.textShortcuts,
    settings.emojiSuggestions,
    settings.personalDictionaryEnabled,
    settings.personalDictionary,
    activeLangConfig?.dir,
    activeLangConfig?.characterLayoutId,
    kanaMode,
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

  const commitCharacter = (raw: string) => {
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

    const decorated = applyActiveDecorator(raw);
    onInsertText(decorated);
    if (shiftState === 'once') {
      setShiftState('off');
    }
  };

  const handleSuggestionTap = (word: string) => {
    triggerSound('char');
    if (!currentWord) {
      onInsertText(`${word} `);
      return;
    }
    if (/^\p{Emoji}/u.test(word) && !/[a-zA-Z0-9\u0600-\u06FF]/.test(word)) {
      onInsertText(` ${word} `);
      return;
    }
    const replaced = editorText.slice(0, editorText.length - currentWord.length) + `${word} `;
    onReplaceText(replaced);
  };

  const handleSpaceClick = () => {
    triggerSound('space');
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
        onBackspace();
        return;
      case 'space':
        handleSpaceClick();
        return;
      case 'enter':
        triggerSound('enter');
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

  const handleKeyPointerDown = (key: KeySpec) => {
    setPressedKeyId(key.id);
    const isPrintable = !key.type || key.type === 'char' || key.type === 'comma' || key.type === 'period';
    if (settings.keyPopupPreview && isPrintable) {
      const label = shiftState !== 'off' && key.shiftPrimary ? key.shiftPrimary : key.primary;
      setPopupKey({ id: key.id, label });
    }

    if (key.type === 'backspace') {
      if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = window.setTimeout(() => {
        backspaceRepeatRef.current = window.setInterval(() => {
          onBackspace();
        }, 75);
      }, 360);
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
      longPressTimerRef.current = window.setTimeout(() => {
        setLongPressMenu({ keyId: key.id, options: normalized });
        setPopupKey(null);
        triggerSound('special');
      }, 400);
    }
  };

  const clearPointerState = () => {
    setPressedKeyId(null);
    setPopupKey(null);
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (backspaceRepeatRef.current) {
      window.clearInterval(backspaceRepeatRef.current);
      backspaceRepeatRef.current = null;
    }
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

  const handleRichInsert = (text: string, source: 'emoji' | 'zikr' | 'kaomoji') => {
    triggerSound('char');
    onInsertText(text);
    if (!settings.emojiHistoryEnabled) return;
    if (source === 'emoji') {
      const next = [text, ...settings.recentEmojis.filter((e) => e !== text)].slice(0, 28);
      onUpdateSettings({ recentEmojis: next });
    } else if (source === 'zikr') {
      const clean = text.trim();
      const next = [clean, ...settings.recentZikr.filter((e) => e !== clean)].slice(0, 16);
      onUpdateSettings({ recentZikr: next });
    } else {
      const clean = text.trim();
      const next = [clean, ...settings.recentKaomoji.filter((e) => e !== clean)].slice(0, 16);
      onUpdateSettings({ recentKaomoji: next });
    }
  };

  const handleSelectTool = (toolId: string) => {
    triggerSound('special');
    switch (toolId) {
      case 'translate':
        setTranslateInitialText(null);
        setActivePanel('translate');
        break;
      case 'resize':
        setActivePanel('resize');
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
  }, [activeLangConfig, viewMode, shiftState, kanaMode, settings]);

  const gapPx = Math.max(3, Math.round((settings.keySpacingPercent / 100) * 5));
  const letterFontSize = Math.round(16 * (settings.fontSizePercent / 100));
  const iconSize = Math.round(17 * (settings.iconSizePercent / 100));
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

  return (
    <div
      className={`w-full overflow-visible transition-colors duration-200 ${fontClass}`}
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
          initialTab={richInitialTab}
          onInsert={handleRichInsert}
          onBackspace={onBackspace}
          onClose={() => setActivePanel('keys')}
          onOpenSettings={onOpenSettingsRoute}
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
            onReplaceText(transformed);
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
          onInsertTranslated={(text, replaceAll) => {
            if (replaceAll) onReplaceText(text);
            else onInsertText(text);
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
            if (replaceAll) onReplaceText(text);
            else onInsertText(text);
          }}
          onClose={() => setActivePanel('keys')}
        />
      ) : (
        <div className="flex flex-col w-full kb-noselect">
          {/* Second Utility Strip matching authentic KurdiKeyboard layout: Left AI & Translate, Center Predictions/Clipboard, Right Zikr & Tools */}
          <div className="flex items-center justify-between px-2 py-1.5 gap-1.5">
            <div className="flex items-center gap-1 shrink-0">
              {settings.smartReplyEnabled && (
                <button
                  type="button"
                  onClick={() => {
                    triggerSound('special');
                    setActivePanel('ai_smart');
                  }}
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${toolbarIconColor}`}
                  title="وەڵامدەرەوەی زیرەک (AI)"
                >
                  <KurdiIcon name="ic_smart" className="w-[20px] h-[20px]" />
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  triggerSound('special');
                  setTranslateInitialText(null);
                  setActivePanel('translate');
                }}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${toolbarIconColor}`}
                title="وەرگێڕان"
              >
                <KurdiIcon name="ic_translate" className="w-[20px] h-[20px]" />
              </button>
            </div>

            <div className="flex-1 flex items-center justify-center gap-1.5 overflow-x-auto custom-scroll px-1">
              {activeDecoratorId !== 'none' && (
                <button
                  type="button"
                  onClick={() => setActiveDecoratorId('none')}
                  className="h-7 px-2.5 rounded-full bg-sky-500/20 text-sky-400 text-[11px] font-semibold whitespace-nowrap shrink-0"
                >
                  جوانکاری ×
                </button>
              )}

              {latestClipboardSuggestion && !currentWord && (
                <button
                  type="button"
                  onClick={() => onInsertText(latestClipboardSuggestion.text)}
                  className={`h-7 px-2.5 rounded-full text-[11px] font-medium max-w-[130px] truncate shrink-0 flex items-center gap-1 ${
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
                  onClick={() => handleSuggestionTap(item.value)}
                  title={item.isShortcut ? `${item.shortcutKey} : ${item.value}` : item.value}
                  dir="auto"
                  className={`h-7 px-2.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors flex items-center gap-1.5 ${
                    item.isShortcut
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
                  <span className="truncate">{item.value}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => {
                  triggerSound('special');
                  setRichInitialTab('zikr');
                  setActivePanel('emoji');
                }}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${toolbarIconColor}`}
                title="زیکر، خەندە و کاومۆجی"
              >
                <KurdiIcon name="ic_tasbih1" className="w-[20px] h-[20px]" />
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerSound('special');
                  setActivePanel('tools');
                }}
                className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                  isLight
                    ? 'bg-slate-200/90 text-slate-900 hover:bg-slate-300'
                    : 'bg-[#1A1B20] text-white hover:bg-[#262830]'
                }`}
                title="ئامرازەکان"
              >
                <KurdiIcon name="ic_moree" className="w-[19px] h-[19px]" />
              </button>
            </div>
          </div>

          {/* One-handed wrapper */}
          <div className="flex w-full items-stretch">
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
              className="flex-1 flex flex-col px-1.5 pb-2 relative"
              style={{
                gap: `${gapPx}px`,
                height: `${settings.keyboardHeightPx}px`,
              }}
              onTouchStart={(e) => {
                if (e.touches.length === 1) {
                  deckTouchStartRef.current = {
                    x: e.touches[0].clientX,
                    y: e.touches[0].clientY,
                  };
                }
              }}
              onTouchEnd={(e) => {
                if (!deckTouchStartRef.current || e.changedTouches.length !== 1) return;
                const dx = e.changedTouches[0].clientX - deckTouchStartRef.current.x;
                const dy = e.changedTouches[0].clientY - deckTouchStartRef.current.y;
                deckTouchStartRef.current = null;
                if (Math.abs(dy) > 95 && Math.abs(dy) > Math.abs(dx) * 1.8) {
                  if (dy > 0 && settings.swipeDownAction === 'hide') {
                    onHideKeyboard?.();
                  } else if (dy < 0 && settings.swipeUpAction === 'shift') {
                    setShiftState((prev) => (prev === 'off' ? 'once' : 'off'));
                  }
                }
              }}
              onClick={() => {
                if (longPressMenu) setLongPressMenu(null);
                if (showLangPicker) setShowLangPicker(false);
              }}
            >
              {resolvedLayout.rows.map((row, rIdx) => {
                const isLastRow = rIdx === resolvedLayout.rows.length - 1;
                const isCompactMidRow =
                  viewMode === 'characters' &&
                  !isLastRow &&
                  resolvedLayout.direction === 'ltr' &&
                  row.length === 9 &&
                  row.every((k) => !k.type || k.type === 'char');

                return (
                  <div
                    key={`row_${rIdx}`}
                    className={`flex-1 flex items-stretch ${isCompactMidRow ? 'px-3.5' : ''}`}
                    style={{ gap: `${gapPx}px` }}
                  >
                    {row.map((key, kIdx) => {
                      const isPressed =
                        pressedKeyId === key.id ||
                        Boolean(
                          highlightedPhysicalKey &&
                            key.type === 'char' &&
                            highlightedPhysicalKey.toLowerCase() === key.primary.toLowerCase()
                        );
                      const isSpecial = Boolean(key.type && key.type !== 'char');
                      const displayLabel =
                        key.type === 'space'
                          ? spaceLabel
                          : shiftState !== 'off' && key.shiftPrimary
                          ? key.shiftPrimary
                          : key.primary;

                      const popupAlignClass =
                        kIdx <= 1
                          ? 'left-0'
                          : kIdx >= row.length - 2
                          ? 'right-0'
                          : 'left-1/2 -translate-x-1/2';

                      let bg = theme.keyBg;
                      let textCol = theme.keyText;
                      let btnBorder = keyBorderCss;

                      if (key.type === 'enter') {
                        bg = theme.enterBg;
                        textCol = theme.enterText;
                        btnBorder = theme.enterBorder
                          ? `1px solid ${theme.enterBorder}`
                          : 'none';
                      } else if (key.type === 'space') {
                        bg = theme.spaceBg;
                        textCol = theme.spaceText || theme.secondaryText;
                      } else if (key.type === 'shift') {
                        bg =
                          shiftState !== 'off'
                            ? theme.accent
                            : theme.shiftBg || theme.specialKeyBg;
                        textCol =
                          shiftState !== 'off'
                            ? theme.enterText
                            : theme.shiftText || theme.specialKeyText;
                      } else if (key.type === 'backspace') {
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

                      const shapeStyleProps = getKeyShapeStyleProps(
                        settings.keyShapeStyle || 'default',
                        theme,
                        bg,
                        btnBorder,
                        keyShadowCss,
                        key.type === 'enter',
                        isPressed
                      );

                      return (
                        <div
                          key={key.id}
                          className="relative flex-1 flex min-w-0"
                          style={{ flex: key.width || 1 }}
                        >
                          {/* Floating Key Press Preview Bubble */}
                          {popupKey?.id === key.id && (
                            <div
                              className="absolute -top-12 left-1/2 -translate-x-1/2 z-40 min-w-[44px] h-11 px-2.5 rounded-xl flex items-center justify-center text-2xl font-bold shadow-xl pointer-events-none"
                              style={{
                                backgroundColor: theme.popupBg || theme.keyHoverBg,
                                color: theme.keyText,
                                border: `1px solid ${theme.popupBorder || `${theme.accent}66`}`,
                              }}
                            >
                              {popupKey.label}
                            </div>
                          )}

                          {/* Long-Press Alternate Picker Popup */}
                          {longPressMenu?.keyId === key.id && (
                            <div
                              className={`absolute -top-14 ${popupAlignClass} z-50 flex items-center gap-1 p-1.5 rounded-2xl shadow-2xl max-w-[300px] overflow-x-auto custom-scroll`}
                              style={{
                                backgroundColor:
                                  theme.popupBg || (isLight ? '#FFFFFF' : '#1E2128'),
                                border: `1px solid ${
                                  theme.popupBorder || 'rgba(255,255,255,0.16)'
                                }`,
                              }}
                              onClick={(e) => e.stopPropagation()}
                              dir="rtl"
                            >
                              {longPressMenu.options.map((opt, oIdx) => (
                                <button
                                  key={`${opt.label}_${oIdx}`}
                                  type="button"
                                  onClick={() => {
                                    triggerSound('char');
                                    commitCharacter(opt.value);
                                    setLongPressMenu(null);
                                  }}
                                  className="min-w-[36px] h-9 px-2.5 rounded-xl text-xs font-bold whitespace-nowrap hover:bg-sky-500 hover:text-white transition-colors shrink-0"
                                  style={{ color: isLight ? '#0F172A' : '#FFFFFF' }}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          )}

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
                                    onUpdateSettings({ activeLanguage: lang.code as LanguageCode });
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
                            onContextMenu={(e) => {
                              if (key.type === 'globe' && settings.showLanguagePickerOnLongPress) {
                                e.preventDefault();
                                setShowLangPicker((v) => !v);
                              }
                            }}
                            onPointerDown={(e) => {
                              if (key.type === 'backspace') {
                                bkspDragStartXRef.current = e.clientX;
                              } else if (key.type === 'space') {
                                spaceDragStartXRef.current = e.clientX;
                                spaceDraggedRef.current = false;
                              }
                              handleKeyPointerDown(key);
                            }}
                            onPointerMove={(e) => {
                              if (
                                key.type === 'space' &&
                                spaceDragStartXRef.current !== null &&
                                settings.spacebarSwipeAction === 'move_cursor'
                              ) {
                                const dx = e.clientX - spaceDragStartXRef.current;
                                if (Math.abs(dx) > 18) {
                                  onMoveCursor(dx > 0 ? 1 : -1);
                                  spaceDragStartXRef.current = e.clientX;
                                  spaceDraggedRef.current = true;
                                }
                              }
                            }}
                            onPointerUp={(e) => {
                              // Backspace swipe-left deletes whole word
                              if (
                                key.type === 'backspace' &&
                                settings.backspaceSwipeDeleteWord &&
                                bkspDragStartXRef.current !== null &&
                                bkspDragStartXRef.current - e.clientX > 36
                              ) {
                                bkspDragStartXRef.current = null;
                                clearPointerState();
                                triggerSound('backspace');
                                onDeleteWord();
                                return;
                              }
                              bkspDragStartXRef.current = null;

                              // Spacebar swipe switches language
                              if (key.type === 'space' && spaceDragStartXRef.current !== null) {
                                const dx = e.clientX - spaceDragStartXRef.current;
                                spaceDragStartXRef.current = null;
                                if (
                                  settings.spacebarSwipeAction === 'switch_lang' &&
                                  Math.abs(dx) > 34
                                ) {
                                  clearPointerState();
                                  cycleLanguage(dx > 0 ? 1 : -1);
                                  return;
                                }
                                if (spaceDraggedRef.current) {
                                  spaceDraggedRef.current = false;
                                  clearPointerState();
                                  return;
                                }
                              }

                              const wasMenuOpen =
                                longPressMenu?.keyId === key.id ||
                                (key.type === 'globe' && showLangPicker);
                              clearPointerState();
                              if (!wasMenuOpen) {
                                handleKeyTap(key);
                              }
                            }}
                            onPointerLeave={() => {
                              spaceDragStartXRef.current = null;
                              bkspDragStartXRef.current = null;
                              clearPointerState();
                            }}
                            onPointerCancel={() => {
                              spaceDragStartXRef.current = null;
                              bkspDragStartXRef.current = null;
                              clearPointerState();
                            }}
                            className={`w-full h-full relative flex items-center justify-center transition-transform px-0.5 overflow-hidden ${
                              shapeStyleProps.className
                            } ${isPressed && settings.keyAnimation ? 'scale-[0.93]' : ''}`}
                            style={{
                              ...shapeStyleProps.style,
                              color: textCol,
                            }}
                          >
                            {/* Top-right Secondary Hint Character / Zikr */}
                            {settings.showSecondaryHints &&
                              key.secondary &&
                              key.type !== 'space' &&
                              key.type !== 'enter' && (
                                <span
                                  className="absolute top-[2px] right-[3px] text-[8.5px] leading-none font-medium max-w-[92%] truncate pointer-events-none opacity-85"
                                  style={{ color: theme.secondaryText }}
                                >
                                  {key.secondary}
                                </span>
                              )}

                            {/* Main Key Icon / Label using official KurdiKeyboard VectorDrawables */}
                            {key.type === 'shift' ? (
                              <KurdiIcon
                                name={shiftState === 'caps' ? 'ic_shift_lock' : 'ic_shift'}
                                style={{ width: iconSize + 2, height: iconSize + 2 }}
                              />
                            ) : key.code === 1600 ? (
                              <KurdiIcon
                                name="ic_drezh"
                                style={{ width: iconSize + 5, height: iconSize + 5 }}
                              />
                            ) : key.type === 'backspace' ? (
                              <KurdiIcon
                                name="ic_delete"
                                style={{ width: iconSize + 2, height: iconSize + 2 }}
                              />
                            ) : key.type === 'enter' ? (
                              <KurdiIcon
                                name="ic_enter"
                                style={{ width: iconSize + 2, height: iconSize + 2 }}
                              />
                            ) : key.type === 'emoji' ? (
                              <KurdiIcon
                                name="ic_smile"
                                style={{ width: iconSize + 1, height: iconSize + 1 }}
                              />
                            ) : key.type === 'globe' ? (
                              <KurdiIcon
                                name="ic_global"
                                style={{ width: iconSize + 1, height: iconSize + 1 }}
                              />
                            ) : key.type === 'settings' ? (
                              <KurdiIcon
                                name="ic_settings"
                                style={{ width: iconSize + 1, height: iconSize + 1 }}
                              />
                            ) : key.type === 'copy' ? (
                              <KurdiIcon
                                name="ic_copy"
                                style={{ width: iconSize, height: iconSize }}
                              />
                            ) : key.type === 'cut' ? (
                              <KurdiIcon
                                name="ic_cuts"
                                style={{ width: iconSize, height: iconSize }}
                              />
                            ) : key.type === 'paste' ? (
                              <KurdiIcon
                                name="ic_pastes"
                                style={{ width: iconSize, height: iconSize }}
                              />
                            ) : key.type === 'select_all' ? (
                              <KurdiIcon
                                name="ic_select_all"
                                style={{ width: iconSize, height: iconSize }}
                              />
                            ) : key.type === 'space' ? (
                              <span className="text-xs font-semibold truncate px-2 opacity-90 flex items-center gap-1.5">
                                {spaceLabel ? (
                                  <>
                                    <span className="opacity-55 text-[10px]">‹</span>
                                    <span>{spaceLabel}</span>
                                    <span className="opacity-55 text-[10px]">›</span>
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
                                className="font-semibold leading-none truncate"
                                style={{
                                  fontSize: `${
                                    key.type === 'symbols' ||
                                    key.type === 'symbols2' ||
                                    key.type === 'characters' ||
                                    key.type === 'numeric_advanced' ||
                                    key.type === 'kana_toggle'
                                      ? Math.max(11, letterFontSize - 4)
                                      : displayLabel.length > 2
                                      ? Math.max(12, letterFontSize - 4)
                                      : letterFontSize
                                  }px`,
                                  marginTop:
                                    settings.showSecondaryHints && key.secondary ? '5px' : '0px',
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
              })}
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
