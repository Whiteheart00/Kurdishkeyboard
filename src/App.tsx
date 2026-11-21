import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import {
  AppLanguageCode,
  ClipboardItem,
  KeyboardSettings,
  LanguageConfig,
  SettingsRoute,
} from './types/keyboard';
import {
  DEFAULT_QUICK_SNIPPETS,
  DEFAULT_SETTINGS,
  DEFAULT_TOOLS_ORDER,
  INITIAL_CLIPBOARD,
} from './data/defaultSettings';
import { findSubtypePreset } from './data/layouts';
import { normalizeSwipeAction } from './data/gestures';
import { preloadSoundPack } from './utils/sound';
import { idbGet, idbSet, requestPersistentStorage } from './utils/persistentStorage';
import { KurdiIcon, KurdiLogo } from './components/icons/KurdiIcons';
import { KeyboardView } from './components/keyboard/KeyboardView';
import { HomeScreen } from './components/settings/HomeScreen';
import { AISettingsScreen, LanguagesScreen } from './components/settings/LanguagesScreen';
import {
  CustomThemeScreen,
  ThemesScreen,
  ThemeStoreScreen,
} from './components/settings/ThemesScreen';
import {
  EmojiSettingsScreen,
  KeyboardPrefsScreen,
} from './components/settings/KeyboardPrefsScreen';
import { LayoutEditorScreen } from './components/settings/LayoutEditorScreen';
import {
  AboutScreen,
  ClipboardSettingsScreen,
  FaqScreen,
  GesturesScreen,
  MoreSettingsScreen,
  PredictionsScreen,
  ProModal,
  SoundVibrationScreen,
} from './components/settings/SecondaryScreens';
import { FloatingKeyboardFAB } from './components/settings/SettingsUI';

const STORAGE_KEY_SETTINGS = 'kurdikebord_settings_v2';
const STORAGE_KEY_CLIPBOARD = 'kurdikebord_clipboard_v1';
const STORAGE_KEY_EDITOR = 'kurdikebord_editor_text_v1';
const STORAGE_KEY_MOBILE_VIEW = 'kurdikebord_mobile_view_v1';

interface AndroidImeBridge {
  commitText: (text: string) => void;
  deleteBackward: () => void;
  deleteWord: () => void;
  sendEnter: () => void;
  moveCursor: (delta: number) => void;
  selectAll: () => void;
  copy: () => void;
  cut: () => void;
  paste: () => void;
  hideKeyboard: () => void;
  openSettings: () => void;
  setKeyboardHeightDp: (dp: number) => void;
  getEditorText?: (preferSelection: boolean) => string;
  replaceAllText?: (text: string, preferSelection: boolean) => void;
  moveCursorEx?: (dx: number, dy: number, select: boolean) => void;
  moveLineEdge?: (toEnd: boolean, select: boolean) => void;
}

interface AndroidAppSetupBridge {
  isImeEnabled: () => boolean;
  isImeSelected: () => boolean;
  openImeSettings: () => void;
  openImePicker: () => void;
}

declare global {
  interface Window {
    AndroidIME?: AndroidImeBridge;
    AndroidAppSetup?: AndroidAppSetupBridge;
    __onAndroidClipboardSync?: (text: string) => void;
    __onAndroidImeRefresh?: (initialText?: string) => void;
    __onAndroidImeStatusChanged?: () => void;
  }
}

function hydrateSettings(partial: Partial<KeyboardSettings>): KeyboardSettings {
  const merged: KeyboardSettings = { ...DEFAULT_SETTINGS, ...partial };
  const validLangs: AppLanguageCode[] = ['ckb', 'kmr', 'en', 'ar', 'fa'];
  if (!validLangs.includes(merged.appLanguage)) {
    merged.appLanguage = 'ckb';
  }
  if (!merged.keyShapeStyle) {
    merged.keyShapeStyle = 'default';
  }
  if (typeof merged.textShortcutsEnabled !== 'boolean') {
    merged.textShortcutsEnabled = DEFAULT_SETTINGS.textShortcutsEnabled;
  }
  if (!Array.isArray(merged.textShortcuts)) {
    merged.textShortcuts = DEFAULT_SETTINGS.textShortcuts;
  }
  if (typeof merged.aiServerUrl !== 'string') {
    merged.aiServerUrl = '';
  }
  if (!Array.isArray(merged.quickSnippets)) {
    merged.quickSnippets = DEFAULT_QUICK_SNIPPETS;
  }
  if (Array.isArray(merged.toolsOrder)) {
    const missingTools = DEFAULT_TOOLS_ORDER.filter((t) => !merged.toolsOrder.includes(t));
    if (missingTools.length > 0) {
      merged.toolsOrder = [...missingTools, ...merged.toolsOrder];
    }
  } else {
    merged.toolsOrder = DEFAULT_TOOLS_ORDER;
  }
  if (Array.isArray(merged.enabledLanguages) && merged.enabledLanguages.length > 0) {
    merged.enabledLanguages = merged.enabledLanguages.map((lang: Partial<LanguageConfig>) => {
      const preset = findSubtypePreset(lang.code || 'ckb');
      return { ...preset, ...lang } as LanguageConfig;
    });
  } else {
    merged.enabledLanguages = DEFAULT_SETTINGS.enabledLanguages;
  }
  if (!merged.enabledLanguages.some((l) => l.code === merged.activeLanguage)) {
    merged.activeLanguage = merged.enabledLanguages[0].code;
  }
  // Normalize & migrate all 12 official KurdiKebord gesture preferences
  merged.swipeUpAction = normalizeSwipeAction(partial.swipeUpAction, DEFAULT_SETTINGS.swipeUpAction);
  merged.swipeDownAction = normalizeSwipeAction(partial.swipeDownAction, DEFAULT_SETTINGS.swipeDownAction);
  merged.swipeLeftAction = normalizeSwipeAction(partial.swipeLeftAction, DEFAULT_SETTINGS.swipeLeftAction);
  merged.swipeRightAction = normalizeSwipeAction(partial.swipeRightAction, DEFAULT_SETTINGS.swipeRightAction);
  merged.spaceBarSwipeUpAction = normalizeSwipeAction(
    partial.spaceBarSwipeUpAction,
    DEFAULT_SETTINGS.spaceBarSwipeUpAction
  );
  const legacySpaceLeft =
    partial.spaceBarSwipeLeftAction ??
    (partial.spacebarSwipeAction === 'move_cursor'
      ? 'move_cursor_left'
      : partial.spacebarSwipeAction === 'none'
      ? 'no_action'
      : undefined);
  const legacySpaceRight =
    partial.spaceBarSwipeRightAction ??
    (partial.spacebarSwipeAction === 'move_cursor'
      ? 'move_cursor_right'
      : partial.spacebarSwipeAction === 'none'
      ? 'no_action'
      : undefined);
  merged.spaceBarSwipeLeftAction = normalizeSwipeAction(
    legacySpaceLeft,
    DEFAULT_SETTINGS.spaceBarSwipeLeftAction
  );
  merged.spaceBarSwipeRightAction = normalizeSwipeAction(
    legacySpaceRight,
    DEFAULT_SETTINGS.spaceBarSwipeRightAction
  );
  merged.spaceBarLongPressAction = normalizeSwipeAction(
    partial.spaceBarLongPressAction,
    DEFAULT_SETTINGS.spaceBarLongPressAction
  );
  const legacyDelSwipe =
    partial.deleteKeySwipeLeftAction ??
    (partial.backspaceSwipeDeleteWord === false ? 'no_action' : undefined);
  merged.deleteKeySwipeLeftAction = normalizeSwipeAction(
    legacyDelSwipe,
    DEFAULT_SETTINGS.deleteKeySwipeLeftAction
  );
  merged.deleteKeyLongPressAction = normalizeSwipeAction(
    partial.deleteKeyLongPressAction,
    DEFAULT_SETTINGS.deleteKeyLongPressAction
  );
  if (typeof merged.swipeDistanceThreshold !== 'number' || merged.swipeDistanceThreshold < 16) {
    merged.swipeDistanceThreshold = DEFAULT_SETTINGS.swipeDistanceThreshold;
  }
  if (typeof merged.swipeVelocityThreshold !== 'number' || merged.swipeVelocityThreshold < 50) {
    merged.swipeVelocityThreshold = DEFAULT_SETTINGS.swipeVelocityThreshold;
  }
  return merged;
}

function loadSettings(): KeyboardSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (!raw) return DEFAULT_SETTINGS;
    return hydrateSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function loadClipboard(): ClipboardItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CLIPBOARD);
    if (!raw) return INITIAL_CLIPBOARD;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_CLIPBOARD;
  } catch {
    return INITIAL_CLIPBOARD;
  }
}

function loadEditorText(): string {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_EDITOR);
    return raw !== null ? raw : 'سڵاو! بەخێربێیت بۆ تەختەکلیلی کوردی ';
  } catch {
    return 'سڵاو! بەخێربێیت بۆ تەختەکلیلی کوردی ';
  }
}

function loadMobileView(): 'settings' | 'keyboard' {
  try {
    if (typeof window !== 'undefined' && window.AndroidAppSetup) {
      return 'settings';
    }
    const raw = localStorage.getItem(STORAGE_KEY_MOBILE_VIEW);
    return raw === 'settings' ? 'settings' : 'keyboard';
  } catch {
    return 'keyboard';
  }
}

export default function App() {
  const [settings, setSettings] = useState<KeyboardSettings>(loadSettings);
  const [clipboardItems, setClipboardItems] = useState<ClipboardItem[]>(loadClipboard);
  const [routeStack, setRouteStack] = useState<SettingsRoute[]>(['home']);
  const [mobileView, setMobileView] = useState<'settings' | 'keyboard'>(loadMobileView);
  const [proModalOpen, setProModalOpen] = useState(false);

  // Live Typing Playground State with Undo/Redo History (persisted across restarts)
  const [editorText, setEditorText] = useState<string>(loadEditorText);
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const [copiedToast, setCopiedToast] = useState<string | null>(null);
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imeDeckRef = useRef<HTMLDivElement>(null);
  const idbHydratedRef = useRef(false);
  const editorTextRef = useRef<string>(editorText);
  editorTextRef.current = editorText;
  const lastSettingsJsonRef = useRef<string>('');
  const lastClipboardJsonRef = useRef<string>('');

  const currentRoute = routeStack[routeStack.length - 1];
  const isLightApp = settings.appTheme === 'light';
  const isNativeImeMode =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('ime') === '1';
  const isAndroidApk =
    typeof window !== 'undefined' && Boolean(window.AndroidAppSetup);

  // Request browser persistent storage and recover from IndexedDB if localStorage was cleared after restart
  useEffect(() => {
    requestPersistentStorage();
    let cancelled = false;
    (async () => {
      try {
        const hasLocalClip = Boolean(localStorage.getItem(STORAGE_KEY_CLIPBOARD));
        const hasLocalSettings = Boolean(localStorage.getItem(STORAGE_KEY_SETTINGS));
        const hasLocalEditor = localStorage.getItem(STORAGE_KEY_EDITOR) !== null;

        if (!hasLocalClip) {
          const idbClip = await idbGet<ClipboardItem[]>(STORAGE_KEY_CLIPBOARD);
          if (!cancelled && Array.isArray(idbClip) && idbClip.length > 0) {
            setClipboardItems(idbClip);
          }
        }
        if (!hasLocalSettings) {
          const idbSettings = await idbGet<Partial<KeyboardSettings>>(STORAGE_KEY_SETTINGS);
          if (!cancelled && idbSettings) {
            setSettings(hydrateSettings(idbSettings));
          }
        }
        if (!hasLocalEditor) {
          const idbEditor = await idbGet<string>(STORAGE_KEY_EDITOR);
          if (!cancelled && typeof idbEditor === 'string') {
            setEditorText(idbEditor);
          }
        }
      } finally {
        idbHydratedRef.current = true;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Sync dark class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (isLightApp) {
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
    }
  }, [isLightApp]);

  // Preload active real audio sound pack buffers
  useEffect(() => {
    if (settings.soundEnabled) {
      preloadSoundPack(settings.soundPack);
    }
  }, [settings.soundEnabled, settings.soundPack]);

  // Persist settings & clipboard cleanly (skip redundant writes, debounce IndexedDB so typing stays 60fps)
  useEffect(() => {
    let serialized = '';
    try {
      serialized = JSON.stringify(settings);
      if (serialized !== lastSettingsJsonRef.current) {
        lastSettingsJsonRef.current = serialized;
        localStorage.setItem(STORAGE_KEY_SETTINGS, serialized);
      }
    } catch {
      // Ignore storage quota errors
    }
    const timer = window.setTimeout(() => {
      idbSet(STORAGE_KEY_SETTINGS, settings);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [settings]);

  useEffect(() => {
    let serialized = '';
    try {
      serialized = JSON.stringify(clipboardItems);
      if (serialized !== lastClipboardJsonRef.current) {
        lastClipboardJsonRef.current = serialized;
        localStorage.setItem(STORAGE_KEY_CLIPBOARD, serialized);
      }
    } catch {
      // Ignore storage quota errors
    }
    const timer = window.setTimeout(() => {
      idbSet(STORAGE_KEY_CLIPBOARD, clipboardItems);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [clipboardItems]);

  // NEVER block native Android IME keystrokes with localStorage/IndexedDB writes; debounce web playground persistence
  useEffect(() => {
    if (isNativeImeMode) return;
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY_EDITOR, editorText);
      } catch {
        // Ignore storage quota errors
      }
      idbSet(STORAGE_KEY_EDITOR, editorText);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [editorText, isNativeImeMode]);

  useEffect(() => {
    if (isNativeImeMode) return;
    try {
      localStorage.setItem(STORAGE_KEY_MOBILE_VIEW, mobileView);
    } catch {
      // Ignore
    }
  }, [mobileView, isNativeImeMode]);

  const updateSettings = useCallback((patch: Partial<KeyboardSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const navigateTo = useCallback((route: SettingsRoute) => {
    setRouteStack((prev) => {
      if (route === 'home') return ['home'];
      if (prev[prev.length - 1] === route) return prev;
      return [...prev, route];
    });
    setMobileView('settings');
  }, []);

  const goBack = useCallback(() => {
    setRouteStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : ['home']));
  }, []);

  const showToast = useCallback((msg: string) => {
    setCopiedToast(msg);
    window.setTimeout(() => setCopiedToast(null), 2000);
  }, []);

  // Editor Text Helpers with cursor preservation & undo history
  const pushUndo = useCallback((prevVal: string) => {
    setUndoStack((s) => [...s.slice(-40), prevVal]);
    setRedoStack([]);
  }, []);

  const handleInsertText = useCallback(
    (textToInsert: string) => {
      if (isNativeImeMode && window.AndroidIME) {
        window.AndroidIME.commitText(textToInsert);
        setEditorText((prev) => (prev + textToInsert).slice(-120));
        return;
      }
      const el = textareaRef.current;
      const prev = editorTextRef.current;
      pushUndo(prev);
      if (!el) {
        setEditorText(prev + textToInsert);
        return;
      }
      const start = el.selectionStart ?? prev.length;
      const end = el.selectionEnd ?? prev.length;
      const next = prev.slice(0, start) + textToInsert + prev.slice(end);
      setEditorText(next);
      requestAnimationFrame(() => {
        el.focus();
        const pos = start + textToInsert.length;
        el.setSelectionRange(pos, pos);
      });
    },
    [isNativeImeMode, pushUndo]
  );

  const handleReplaceText = useCallback(
    (nextText: string) => {
      if (isNativeImeMode && window.AndroidIME) {
        // Compute minimal suffix replacement for live shortcuts/predictions inside Android IME
        const prev = editorTextRef.current;
        let common = 0;
        const minLen = Math.min(prev.length, nextText.length);
        while (common < minLen && prev[common] === nextText[common]) common++;
        const deleteCount = [...prev.slice(common)].length;
        const insertPart = nextText.slice(common);
        for (let i = 0; i < deleteCount; i++) {
          window.AndroidIME.deleteBackward();
        }
        if (insertPart) {
          window.AndroidIME.commitText(insertPart);
        }
        setEditorText(nextText.slice(-120));
        return;
      }
      pushUndo(editorTextRef.current);
      setEditorText(nextText);
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (el) {
          el.focus();
          el.setSelectionRange(nextText.length, nextText.length);
        }
      });
    },
    [isNativeImeMode, pushUndo]
  );

  const handleReplaceAllText = useCallback(
    (nextText: string) => {
      if (isNativeImeMode && window.AndroidIME?.replaceAllText) {
        window.AndroidIME.replaceAllText(nextText, settings.aiTextSource === 'selected_or_all');
        setEditorText(nextText.slice(-1000));
        return;
      }
      handleReplaceText(nextText);
    },
    [handleReplaceText, isNativeImeMode, settings.aiTextSource]
  );

  const handleBackspace = useCallback(() => {
    if (isNativeImeMode && window.AndroidIME) {
      window.AndroidIME.deleteBackward();
      setEditorText((prev) => {
        if (!prev) return prev;
        const chars = [...prev];
        chars.pop();
        return chars.join('');
      });
      return;
    }
    const el = textareaRef.current;
    const prev = editorTextRef.current;
    if (!prev) return;
    pushUndo(prev);
    if (!el) {
      setEditorText(prev.slice(0, -1));
      return;
    }
    const start = el.selectionStart ?? prev.length;
    const end = el.selectionEnd ?? prev.length;
    if (start !== end) {
      const next = prev.slice(0, start) + prev.slice(end);
      setEditorText(next);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(start, start);
      });
      return;
    }
    if (start === 0) return;
    const charsBefore = [...prev.slice(0, start)];
    charsBefore.pop();
    const rebuiltBefore = charsBefore.join('');
    const next = rebuiltBefore + prev.slice(end);
    setEditorText(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(rebuiltBefore.length, rebuiltBefore.length);
    });
  }, [isNativeImeMode, pushUndo]);

  const handleDeleteWord = useCallback(() => {
    if (isNativeImeMode && window.AndroidIME) {
      window.AndroidIME.deleteWord();
      setEditorText((prev) => prev.replace(/\s*\S+\s*$/, ''));
      return;
    }
    const prev = editorTextRef.current;
    if (!prev) return;
    pushUndo(prev);
    setEditorText(prev.replace(/\s*\S+\s*$/, ''));
  }, [isNativeImeMode, pushUndo]);

  const handleMoveCursor = useCallback((visualDelta: number) => {
    if (isNativeImeMode && window.AndroidIME) {
      window.AndroidIME.moveCursor(visualDelta);
      return;
    }
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    const val = el.value;
    const selStart = el.selectionStart ?? 0;
    const selEnd = el.selectionEnd ?? selStart;

    // Detect current paragraph direction (matches HTML5 <textarea dir="auto"> unicode-bidi: plaintext)
    const lineStart = val.lastIndexOf('\n', Math.max(0, selStart - 1)) + 1;
    const nextNl = val.indexOf('\n', selStart);
    const lineEnd = nextNl === -1 ? val.length : nextNl;
    const line = val.slice(lineStart, lineEnd);

    const rtlStrong = /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
    const ltrStrong = /[A-Za-z\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF]/;

    let isRtlLine: boolean | null = null;
    for (const ch of line) {
      if (rtlStrong.test(ch)) {
        isRtlLine = true;
        break;
      }
      if (ltrStrong.test(ch)) {
        isRtlLine = false;
        break;
      }
    }
    if (isRtlLine === null) {
      for (const ch of val) {
        if (rtlStrong.test(ch)) {
          isRtlLine = true;
          break;
        }
        if (ltrStrong.test(ch)) {
          isRtlLine = false;
          break;
        }
      }
    }
    if (isRtlLine === null) {
      isRtlLine = window.getComputedStyle(el).direction === 'rtl';
    }

    const indexDelta = isRtlLine ? -visualDelta : visualDelta;

    if (selStart !== selEnd) {
      const collapsePos = indexDelta < 0 ? selStart : selEnd;
      el.setSelectionRange(collapsePos, collapsePos);
      return;
    }

    let next = selStart + indexDelta;
    if (indexDelta > 0 && next < val.length) {
      const code = val.charCodeAt(next - 1);
      if (code >= 0xd800 && code <= 0xdbff) next += 1;
    } else if (indexDelta < 0 && next > 0) {
      const code = val.charCodeAt(next);
      if (code >= 0xdc00 && code <= 0xdfff) next -= 1;
    }
    const pos = Math.max(0, Math.min(val.length, next));
    el.setSelectionRange(pos, pos);
  }, [isNativeImeMode]);

  const handleMoveCursorEx = useCallback(
    (dx: number, dy: number, select: boolean) => {
      if (isNativeImeMode && window.AndroidIME) {
        if (window.AndroidIME.moveCursorEx) {
          window.AndroidIME.moveCursorEx(dx, dy, select);
        } else if (dx !== 0) {
          window.AndroidIME.moveCursor(dx);
        }
        return;
      }
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      const val = el.value;
      const start = el.selectionStart ?? 0;
      const end = el.selectionEnd ?? start;
      const dir = el.selectionDirection || 'forward';
      const anchor = dir === 'backward' ? end : start;
      let focus = dir === 'backward' ? start : end;

      const isRtl =
        /[\u0600-\u06FF]/.test(val) || window.getComputedStyle(el).direction === 'rtl';

      if (dx !== 0) {
        const indexDelta = isRtl ? -dx : dx;
        if (!select && start !== end) {
          focus = indexDelta < 0 ? start : end;
        } else {
          focus = Math.max(0, Math.min(val.length, focus + indexDelta));
        }
      } else if (dy !== 0) {
        const lines = val.split('\n');
        let lineIdx = 0;
        let col = focus;
        for (let i = 0; i < lines.length; i++) {
          if (col <= lines[i].length) {
            lineIdx = i;
            break;
          }
          col -= lines[i].length + 1;
        }
        const targetLine = Math.max(0, Math.min(lines.length - 1, lineIdx + dy));
        let nextPos = 0;
        for (let i = 0; i < targetLine; i++) nextPos += lines[i].length + 1;
        nextPos += Math.min(col, lines[targetLine].length);
        focus = nextPos;
      }

      if (select) {
        const s = Math.min(anchor, focus);
        const e = Math.max(anchor, focus);
        el.setSelectionRange(s, e, focus < anchor ? 'backward' : 'forward');
      } else {
        el.setSelectionRange(focus, focus);
      }
    },
    [isNativeImeMode]
  );

  const handleMoveLineEdge = useCallback(
    (toEnd: boolean, select: boolean) => {
      if (isNativeImeMode && window.AndroidIME?.moveLineEdge) {
        window.AndroidIME.moveLineEdge(toEnd, select);
        return;
      }
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      const val = el.value;
      const start = el.selectionStart ?? 0;
      const end = el.selectionEnd ?? start;
      const dir = el.selectionDirection || 'forward';
      const anchor = dir === 'backward' ? end : start;
      const focus = dir === 'backward' ? start : end;

      const lineStart = val.lastIndexOf('\n', Math.max(0, focus - 1)) + 1;
      const nextNl = val.indexOf('\n', focus);
      const lineEnd = nextNl === -1 ? val.length : nextNl;
      const target = toEnd ? lineEnd : lineStart;

      if (select) {
        const s = Math.min(anchor, target);
        const e = Math.max(anchor, target);
        el.setSelectionRange(s, e, target < anchor ? 'backward' : 'forward');
      } else {
        el.setSelectionRange(target, target);
      }
    },
    [isNativeImeMode]
  );

  const handleSelectAll = useCallback(() => {
    if (isNativeImeMode && window.AndroidIME) {
      window.AndroidIME.selectAll();
      return;
    }
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(0, el.value.length);
    showToast('هەموو دەقەکە دیاریکرا');
  }, [isNativeImeMode, showToast]);

  const saveToClipboard = useCallback(
    (text: string) => {
      const clean = text.trim();
      if (!clean || !settings.clipboardHistoryEnabled) return;
      setClipboardItems((prev) => {
        const existing = prev.find((item) => item.text === clean);
        const filtered = prev.filter((item) => item.text !== clean);
        const next: ClipboardItem[] = [
          {
            id: existing?.id || `clip_${Date.now()}`,
            text: clean,
            timestamp: Date.now(),
            pinned: existing?.pinned,
          },
          ...filtered,
        ];
        // Preserve all pinned items and keep a generous permanent history so nothing is lost unexpectedly
        const limit = Math.max(settings.clipboardMaxItems || 20, 100);
        return next.slice(0, limit);
      });
    },
    [settings.clipboardHistoryEnabled, settings.clipboardMaxItems]
  );

  const handleEditClipboard = useCallback(
    (id: string, newText: string) => {
      const clean = newText.trim();
      if (!clean) return;
      setClipboardItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, text: clean, timestamp: Date.now() } : it))
      );
      showToast('لەبەرگیراوەکە دەستکاری کرا');
    },
    [showToast]
  );

  const handleCopy = useCallback(() => {
    if (isNativeImeMode && window.AndroidIME) {
      window.AndroidIME.copy();
      return;
    }
    const el = textareaRef.current;
    const currentText = editorTextRef.current;
    const selected =
      el && el.selectionStart !== el.selectionEnd
        ? currentText.slice(el.selectionStart, el.selectionEnd)
        : currentText;
    if (!selected.trim()) return;
    saveToClipboard(selected);
    navigator.clipboard?.writeText(selected).catch(() => {});
    showToast('کۆپی کرا بۆ لەبەرگیراوەکان');
  }, [isNativeImeMode, saveToClipboard, showToast]);

  const handleCut = useCallback(() => {
    if (isNativeImeMode && window.AndroidIME) {
      window.AndroidIME.cut();
      return;
    }
    const el = textareaRef.current;
    const currentText = editorTextRef.current;
    if (!currentText.trim()) return;
    if (el && el.selectionStart !== el.selectionEnd) {
      const selected = currentText.slice(el.selectionStart, el.selectionEnd);
      saveToClipboard(selected);
      navigator.clipboard?.writeText(selected).catch(() => {});
      const start = el.selectionStart;
      const next = currentText.slice(0, start) + currentText.slice(el.selectionEnd);
      handleReplaceText(next);
    } else {
      saveToClipboard(currentText);
      navigator.clipboard?.writeText(currentText).catch(() => {});
      handleReplaceText('');
    }
    showToast('بڕدرا و کۆپی کرا');
  }, [handleReplaceText, isNativeImeMode, saveToClipboard, showToast]);

  const handlePaste = useCallback(async () => {
    if (isNativeImeMode && window.AndroidIME) {
      window.AndroidIME.paste();
      return;
    }
    try {
      const clipText = await navigator.clipboard.readText();
      if (clipText) {
        handleInsertText(clipText);
        return;
      }
    } catch {
      // Fallback to in-app clipboard history
    }
    if (clipboardItems[0]) {
      handleInsertText(clipboardItems[0].text);
    }
  }, [clipboardItems, handleInsertText, isNativeImeMode]);

  const handleUndo = useCallback(() => {
    setUndoStack((stack) => {
      if (stack.length === 0) return stack;
      const previous = stack[stack.length - 1];
      setRedoStack((r) => [...r, editorTextRef.current]);
      setEditorText(previous);
      return stack.slice(0, -1);
    });
  }, []);

  const handleRedo = useCallback(() => {
    setRedoStack((stack) => {
      if (stack.length === 0) return stack;
      const next = stack[stack.length - 1];
      setUndoStack((u) => [...u, editorTextRef.current]);
      setEditorText(next);
      return stack.slice(0, -1);
    });
  }, []);

  // Physical Keyboard Sync highlight effect
  useEffect(() => {
    if (!settings.physicalKeyboardSync) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.length === 1) {
        setHighlightedKey(e.key);
        window.setTimeout(() => setHighlightedKey(null), 140);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [settings.physicalKeyboardSync]);

  const appSurfaceClass =
    settings.appTheme === 'light'
      ? 'bg-slate-50 text-slate-900'
      : settings.appTheme === 'dark'
      ? 'bg-[#0C0E12] text-white'
      : 'bg-black text-white';

  const settingsScreenElement = useMemo(() => {
    switch (currentRoute) {
      case 'languages':
        return (
          <LanguagesScreen
            settings={settings}
            onUpdate={updateSettings}
            onNavigate={navigateTo}
            onBack={goBack}
            isLightApp={isLightApp}
          />
        );
      case 'ai_settings':
        return (
          <AISettingsScreen
            settings={settings}
            onUpdate={updateSettings}
            onBack={goBack}
            onFocusKeyboard={() => {
              setMobileView('keyboard');
              textareaRef.current?.focus();
            }}
            isLightApp={isLightApp}
          />
        );
      case 'themes':
        return (
          <ThemesScreen
            settings={settings}
            onUpdate={updateSettings}
            onNavigate={navigateTo}
            onBack={goBack}
            isLightApp={isLightApp}
          />
        );
      case 'theme_store':
        return (
          <ThemeStoreScreen
            settings={settings}
            onUpdate={updateSettings}
            onBack={goBack}
            isLightApp={isLightApp}
          />
        );
      case 'custom_theme':
        return (
          <CustomThemeScreen
            settings={settings}
            onUpdate={updateSettings}
            onBack={goBack}
            isLightApp={isLightApp}
          />
        );
      case 'keyboard_prefs':
        return (
          <KeyboardPrefsScreen
            settings={settings}
            onUpdate={updateSettings}
            onBack={goBack}
            isLightApp={isLightApp}
          />
        );
      case 'emoji_settings':
        return (
          <EmojiSettingsScreen
            settings={settings}
            onUpdate={updateSettings}
            onBack={goBack}
            isLightApp={isLightApp}
          />
        );
      case 'layout_editor':
        return (
          <LayoutEditorScreen
            settings={settings}
            onUpdate={updateSettings}
            onBack={goBack}
            isLightApp={isLightApp}
          />
        );
      case 'clipboard_settings':
        return (
          <ClipboardSettingsScreen
            settings={settings}
            onUpdate={updateSettings}
            onBack={goBack}
            isLightApp={isLightApp}
          />
        );
      case 'sound_vibration':
        return (
          <SoundVibrationScreen
            settings={settings}
            onUpdate={updateSettings}
            onBack={goBack}
            isLightApp={isLightApp}
          />
        );
      case 'gestures':
        return (
          <GesturesScreen
            settings={settings}
            onUpdate={updateSettings}
            onBack={goBack}
            isLightApp={isLightApp}
          />
        );
      case 'predictions':
        return (
          <PredictionsScreen
            settings={settings}
            onUpdate={updateSettings}
            onBack={goBack}
            isLightApp={isLightApp}
          />
        );
      case 'more_settings':
        return (
          <MoreSettingsScreen
            settings={settings}
            onUpdate={updateSettings}
            onBack={goBack}
            isLightApp={isLightApp}
            onImportSettings={(data) => setSettings(hydrateSettings(data))}
            onResetAll={() => {
              setSettings(DEFAULT_SETTINGS);
              setClipboardItems(INITIAL_CLIPBOARD);
              showToast('هەموو ڕێکخستنەکان گەڕێنرانەوە');
            }}
          />
        );
      case 'faq':
        return <FaqScreen settings={settings} onBack={goBack} isLightApp={isLightApp} />;
      case 'about':
        return <AboutScreen onBack={goBack} isLightApp={isLightApp} />;
      case 'home':
      default:
        return (
          <HomeScreen
            settings={settings}
            onUpdate={updateSettings}
            onNavigate={navigateTo}
            onOpenProModal={() => setProModalOpen(true)}
            isLightApp={isLightApp}
          />
        );
    }
  }, [currentRoute, settings, updateSettings, navigateTo, goBack, isLightApp, showToast]);

  // Native Android InputMethodService (?ime=1) clipboard sync, deduplicated settings refresh & smooth ResizeObserver height bridge
  useEffect(() => {
    if (!isNativeImeMode) return;
    window.__onAndroidClipboardSync = (text: string) => {
      if (text) saveToClipboard(text);
    };
    window.__onAndroidImeRefresh = (initialText?: string) => {
      try {
        const rawSettings = localStorage.getItem(STORAGE_KEY_SETTINGS);
        if (rawSettings && rawSettings !== lastSettingsJsonRef.current) {
          lastSettingsJsonRef.current = rawSettings;
          setSettings(hydrateSettings(JSON.parse(rawSettings)));
        }
        const rawClip = localStorage.getItem(STORAGE_KEY_CLIPBOARD);
        if (rawClip && rawClip !== lastClipboardJsonRef.current) {
          lastClipboardJsonRef.current = rawClip;
          const parsed = JSON.parse(rawClip);
          if (Array.isArray(parsed)) setClipboardItems(parsed);
        }
      } catch {
        // Ignore storage read errors
      }
      if (typeof initialText === 'string') {
        setEditorText((prev) => (prev === initialText ? prev : initialText));
      } else if (window.AndroidIME?.getEditorText) {
        try {
          const fieldTxt = window.AndroidIME.getEditorText(false) || '';
          setEditorText((prev) => (prev === fieldTxt ? prev : fieldTxt));
        } catch {
          setEditorText('');
        }
      }
    };

    let lastSentHeight = 0;
    let heightRaf = 0;
    const syncExactHeight = () => {
      if (heightRaf) return;
      heightRaf = requestAnimationFrame(() => {
        heightRaf = 0;
        const el = imeDeckRef.current;
        if (!el) return;
        const measured = Math.ceil(el.getBoundingClientRect().height);
        if (measured >= 220 && measured <= 640 && measured !== lastSentHeight) {
          lastSentHeight = measured;
          window.AndroidIME?.setKeyboardHeightDp(measured);
        }
      });
    };

    syncExactHeight();
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && imeDeckRef.current) {
      observer = new ResizeObserver(syncExactHeight);
      observer.observe(imeDeckRef.current);
    }

    return () => {
      if (heightRaf) cancelAnimationFrame(heightRaf);
      observer?.disconnect();
      delete window.__onAndroidClipboardSync;
      delete window.__onAndroidImeRefresh;
    };
  }, [isNativeImeMode, saveToClipboard]);

  if (isNativeImeMode) {
    return (
      <div className="w-screen min-h-screen bg-black overflow-hidden flex flex-col justify-end select-none">
        <div ref={imeDeckRef} className="w-full">
          <KeyboardView
            settings={settings}
            onUpdateSettings={updateSettings}
            editorText={editorText}
            onInsertText={handleInsertText}
            onReplaceText={handleReplaceText}
            onReplaceAllText={handleReplaceAllText}
            onBackspace={handleBackspace}
            onDeleteWord={handleDeleteWord}
            onMoveCursor={handleMoveCursor}
            onMoveCursorEx={handleMoveCursorEx}
            onMoveLineEdge={handleMoveLineEdge}
            onSelectAll={handleSelectAll}
            onCopy={handleCopy}
            onCut={handleCut}
            onPaste={handlePaste}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onEnter={() => {
              if (window.AndroidIME) {
                window.AndroidIME.sendEnter();
              } else {
                handleInsertText('\n');
              }
            }}
            clipboardItems={clipboardItems}
            onSaveToClipboard={(txt) => saveToClipboard(txt)}
            onTogglePinClipboard={(id) =>
              setClipboardItems((prev) =>
                prev.map((it) => (it.id === id ? { ...it, pinned: !it.pinned } : it))
              )
            }
            onEditClipboard={handleEditClipboard}
            onDeleteClipboard={(id) =>
              setClipboardItems((prev) => prev.filter((it) => it.id !== id))
            }
            onClearUnpinnedClipboard={() =>
              setClipboardItems((prev) => prev.filter((it) => it.pinned))
            }
            onOpenSettingsRoute={() => window.AndroidIME?.openSettings()}
            onHideKeyboard={() => window.AndroidIME?.hideKeyboard()}
            highlightedPhysicalKey={highlightedKey}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen w-full flex flex-col ${appSurfaceClass}`}>
      {/* Mobile Quick Mode Switcher Bar (hidden on desktop where both columns are always visible side-by-side) */}
      <div
        className={`lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 h-12 border-b backdrop-blur-md ${
          isLightApp
            ? 'bg-white/90 border-slate-200'
            : 'bg-black/90 border-white/10'
        }`}
        dir="rtl"
      >
        <div className="flex items-center gap-2">
          <KurdiLogo className="w-6 h-6" />
          <span className="text-sm font-extrabold tracking-tight">تەختەکلیلی کوردی</span>
        </div>
        <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.06] border border-white/10">
          <button
            type="button"
            onClick={() => {
              setMobileView('keyboard');
              if (isAndroidApk) {
                requestAnimationFrame(() => textareaRef.current?.focus());
              }
            }}
            className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
              mobileView === 'keyboard'
                ? 'bg-[#0B5FA8] text-white'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <KurdiIcon name="ic_keyboards" className="w-3.5 h-3.5" />
            <span>تەختەکلیل</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileView('settings')}
            className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
              mobileView === 'settings'
                ? 'bg-[#0B5FA8] text-white'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <KurdiIcon name="ic_settings" className="w-3.5 h-3.5" />
            <span>ڕێکخستنەکان</span>
          </button>
        </div>
      </div>

      {/* Main Responsive Two-Column Studio Workspace on Desktop / Seamless Full-Height App on Mobile */}
      <div className="flex-1 w-full max-w-[1440px] mx-auto grid grid-cols-1 lg:grid-cols-12 min-h-0">
        {/* Column 1 (Right in RTL): Complete Companion Settings App */}
        <aside
          className={`lg:col-span-5 xl:col-span-4 lg:h-screen lg:overflow-y-auto custom-scroll relative lg:border-l ${
            isLightApp ? 'border-slate-200' : 'border-white/10'
          } ${mobileView === 'settings' ? 'block' : 'hidden lg:block'}`}
        >
          {settingsScreenElement}

          {/* Floating Bottom-Left Keyboard FAB matching Screenshots 17, 24, 26, 27, 28, 40 */}
          <div className="fixed lg:sticky bottom-5 left-5 lg:float-left lg:ml-4 lg:mb-4 z-30">
            <FloatingKeyboardFAB
              onClick={() => {
                setMobileView('keyboard');
                requestAnimationFrame(() => textareaRef.current?.focus());
              }}
            />
          </div>
        </aside>

        {/* Column 2 (Left in RTL): Live Interactive Testing Stage + Full Tactile Keyboard */}
        <main
          className={`lg:col-span-7 xl:col-span-8 flex flex-col justify-between lg:h-screen min-h-[calc(100vh-3rem)] lg:min-h-0 ${
            isLightApp ? 'bg-slate-100' : 'bg-[#07080B]'
          } ${mobileView === 'keyboard' ? 'flex' : 'hidden lg:flex'}`}
        >
          {/* Upper Live Playground Canvas */}
          <div className="flex-1 flex flex-col p-4 sm:p-6 gap-4 overflow-y-auto custom-scroll" dir="rtl">
            {/* Compact Desktop Playground Header */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-lg sm:text-xl font-extrabold tracking-tight">
                  تاقیکردنەوەی ڕاستەوخۆی تەختەکلیل
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  دەستڕاگرتن لەسەر پیتەکان پیتی لاوەکی و زیکر دەکاتەوە · ڕاکێشانی بۆشایی زمان دەگۆڕێت
                </p>
              </div>

              <div className="flex items-center gap-2">
                {isAndroidApk && (
                  <button
                    type="button"
                    onClick={() => window.AndroidAppSetup?.openImePicker()}
                    className="h-9 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-[#0B5FA8] hover:bg-[#0E70C4] text-white transition-colors"
                  >
                    <KurdiIcon name="ic_keyboards" className="w-3.5 h-3.5" />
                    <span>گۆڕینی کیبۆرد</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleCopy}
                  className={`h-9 px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-colors ${
                    isLightApp
                      ? 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
                      : 'bg-[#14171D] border-white/10 text-zinc-200 hover:bg-[#1D212A]'
                  }`}
                >
                  {copiedToast ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <KurdiIcon name="ic_copy" className="w-3.5 h-3.5" />
                  )}
                  <span>کۆپی</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleReplaceText('')}
                  className={`h-9 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-colors ${
                    isLightApp
                      ? 'bg-white border-slate-200 text-rose-600 hover:bg-rose-50'
                      : 'bg-[#14171D] border-white/10 text-rose-400 hover:bg-rose-500/10'
                  }`}
                >
                  <KurdiIcon name="ic_trash" className="w-3.5 h-3.5" />
                  <span>پاککردنەوە</span>
                </button>
              </div>
            </div>

            {/* Toast Feedback */}
            {copiedToast && (
              <div className="self-center px-4 py-1.5 rounded-full bg-sky-600 text-white text-xs font-bold shadow-lg">
                {copiedToast}
              </div>
            )}

            {/* Search / Live Text Input Card inspired by Screenshots 2-18 */}
            <div
              className={`flex-1 min-h-[140px] rounded-3xl p-4 sm:p-5 border flex flex-col justify-between gap-3 transition-colors ${
                isLightApp
                  ? 'bg-white border-slate-200 shadow-sm'
                  : 'bg-[#12161E] border-white/[0.08]'
              }`}
            >
              <textarea
                ref={textareaRef}
                value={editorText}
                onChange={(e) => setEditorText(e.target.value)}
                dir="auto"
                inputMode={isAndroidApk ? 'text' : 'none'}
                placeholder={
                  isAndroidApk
                    ? 'کلیک لێرە بکە بۆ تاقیکردنەوەی تەختەکلیلی کوردی...'
                    : 'لێرە بنووسە یان تەختەکلیلی خوارەوە تاقیبکەرەوە...'
                }
                className={`w-full flex-1 bg-transparent resize-none outline-none text-base sm:text-lg leading-relaxed placeholder:text-zinc-500 font-style-${settings.fontStyle}`}
              />

              <div className="flex items-center justify-between pt-3 border-t border-white/5 text-xs text-zinc-400 flex-wrap gap-2">
                <div className="flex items-center gap-3 tabular-nums">
                  <span>{editorText.length} پیت</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {editorText.trim() ? editorText.trim().split(/\s+/).length : 0} ووشە
                  </span>
                </div>

                {/* Quick Sample Phrases */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleInsertText('سڵاو، چۆنیت؟ ')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                      isLightApp
                        ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        : 'bg-white/[0.05] text-zinc-300 hover:bg-white/10'
                    }`}
                  >
                    + سڵاو
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertText('بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ ')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                      isLightApp
                        ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        : 'bg-white/[0.05] text-zinc-300 hover:bg-white/10'
                    }`}
                  >
                    + زیکر
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateTo('themes')}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-sky-500/15 text-sky-400 hover:bg-sky-500/25 flex items-center gap-1"
                  >
                    <KurdiIcon name="ic_themes" className="w-3.5 h-3.5" />
                    <span>گۆڕینی ڕووکار</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateTo('layout_editor')}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-sky-500/15 text-sky-400 hover:bg-sky-500/25 flex items-center gap-1"
                  >
                    <KurdiIcon name="ic_keyboard_keys" className="w-3.5 h-3.5" />
                    <span>ڕیزبەندی تایبەت</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Anchored Full Interactive Keyboard Deck (hidden inside installed Android APK so only the real system IME appears) */}
          {!isAndroidApk && (
            <div className="w-full max-w-[540px] lg:max-w-[660px] mx-auto w-full lg:px-6 lg:pb-5 shrink-0">
              <div className="lg:rounded-3xl overflow-hidden lg:border lg:border-white/10 shadow-2xl">
                <KeyboardView
                  settings={settings}
                  onUpdateSettings={updateSettings}
                  editorText={editorText}
                  onInsertText={handleInsertText}
                  onReplaceText={handleReplaceText}
                  onReplaceAllText={handleReplaceAllText}
                  onBackspace={handleBackspace}
                  onDeleteWord={handleDeleteWord}
                  onMoveCursor={handleMoveCursor}
                  onMoveCursorEx={handleMoveCursorEx}
                  onMoveLineEdge={handleMoveLineEdge}
                  onSelectAll={handleSelectAll}
                  onCopy={handleCopy}
                  onCut={handleCut}
                  onPaste={handlePaste}
                  onUndo={handleUndo}
                  onRedo={handleRedo}
                  onEnter={() => handleInsertText('\n')}
                  clipboardItems={clipboardItems}
                  onSaveToClipboard={(txt) => {
                    saveToClipboard(txt);
                    showToast('پاشەکەوت کرا لە لەبەرگیراوەکان');
                  }}
                  onTogglePinClipboard={(id) =>
                    setClipboardItems((prev) =>
                      prev.map((it) => (it.id === id ? { ...it, pinned: !it.pinned } : it))
                    )
                  }
                  onEditClipboard={handleEditClipboard}
                  onDeleteClipboard={(id) =>
                    setClipboardItems((prev) => prev.filter((it) => it.id !== id))
                  }
                  onClearUnpinnedClipboard={() =>
                    setClipboardItems((prev) => prev.filter((it) => it.pinned))
                  }
                  onOpenSettingsRoute={(r) => navigateTo(r)}
                  onHideKeyboard={() => setMobileView('settings')}
                  highlightedPhysicalKey={highlightedKey}
                />
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Pro Upgrade Preview Modal */}
      <ProModal
        open={proModalOpen}
        unlocked={settings.proUnlocked}
        onToggleUnlock={() => updateSettings({ proUnlocked: !settings.proUnlocked })}
        onClose={() => setProModalOpen(false)}
      />
    </div>
  );
}
