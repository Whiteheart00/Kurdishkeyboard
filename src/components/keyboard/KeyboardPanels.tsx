import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpDown,
  Check,
  ChevronDown,
  LayoutList,
  Loader2,
  Pencil,
  Pin,
  PinOff,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import {
  ClipboardItem,
  EmojiHistoryStore,
  KeyboardSettings,
  KeyboardTheme,
  SettingsRoute,
} from '../../types/keyboard';
import {
  EMOJI_CATEGORIES,
  EmojiEntry,
  getEmojiVariants,
  KAOMOJI_LIST,
  resolveEmojiWithModifiers,
  searchEmojis,
  TEXT_DECORATORS,
  ZIKR_CATEGORIES,
} from '../../data/richContent';
import {
  moveHistoryItem,
  removeHistoryItem,
  togglePinHistoryItem,
} from '../../utils/emojiHistory';
import { ALL_THEMES } from '../../data/themes';
import { KurdiIcon, KurdiIconName } from '../icons/KurdiIcons';
import { runOfflineSmartRewrite, ToneOptions } from '../../utils/kurdishSmartHelper';
import { resolveAiServer } from '../../utils/aiServer';
import { getTranslationLang } from '../../data/translationLanguages';
import { TranslationLanguagePicker } from './TranslationLanguagePicker';
import { EmojiGlyph } from './EmojiGlyph';

export type ActiveKeyboardPanel =
  | 'keys'
  | 'emoji'
  | 'tools'
  | 'clipboard'
  | 'decorate'
  | 'themes'
  | 'resize'
  | 'translate'
  | 'ai_smart'
  | 'cursor_control'
  | 'snippets_calc';

export type RichTab = 'emoji' | 'zikr' | 'kaomoji';
export type RichInsertSource = 'emoji' | 'duaa' | 'quran' | 'salawat' | 'kaomoji';

interface EmojiZikrKaomojiPanelProps {
  theme: KeyboardTheme;
  settings: KeyboardSettings;
  onUpdateSettings: (patch: Partial<KeyboardSettings>) => void;
  initialTab?: RichTab;
  onInsert: (text: string, source: RichInsertSource) => void;
  onBackspace: () => void;
  onClose: () => void;
  onOpenSettings: (route: SettingsRoute) => void;
  onStartEmojiSearch?: () => void;
}

interface HistoryActionTarget {
  section: RichInsertSource;
  bucket: 'pinned' | 'recent';
  value: string;
  label?: string;
}

export const EmojiZikrKaomojiPanel: React.FC<EmojiZikrKaomojiPanelProps> = ({
  theme,
  settings,
  onUpdateSettings,
  initialTab = 'emoji',
  onInsert,
  onBackspace,
  onClose,
  onOpenSettings,
  onStartEmojiSearch,
}) => {
  const orderedEnabledCategories = useMemo(() => {
    const disabled = new Set(settings.emojiDisabledCategories || []);
    const order = settings.emojiCategoryOrder || [];
    const byId = new Map(EMOJI_CATEGORIES.map((c) => [c.id, c]));
    const result = [];
    for (const id of order) {
      const cat = byId.get(id);
      if (cat && !disabled.has(cat.id)) {
        result.push(cat);
        byId.delete(id);
      }
    }
    for (const cat of byId.values()) {
      if (!disabled.has(cat.id)) result.push(cat);
    }
    return result.length > 0 ? result : EMOJI_CATEGORIES;
  }, [settings.emojiCategoryOrder, settings.emojiDisabledCategories]);

  const computeInitialEmojiCat = () => {
    if (settings.emojiInitialTab === 'recent' && settings.emojiHistoryEnabled) {
      return 'recent';
    }
    const last = settings.emojiLastUsedCategory;
    if (last === 'recent' && settings.emojiHistoryEnabled) return 'recent';
    if (orderedEnabledCategories.some((c) => c.id === last)) return last;
    return orderedEnabledCategories[0]?.id || 'smileys_emotion';
  };

  const [activeTab, setActiveTab] = useState<RichTab>(initialTab);
  const [emojiCat, setEmojiCat] = useState<string>(computeInitialEmojiCat);
  const [emojiSearch, setEmojiSearch] = useState<string>('');
  const [variantPopup, setVariantPopup] = useState<{
    base: string;
    rendered: string;
    variants: string[];
  } | null>(null);
  const [historyAction, setHistoryAction] = useState<HistoryActionTarget | null>(null);
  const [zikrCat, setZikrCat] = useState<'recent' | 'duaa' | 'quran' | 'salawat'>('duaa');
  const [kaomojiCat, setKaomojiCat] = useState<'recent' | 'all'>('all');

  const pressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef<boolean>(false);
  const mountedAtRef = useRef<number>(Date.now());
  const hasSeenPointerDownRef = useRef(false);

  const isLight = Boolean(theme.isLight);
  const isMessengerStyle = settings.emojiStyle === 'facebook';
  const panelBg = theme.bg;
  const mutedText = isLight ? 'text-slate-500' : 'text-zinc-400';
  const mainText = isLight ? 'text-slate-900' : 'text-white';
  const pillBg = isLight ? 'bg-slate-200/80' : 'bg-zinc-800/80';
  const activePillBg = isMessengerStyle
    ? isLight
      ? 'bg-[#0084FF]/15 text-[#0084FF]'
      : 'bg-[#0084FF]/25 text-[#4AA8FF]'
    : isLight
    ? 'bg-blue-100 text-blue-700'
    : 'bg-[#17283D] text-[#74B3FF]';
  const subheaderBg = isLight
    ? 'bg-gradient-to-l from-slate-200/90 via-slate-200/50 to-transparent text-slate-700'
    : 'bg-gradient-to-l from-white/[0.08] via-white/[0.04] to-transparent text-zinc-300';

  const emojiFontClass = `emoji-style-${settings.emojiStyle || 'system'}`;
  const emojiFontSize = Math.max(18, Math.min(36, settings.emojiFontSizePx || 24));
  const emojiCellHeight = Math.max(38, Math.round(emojiFontSize * 1.75));
  const zikrFontSize = Math.max(10, Math.min(18, settings.zikrFontSizePx || 12));
  const isManualSort =
    settings.emojiHistoryUpdateStrategy === 'manual_prepend' ||
    settings.emojiHistoryUpdateStrategy === 'manual_append';

  const selectEmojiCat = (nextCat: string) => {
    setEmojiSearch('');
    setEmojiCat(nextCat);
    if (settings.emojiLastUsedCategory !== nextCat) {
      onUpdateSettings({ emojiLastUsedCategory: nextCat });
    }
  };

  const getStoreForSection = (section: RichInsertSource): EmojiHistoryStore => {
    if (section === 'emoji') {
      return {
        pinned: settings.emojiPinned || [],
        recent: settings.recentEmojis || [],
      };
    }
    if (section === 'kaomoji') {
      return {
        pinned: settings.kaomojiPinned || [],
        recent: settings.recentKaomoji || [],
      };
    }
    const zh = settings.zikrHistories?.[section];
    return {
      pinned: zh?.pinned || [],
      recent: zh?.recent || [],
    };
  };

  const saveStoreForSection = (section: RichInsertSource, next: EmojiHistoryStore) => {
    if (section === 'emoji') {
      onUpdateSettings({ emojiPinned: next.pinned, recentEmojis: next.recent });
      return;
    }
    if (section === 'kaomoji') {
      onUpdateSettings({ kaomojiPinned: next.pinned, recentKaomoji: next.recent });
      return;
    }
    const currentAll = settings.zikrHistories || {
      duaa: { pinned: [], recent: [] },
      quran: { pinned: [], recent: [] },
      salawat: { pinned: [], recent: [] },
    };
    const nextHistories = {
      ...currentAll,
      [section]: next,
    };
    const combinedRecent = Array.from(
      new Set([
        ...nextHistories.duaa.pinned,
        ...nextHistories.quran.pinned,
        ...nextHistories.salawat.pinned,
        ...nextHistories.duaa.recent,
        ...nextHistories.quran.recent,
        ...nextHistories.salawat.recent,
      ])
    ).slice(0, settings.emojiHistoryRecentMaxSize || 40);
    onUpdateSettings({ zikrHistories: nextHistories, recentZikr: combinedRecent });
  };

  const displayedEmojis = useMemo<EmojiEntry[]>(() => {
    if (emojiSearch.trim()) {
      return searchEmojis(emojiSearch, 84);
    }
    if (emojiCat === 'recent') {
      return [];
    }
    return EMOJI_CATEGORIES.find((c) => c.id === emojiCat)?.items || [];
  }, [emojiSearch, emojiCat]);

  const clearHold = () => {
    if (pressTimerRef.current) {
      window.clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  const startEmojiHold = (entry: EmojiEntry, rendered: string) => {
    longPressTriggeredRef.current = false;
    clearHold();
    const variants = getEmojiVariants(entry, settings.emojiSkinTone);
    pressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      setHistoryAction(null);
      setVariantPopup({
        base: entry.c,
        rendered,
        variants: variants.length > 1 ? variants : [rendered],
      });
    }, 360);
  };

  const startHistoryHold = (target: HistoryActionTarget) => {
    longPressTriggeredRef.current = false;
    clearHold();
    pressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      setVariantPopup(null);
      setHistoryAction(target);
    }, 340);
  };

  const handleTogglePin = (section: RichInsertSource, value: string) => {
    const store = getStoreForSection(section);
    const next = togglePinHistoryItem(
      store,
      value,
      settings.emojiHistoryPinnedMaxSize || 24,
      settings.emojiHistoryRecentMaxSize || 40
    );
    saveStoreForSection(section, next);
  };

  const handleMoveHistory = (
    section: RichInsertSource,
    bucket: 'pinned' | 'recent',
    value: string,
    delta: -1 | 1
  ) => {
    const store = getStoreForSection(section);
    const next = moveHistoryItem(store, value, bucket, delta);
    saveStoreForSection(section, next);
  };

  const handleRemoveHistory = (section: RichInsertSource, value: string) => {
    const store = getStoreForSection(section);
    const next = removeHistoryItem(store, value);
    saveStoreForSection(section, next);
  };

  const emojiStore = getStoreForSection('emoji');
  const kaomojiStore = getStoreForSection('kaomoji');
  const duaaStore = getStoreForSection('duaa');
  const quranStore = getStoreForSection('quran');
  const salawatStore = getStoreForSection('salawat');

  const zikrSubTabs: { id: 'recent' | 'duaa' | 'quran' | 'salawat'; label: string; icon: KurdiIconName }[] = [
    { id: 'recent', label: 'دوایینەکان', icon: 'ic_history1' },
    { id: 'duaa', label: 'دوعا و زیکر', icon: 'ic_zikr' },
    { id: 'quran', label: 'قورئانی', icon: 'ic_ayat' },
    { id: 'salawat', label: 'سەڵاوات', icon: 'ic_tasbih1' },
  ];

  const renderSubheader = (title: string, count?: number, isPinnedSection?: boolean) => (
    <div
      className={`flex items-center justify-between px-2.5 py-1 rounded-xl ${subheaderBg}`}
      dir="rtl"
    >
      <span className="text-[11px] font-bold flex items-center gap-1.5">
        {isPinnedSection && <Pin className="w-3 h-3 text-[#74B3FF]" />}
        <span>{title}</span>
      </span>
      {typeof count === 'number' && (
        <span className={`text-[10px] font-mono tabular-nums ${mutedText}`}>{count}</span>
      )}
    </div>
  );

  return (
    <div
      className="flex flex-col w-full kb-noselect relative"
      style={{ backgroundColor: panelBg, height: `${Math.max(settings.keyboardHeightPx + 44, 332)}px` }}
      dir="ltr"
      onPointerDownCapture={() => {
        hasSeenPointerDownRef.current = true;
      }}
      onClickCapture={(e) => {
        if (!hasSeenPointerDownRef.current && Date.now() - mountedAtRef.current < 450) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      onClick={() => {
        if (variantPopup) setVariantPopup(null);
        if (historyAction) setHistoryAction(null);
      }}
    >
      {/* Top Expanding Category Tab Bar (Matching original ck.java expanding active tab!) */}
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-white/5 shrink-0 gap-1">
        {activeTab === 'emoji' && (
          <div className="flex items-center gap-1 overflow-x-auto custom-scroll flex-1 py-0.5">
            {settings.emojiHistoryEnabled && (
              <button
                type="button"
                onClick={() => selectEmojiCat('recent')}
                className={`h-9 rounded-full flex items-center justify-center gap-1.5 transition-all shrink-0 whitespace-nowrap ${
                  emojiCat === 'recent' && !emojiSearch
                    ? `${activePillBg} px-3 font-bold`
                    : `${mutedText} w-9 hover:bg-white/5`
                }`}
                title="دوایینەکان"
              >
                <KurdiIcon name="ic_history1" className="w-4 h-4 shrink-0" />
                {emojiCat === 'recent' && !emojiSearch && (
                  <span className="text-[11px]">دوایینەکان</span>
                )}
              </button>
            )}
            {orderedEnabledCategories.map((cat) => {
              const active = emojiCat === cat.id && !emojiSearch;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => selectEmojiCat(cat.id)}
                  className={`h-9 rounded-full flex items-center justify-center gap-1.5 transition-all shrink-0 whitespace-nowrap ${
                    active
                      ? `${activePillBg} px-3 font-bold`
                      : 'w-9 opacity-75 hover:opacity-100 hover:bg-white/5'
                  }`}
                  title={cat.label}
                >
                  <EmojiGlyph emoji={cat.icon} styleMode={settings.emojiStyle} sizePx={18} />
                  {active && <span className="text-[11px]">{cat.label}</span>}
                </button>
              );
            })}
          </div>
        )}

        {activeTab === 'zikr' && (
          <div className="flex items-center gap-1.5 overflow-x-auto custom-scroll flex-1 py-0.5">
            {zikrSubTabs.map((tab) => {
              const active = zikrCat === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setZikrCat(tab.id)}
                  className={`h-9 rounded-full flex items-center justify-center gap-1.5 transition-all shrink-0 whitespace-nowrap ${
                    active
                      ? `${activePillBg} px-3.5 font-bold`
                      : `${mainText} px-3 opacity-75 hover:opacity-100 hover:bg-white/5`
                  }`}
                  title={tab.label}
                >
                  <KurdiIcon name={tab.icon} className="w-4 h-4 shrink-0" />
                  {active && <span className="text-[11px]">{tab.label}</span>}
                </button>
              );
            })}
          </div>
        )}

        {activeTab === 'kaomoji' && (
          <div className="flex items-center gap-2 flex-1 py-0.5">
            <button
              type="button"
              onClick={() => setKaomojiCat('recent')}
              className={`h-9 rounded-full flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
                kaomojiCat === 'recent'
                  ? `${activePillBg} px-3.5 font-bold`
                  : `${mainText} px-3 opacity-75 hover:opacity-100`
              }`}
              title="دوایینەکان"
            >
              <KurdiIcon name="ic_history1" className="w-4 h-4 shrink-0" />
              {kaomojiCat === 'recent' && <span className="text-[11px]">دوایینەکان</span>}
            </button>
            <button
              type="button"
              onClick={() => setKaomojiCat('all')}
              className={`h-9 rounded-full flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
                kaomojiCat === 'all'
                  ? `${activePillBg} px-3.5 font-bold`
                  : `${mainText} px-3 opacity-75 hover:opacity-100`
              }`}
              title="کاومۆجی"
            >
              <KurdiIcon name="ic_kaomoji" className="w-5 h-5 shrink-0" />
              {kaomojiCat === 'all' && <span className="text-[11px]">کاومۆجی</span>}
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => onOpenSettings('emoji_settings')}
          className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 hover:bg-white/10 transition-colors ${mainText}`}
          title="ڕێکخستنی خەندەکان"
        >
          <KurdiIcon name="ic_settings" className="w-4 h-4" />
        </button>
      </div>

      {/* Live Kurdish & English Emoji Search Bar */}
      {activeTab === 'emoji' && (
        <div className="px-2.5 pt-2 pb-1 shrink-0" dir="rtl">
          {onStartEmojiSearch ? (
            <button
              type="button"
              onClick={onStartEmojiSearch}
              className={`w-full h-9 px-3 rounded-xl flex items-center gap-2 border text-right transition-colors active:scale-[0.99] ${
                isLight
                  ? 'bg-white border-slate-200 text-slate-500 hover:border-sky-400'
                  : 'bg-white/[0.06] border-white/10 text-zinc-400 hover:border-sky-400/50'
              }`}
            >
              <Search className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span className="flex-1 text-xs truncate">
                گەڕان لە ١٦١٧ خەندە بە کوردی یان ئینگلیزی (دڵ، پێکەنین، heart)...
              </span>
            </button>
          ) : (
            <div
              className={`h-9 px-3 rounded-xl flex items-center gap-2 border ${
                isLight
                  ? 'bg-white border-slate-200 text-slate-900'
                  : 'bg-white/[0.06] border-white/10 text-white'
              }`}
            >
              <Search className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <input
                type="text"
                value={emojiSearch}
                onChange={(e) => setEmojiSearch(e.target.value)}
                placeholder="گەڕان لە ١٦١٧ خەندە بە کوردی یان ئینگلیزی (وەک: دڵ، پێکەنین، heart)..."
                className="flex-1 bg-transparent text-xs outline-none placeholder:text-zinc-500"
              />
              {emojiSearch && (
                <button
                  type="button"
                  onClick={() => setEmojiSearch('')}
                  className="text-zinc-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Skin-Tone / Hair-Style Variant + Quick Pin Overlay */}
      {variantPopup && (
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 max-w-[92%] px-3 py-2.5 rounded-2xl shadow-2xl border border-white/15 flex flex-col gap-2"
          style={{ backgroundColor: theme.popupBg || (isLight ? '#FFFFFF' : '#1B1E26') }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center flex-wrap justify-center gap-1">
            {variantPopup.variants.map((v, i) => (
              <button
                key={`${v}_${i}`}
                type="button"
                onClick={() => {
                  onInsert(v, 'emoji');
                  setVariantPopup(null);
                }}
                className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-sky-500/20 active:scale-90 transition-transform"
              >
                <EmojiGlyph emoji={v} styleMode={settings.emojiStyle} sizePx={26} />
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-white/10" dir="rtl">
            <button
              type="button"
              onClick={() => {
                handleTogglePin('emoji', variantPopup.rendered);
                setVariantPopup(null);
              }}
              className="flex-1 h-8 px-3 rounded-xl bg-sky-500/20 text-[#8EC2FF] text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-sky-500/30"
            >
              {emojiStore.pinned.includes(variantPopup.rendered) ? (
                <>
                  <PinOff className="w-3.5 h-3.5" />
                  <span>لابردنی پین</span>
                </>
              ) : (
                <>
                  <Pin className="w-3.5 h-3.5" />
                  <span>پینکردن</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => setVariantPopup(null)}
              className="h-8 w-8 rounded-xl bg-white/10 text-zinc-300 flex items-center justify-center"
              aria-label="داخستن"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Long-Press History & Pinned Item Action Popup (Pin/Unpin, Move Left/Right, Remove) */}
      {historyAction && (
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[88%] max-w-[320px] p-3 rounded-2xl shadow-2xl border border-white/15 space-y-2.5"
          style={{ backgroundColor: theme.popupBg || (isLight ? '#FFFFFF' : '#1B1E26') }}
          onClick={(e) => e.stopPropagation()}
          dir="rtl"
        >
          <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
            <span className={`text-sm font-bold truncate flex items-center gap-2 ${mainText}`}>
              {historyAction.section === 'emoji' ? (
                <EmojiGlyph
                  emoji={historyAction.value}
                  styleMode={settings.emojiStyle}
                  sizePx={24}
                />
              ) : (
                historyAction.label || historyAction.value
              )}
            </span>
            <button
              type="button"
              onClick={() => setHistoryAction(null)}
              className="w-7 h-7 rounded-lg bg-white/10 text-zinc-300 flex items-center justify-center shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => {
                handleTogglePin(historyAction.section, historyAction.value);
                setHistoryAction(null);
              }}
              className="h-9 px-2.5 rounded-xl bg-sky-500/20 text-[#8EC2FF] text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-sky-500/30"
            >
              {historyAction.bucket === 'pinned' ? (
                <>
                  <PinOff className="w-3.5 h-3.5" />
                  <span>لابردنی پین</span>
                </>
              ) : (
                <>
                  <Pin className="w-3.5 h-3.5" />
                  <span>پینکردن</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                handleRemoveHistory(historyAction.section, historyAction.value);
                setHistoryAction(null);
              }}
              className="h-9 px-2.5 rounded-xl bg-rose-500/20 text-rose-300 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-rose-500/30"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>سڕینەوە</span>
            </button>

            {(historyAction.bucket === 'pinned' || isManualSort) && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    handleMoveHistory(
                      historyAction.section,
                      historyAction.bucket,
                      historyAction.value,
                      -1
                    );
                  }}
                  className="h-9 px-2.5 rounded-xl bg-white/10 text-zinc-200 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-white/15"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>جووڵاندن بۆ پێش</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleMoveHistory(
                      historyAction.section,
                      historyAction.bucket,
                      historyAction.value,
                      1
                    );
                  }}
                  className="h-9 px-2.5 rounded-xl bg-white/10 text-zinc-200 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-white/15"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>جووڵاندن بۆ دواوە</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Main Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto custom-scroll px-2 py-1.5">
        {activeTab === 'emoji' && emojiCat === 'recent' && !emojiSearch.trim() && (
          <div className="space-y-2.5">
            {emojiStore.pinned.length > 0 && (
              <div className="space-y-1.5">
                {renderSubheader('ئیمۆجییە پینکراوەکان', emojiStore.pinned.length, true)}
                <div
                  className="grid gap-1"
                  style={{ gridTemplateColumns: `repeat(${settings.emojiColumns}, minmax(0, 1fr))` }}
                >
                  {emojiStore.pinned.map((char, idx) => (
                    <button
                      key={`pin_em_${char}_${idx}`}
                      type="button"
                      onPointerDown={() =>
                        startHistoryHold({ section: 'emoji', bucket: 'pinned', value: char })
                      }
                      onPointerUp={clearHold}
                      onPointerLeave={clearHold}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setHistoryAction({ section: 'emoji', bucket: 'pinned', value: char });
                      }}
                      onClick={() => {
                        if (longPressTriggeredRef.current) {
                          longPressTriggeredRef.current = false;
                          return;
                        }
                        onInsert(char, 'emoji');
                      }}
                      style={{ height: `${emojiCellHeight}px` }}
                      className="relative rounded-xl flex items-center justify-center hover:bg-white/10 active:scale-90 transition-transform"
                      title="دەستڕاگرتن بۆ بەڕێوەبردن"
                    >
                      <EmojiGlyph
                        emoji={char}
                        styleMode={settings.emojiStyle}
                        sizePx={emojiFontSize}
                      />
                      <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#74B3FF]" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              {renderSubheader('دوایین بەکارهاتووەکان', emojiStore.recent.length)}
              {emojiStore.recent.length === 0 && emojiStore.pinned.length === 0 ? (
                <div className="py-8 text-center text-xs text-zinc-500" dir="rtl">
                  هێشتا هیچ ئیمۆجییەکت بەکارنەهێناوە · دەستڕاگرتن لەسەر هەر ئیمۆجییەک پینی دەکات
                </div>
              ) : (
                <div
                  className="grid gap-1"
                  style={{ gridTemplateColumns: `repeat(${settings.emojiColumns}, minmax(0, 1fr))` }}
                >
                  {emojiStore.recent.map((char, idx) => (
                    <button
                      key={`rec_em_${char}_${idx}`}
                      type="button"
                      onPointerDown={() =>
                        startHistoryHold({ section: 'emoji', bucket: 'recent', value: char })
                      }
                      onPointerUp={clearHold}
                      onPointerLeave={clearHold}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setHistoryAction({ section: 'emoji', bucket: 'recent', value: char });
                      }}
                      onClick={() => {
                        if (longPressTriggeredRef.current) {
                          longPressTriggeredRef.current = false;
                          return;
                        }
                        onInsert(char, 'emoji');
                      }}
                      style={{ height: `${emojiCellHeight}px` }}
                      className="relative rounded-xl flex items-center justify-center hover:bg-white/10 active:scale-90 transition-transform"
                      title="دەستڕاگرتن بۆ پینکردن یان سڕینەوە"
                    >
                      <EmojiGlyph
                        emoji={char}
                        styleMode={settings.emojiStyle}
                        sizePx={emojiFontSize}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'emoji' && (emojiCat !== 'recent' || emojiSearch.trim()) && (
          <div className="space-y-1.5">
            {renderSubheader(
              emojiSearch.trim()
                ? `ئەنجامی گەڕان بۆ «${emojiSearch}»`
                : EMOJI_CATEGORIES.find((c) => c.id === emojiCat)?.label || 'خەندەکان',
              displayedEmojis.length
            )}

            {displayedEmojis.length === 0 ? (
              <div className="py-10 text-center text-xs text-zinc-500" dir="rtl">
                هیچ خەندەیەک نەدۆزرایەوە
              </div>
            ) : (
              <div
                className="grid gap-1"
                style={{ gridTemplateColumns: `repeat(${settings.emojiColumns}, minmax(0, 1fr))` }}
              >
                {displayedEmojis.map((entry, i) => {
                  const rendered = resolveEmojiWithModifiers(
                    entry,
                    settings.emojiSkinTone,
                    settings.emojiHairStyle
                  );
                  const hasVariants = Boolean(entry.v && entry.v.length > 0);
                  const isPinned = emojiStore.pinned.includes(rendered);
                  return (
                    <button
                      key={`${entry.c}_${i}`}
                      type="button"
                      onPointerDown={() => startEmojiHold(entry, rendered)}
                      onPointerUp={clearHold}
                      onPointerLeave={clearHold}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        const variants = getEmojiVariants(entry, settings.emojiSkinTone);
                        setVariantPopup({
                          base: entry.c,
                          rendered,
                          variants: variants.length > 1 ? variants : [rendered],
                        });
                      }}
                      onClick={() => {
                        if (longPressTriggeredRef.current) {
                          longPressTriggeredRef.current = false;
                          return;
                        }
                        onInsert(rendered, 'emoji');
                      }}
                      style={{ height: `${emojiCellHeight}px` }}
                      className="relative rounded-xl flex items-center justify-center hover:bg-white/10 active:scale-90 transition-transform"
                      title={entry.k || entry.e || entry.c}
                    >
                      <EmojiGlyph
                        emoji={rendered}
                        styleMode={settings.emojiStyle}
                        sizePx={emojiFontSize}
                      />
                      {hasVariants && (
                        <span className="absolute bottom-1 right-1 w-1 h-1 rounded-full bg-zinc-500/70" />
                      )}
                      {isPinned && (
                        <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#74B3FF]" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'zikr' && (
          <div className="space-y-2.5" dir="rtl">
            {zikrCat === 'recent' ? (
              <>
                {(
                  [
                    { key: 'duaa' as const, title: 'دوعا و زیکر', store: duaaStore },
                    { key: 'quran' as const, title: 'دوعا قورئانییەکان', store: quranStore },
                    { key: 'salawat' as const, title: 'سەڵاوات', store: salawatStore },
                  ] as const
                ).map((group) => {
                  const total = group.store.pinned.length + group.store.recent.length;
                  if (total === 0) return null;
                  return (
                    <div key={group.key} className="space-y-1.5">
                      {renderSubheader(group.title, total, group.store.pinned.length > 0)}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                        {group.store.pinned.map((phrase, idx) => (
                          <button
                            key={`zp_${group.key}_${idx}`}
                            type="button"
                            onPointerDown={() =>
                              startHistoryHold({
                                section: group.key,
                                bucket: 'pinned',
                                value: phrase,
                              })
                            }
                            onPointerUp={clearHold}
                            onPointerLeave={clearHold}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              setHistoryAction({
                                section: group.key,
                                bucket: 'pinned',
                                value: phrase,
                              });
                            }}
                            onClick={() => {
                              if (longPressTriggeredRef.current) {
                                longPressTriggeredRef.current = false;
                                return;
                              }
                              onInsert(`${phrase} `, group.key);
                            }}
                            style={{
                              fontSize: `${zikrFontSize}px`,
                              backgroundColor: isLight
                                ? 'rgba(14,165,233,0.1)'
                                : 'rgba(56,189,248,0.12)',
                            }}
                            className={`relative min-h-[48px] px-2.5 py-2 rounded-xl text-center leading-snug font-medium border border-sky-400/25 active:scale-95 transition-all flex items-center justify-center ${mainText}`}
                          >
                            <span className="line-clamp-2">{phrase}</span>
                            <Pin className="w-2.5 h-2.5 text-[#74B3FF] absolute top-1.5 left-1.5" />
                          </button>
                        ))}
                        {group.store.recent.map((phrase, idx) => (
                          <button
                            key={`zr_${group.key}_${idx}`}
                            type="button"
                            onPointerDown={() =>
                              startHistoryHold({
                                section: group.key,
                                bucket: 'recent',
                                value: phrase,
                              })
                            }
                            onPointerUp={clearHold}
                            onPointerLeave={clearHold}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              setHistoryAction({
                                section: group.key,
                                bucket: 'recent',
                                value: phrase,
                              });
                            }}
                            onClick={() => {
                              if (longPressTriggeredRef.current) {
                                longPressTriggeredRef.current = false;
                                return;
                              }
                              onInsert(`${phrase} `, group.key);
                            }}
                            style={{
                              fontSize: `${zikrFontSize}px`,
                              backgroundColor: isLight
                                ? 'rgba(0,0,0,0.03)'
                                : 'rgba(255,255,255,0.04)',
                            }}
                            className={`min-h-[48px] px-2.5 py-2 rounded-xl text-center leading-snug font-medium hover:bg-white/10 active:scale-95 transition-all flex items-center justify-center ${mainText}`}
                          >
                            <span className="line-clamp-2">{phrase}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {duaaStore.pinned.length +
                  duaaStore.recent.length +
                  quranStore.pinned.length +
                  quranStore.recent.length +
                  salawatStore.pinned.length +
                  salawatStore.recent.length ===
                  0 && (
                  <div className="py-10 text-center text-xs text-zinc-500">
                    هیچ زیکرێک لە مێژوودا نییە
                  </div>
                )}
              </>
            ) : (
              <>
                {getStoreForSection(zikrCat).pinned.length > 0 && (
                  <div className="space-y-1.5">
                    {renderSubheader(
                      'پینکراوەکانی ئەم بەشە',
                      getStoreForSection(zikrCat).pinned.length,
                      true
                    )}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {getStoreForSection(zikrCat).pinned.map((phrase, idx) => (
                        <button
                          key={`zpin_${zikrCat}_${idx}`}
                          type="button"
                          onPointerDown={() =>
                            startHistoryHold({
                              section: zikrCat,
                              bucket: 'pinned',
                              value: phrase,
                            })
                          }
                          onPointerUp={clearHold}
                          onPointerLeave={clearHold}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setHistoryAction({
                              section: zikrCat,
                              bucket: 'pinned',
                              value: phrase,
                            });
                          }}
                          onClick={() => {
                            if (longPressTriggeredRef.current) {
                              longPressTriggeredRef.current = false;
                              return;
                            }
                            onInsert(`${phrase} `, zikrCat);
                          }}
                          style={{
                            fontSize: `${zikrFontSize}px`,
                            backgroundColor: isLight
                              ? 'rgba(14,165,233,0.1)'
                              : 'rgba(56,189,248,0.12)',
                          }}
                          className={`relative min-h-[48px] px-2.5 py-2 rounded-xl text-center leading-snug font-medium border border-sky-400/25 active:scale-95 transition-all flex items-center justify-center ${mainText}`}
                        >
                          <span className="line-clamp-2">{phrase}</span>
                          <Pin className="w-2.5 h-2.5 text-[#74B3FF] absolute top-1.5 left-1.5" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  {renderSubheader(
                    zikrSubTabs.find((t) => t.id === zikrCat)?.label || 'زیکر',
                    ZIKR_CATEGORIES[zikrCat].length
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {ZIKR_CATEGORIES[zikrCat].map((entry, idx) => (
                      <button
                        key={`${zikrCat}_${idx}`}
                        type="button"
                        onPointerDown={() =>
                          startHistoryHold({
                            section: zikrCat,
                            bucket: getStoreForSection(zikrCat).pinned.includes(entry.v.trim())
                              ? 'pinned'
                              : 'recent',
                            value: entry.v.trim(),
                            label: entry.d,
                          })
                        }
                        onPointerUp={clearHold}
                        onPointerLeave={clearHold}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setHistoryAction({
                            section: zikrCat,
                            bucket: getStoreForSection(zikrCat).pinned.includes(entry.v.trim())
                              ? 'pinned'
                              : 'recent',
                            value: entry.v.trim(),
                            label: entry.d,
                          });
                        }}
                        onClick={() => {
                          if (longPressTriggeredRef.current) {
                            longPressTriggeredRef.current = false;
                            return;
                          }
                          onInsert(`${entry.v} `, zikrCat);
                        }}
                        style={{
                          fontSize: `${zikrFontSize}px`,
                          backgroundColor: isLight
                            ? 'rgba(0,0,0,0.03)'
                            : 'rgba(255,255,255,0.04)',
                        }}
                        className={`min-h-[48px] px-2.5 py-2 rounded-xl text-center leading-snug font-medium hover:bg-white/10 active:scale-95 transition-all flex items-center justify-center ${mainText}`}
                        title={entry.v}
                      >
                        <span className="line-clamp-2">{entry.d}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'kaomoji' && (
          <div className="space-y-2.5">
            {kaomojiCat === 'recent' ? (
              <>
                {kaomojiStore.pinned.length > 0 && (
                  <div className="space-y-1.5">
                    {renderSubheader('کاومۆجی پینکراوەکان', kaomojiStore.pinned.length, true)}
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                      {kaomojiStore.pinned.map((k, idx) => (
                        <button
                          key={`kp_${k}_${idx}`}
                          type="button"
                          onPointerDown={() =>
                            startHistoryHold({ section: 'kaomoji', bucket: 'pinned', value: k })
                          }
                          onPointerUp={clearHold}
                          onPointerLeave={clearHold}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setHistoryAction({ section: 'kaomoji', bucket: 'pinned', value: k });
                          }}
                          onClick={() => {
                            if (longPressTriggeredRef.current) {
                              longPressTriggeredRef.current = false;
                              return;
                            }
                            onInsert(`${k} `, 'kaomoji');
                          }}
                          style={{ fontSize: `${Math.max(11, zikrFontSize + 1)}px` }}
                          className={`relative min-h-[44px] px-1.5 py-2 rounded-xl text-center font-semibold tracking-tight border border-sky-400/25 bg-sky-500/10 active:scale-95 transition-all flex items-center justify-center whitespace-nowrap ${mainText}`}
                        >
                          {k}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  {renderSubheader('دوایین کاومۆجییەکان', kaomojiStore.recent.length)}
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                    {kaomojiStore.recent.map((k, idx) => (
                      <button
                        key={`kr_${k}_${idx}`}
                        type="button"
                        onPointerDown={() =>
                          startHistoryHold({ section: 'kaomoji', bucket: 'recent', value: k })
                        }
                        onPointerUp={clearHold}
                        onPointerLeave={clearHold}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setHistoryAction({ section: 'kaomoji', bucket: 'recent', value: k });
                        }}
                        onClick={() => {
                          if (longPressTriggeredRef.current) {
                            longPressTriggeredRef.current = false;
                            return;
                          }
                          onInsert(`${k} `, 'kaomoji');
                        }}
                        style={{ fontSize: `${Math.max(11, zikrFontSize + 1)}px` }}
                        className={`min-h-[44px] px-1.5 py-2 rounded-xl text-center font-semibold tracking-tight hover:bg-white/10 active:scale-95 transition-all flex items-center justify-center whitespace-nowrap ${mainText}`}
                      >
                        {k}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-1.5">
                {renderSubheader('کاومۆجی', KAOMOJI_LIST.length)}
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                  {KAOMOJI_LIST.map((k, idx) => (
                    <button
                      key={`${k}_${idx}`}
                      type="button"
                      onPointerDown={() =>
                        startHistoryHold({
                          section: 'kaomoji',
                          bucket: kaomojiStore.pinned.includes(k) ? 'pinned' : 'recent',
                          value: k,
                        })
                      }
                      onPointerUp={clearHold}
                      onPointerLeave={clearHold}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setHistoryAction({
                          section: 'kaomoji',
                          bucket: kaomojiStore.pinned.includes(k) ? 'pinned' : 'recent',
                          value: k,
                        });
                      }}
                      onClick={() => {
                        if (longPressTriggeredRef.current) {
                          longPressTriggeredRef.current = false;
                          return;
                        }
                        onInsert(`${k} `, 'kaomoji');
                      }}
                      style={{ fontSize: `${Math.max(11, zikrFontSize + 1)}px` }}
                      className={`min-h-[44px] px-1.5 py-2 rounded-xl text-center font-semibold tracking-tight hover:bg-white/10 active:scale-95 transition-all flex items-center justify-center whitespace-nowrap ${mainText}`}
                    >
                      {k}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Switcher Bar */}
      <div className="flex items-center justify-between px-2.5 py-2 border-t border-white/5 shrink-0 gap-2">
        <button
          type="button"
          onClick={onClose}
          className="h-11 w-14 rounded-xl flex items-center justify-center active:scale-95 transition-transform"
          style={{ backgroundColor: theme.specialKeyBg, color: theme.specialKeyText }}
          title="گەڕانەوە بۆ تەختەکلیل"
        >
          <KurdiIcon name="ic_keyboards" className="w-5 h-5" />
        </button>

        <div className="flex items-center justify-around flex-1 max-w-[260px]">
          <button
            type="button"
            onClick={() => setActiveTab('emoji')}
            className="flex flex-col items-center gap-0.5 px-2 py-1"
          >
            <KurdiIcon
              name="ic_xanda"
              className={`w-4 h-4 ${activeTab === 'emoji' ? 'text-[#5BA4FF]' : mutedText}`}
            />
            <span
              className={`text-[10.5px] font-semibold px-2.5 py-0.5 rounded-lg transition-colors whitespace-nowrap ${
                activeTab === 'emoji' ? activePillBg : `${pillBg} ${mutedText}`
              }`}
            >
              خەندەکان
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('zikr')}
            className="flex flex-col items-center gap-0.5 px-2 py-1"
          >
            <KurdiIcon
              name="ic_tasbih1"
              className={`w-4 h-4 ${activeTab === 'zikr' ? 'text-[#5BA4FF]' : mutedText}`}
            />
            <span
              className={`text-[10.5px] font-semibold px-3 py-0.5 rounded-lg transition-colors whitespace-nowrap ${
                activeTab === 'zikr' ? activePillBg : `${pillBg} ${mutedText}`
              }`}
            >
              زیکر
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('kaomoji')}
            className="flex flex-col items-center gap-0.5 px-2 py-1"
          >
            <KurdiIcon
              name="ic_kaomoji"
              className={`w-4 h-4 ${activeTab === 'kaomoji' ? 'text-[#5BA4FF]' : mutedText}`}
            />
            <span
              className={`text-[10.5px] font-semibold px-2.5 py-0.5 rounded-lg transition-colors whitespace-nowrap ${
                activeTab === 'kaomoji' ? activePillBg : `${pillBg} ${mutedText}`
              }`}
            >
              کاومۆجی
            </span>
          </button>
        </div>

        <button
          type="button"
          onClick={onBackspace}
          className="h-11 w-14 rounded-xl flex items-center justify-center active:scale-95 transition-transform"
          style={{
            backgroundColor: theme.backspaceBg || theme.specialKeyBg,
            color: theme.backspaceText || theme.specialKeyText,
          }}
          title="سڕینەوە"
        >
          <KurdiIcon name="ic_delete" className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

interface ToolsGridPanelProps {
  theme: KeyboardTheme;
  settings: KeyboardSettings;
  isListeningVoice: boolean;
  onSelectTool: (toolId: string) => void;
  onReorderTools: (newOrder: string[]) => void;
  onClose: () => void;
}

const TOOL_META: Record<string, { label: string; icon: KurdiIconName }> = {
  live_translate: { label: 'وەرگێڕانی ڕاستەوخۆ', icon: 'ic_translate' },
  text_edit: { label: 'کۆنترۆڵی دەق و کێرسەر', icon: 'ic_select_all' },
  snippets_calc: { label: 'کلێشە و بژمێری خێرا', icon: 'ic_note' },
  translate: { label: 'وەرگێڕان', icon: 'ic_translate' },
  resize: { label: 'گۆڕینی قەبارە', icon: 'ic_resize' },
  decorate: { label: 'جوانکاری نووسین', icon: 'ic_text' },
  themes: { label: 'ڕووکارەکان', icon: 'ic_themes' },
  voice: { label: 'گەڕانی دەنگی', icon: 'ic_mic' },
  settings: { label: 'ڕێکخستنەکان', icon: 'ic_settings' },
  redo: { label: 'دواتر', icon: 'ic_redo' },
  undo: { label: 'پێشتر', icon: 'ic_undo' },
  one_handed: { label: 'دۆخی یەکدەست', icon: 'ic_accessibility_one_handed' },
  switch_lang: { label: 'گۆڕینی زمان', icon: 'ic_language' },
  ai_smart: { label: 'وەڵامدەرەوەی زیرەک', icon: 'ic_smart' },
  clipboard: { label: 'لەبەرگیراوەکان', icon: 'ic_clipboard_manager' },
};

export const ToolsGridPanel: React.FC<ToolsGridPanelProps> = ({
  theme,
  settings,
  isListeningVoice,
  onSelectTool,
  onReorderTools,
  onClose,
}) => {
  const [reorderMode, setReorderMode] = useState(false);
  const [selectedForSwap, setSelectedForSwap] = useState<string | null>(null);
  const isLight = Boolean(theme.isLight);

  const handleToolClick = (id: string) => {
    if (!reorderMode) {
      onSelectTool(id);
      return;
    }
    if (!selectedForSwap) {
      setSelectedForSwap(id);
      return;
    }
    if (selectedForSwap === id) {
      setSelectedForSwap(null);
      return;
    }
    const next = [...settings.toolsOrder];
    const idxA = next.indexOf(selectedForSwap);
    const idxB = next.indexOf(id);
    if (idxA !== -1 && idxB !== -1) {
      [next[idxA], next[idxB]] = [next[idxB], next[idxA]];
      onReorderTools(next);
    }
    setSelectedForSwap(null);
  };

  return (
    <div
      className="flex flex-col w-full kb-noselect px-3 py-2.5"
      style={{
        backgroundColor: theme.bg,
        height: `${Math.max(settings.keyboardHeightPx + 36, 315)}px`,
      }}
      dir="ltr"
    >
      <div className="relative flex items-center justify-center mb-3 shrink-0">
        <button
          type="button"
          onClick={onClose}
          className={`absolute left-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
            isLight
              ? 'bg-slate-200 text-slate-900 hover:bg-slate-300'
              : 'bg-zinc-900 text-white hover:bg-zinc-800'
          }`}
          title="داخستن"
        >
          <X className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={() => {
            setReorderMode((v) => !v);
            setSelectedForSwap(null);
          }}
          className={`h-9 px-5 rounded-full text-xs font-bold flex items-center gap-2 transition-all active:scale-95 ${
            reorderMode
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/25'
              : 'bg-[#0B5FA8] hover:bg-[#0D70C7] text-white'
          }`}
        >
          <ArrowUpDown className="w-3.5 h-3.5" />
          <span>{reorderMode ? 'تەواوکردنی ڕێکخستن' : 'گۆڕینی شوێن'}</span>
        </button>
      </div>

      {reorderMode && (
        <p className="text-[11px] text-center text-sky-400 mb-2" dir="rtl">
          لەسەر دوو ئامراز دابگرە بۆ گۆڕینی شوێنەکانیان
        </p>
      )}

      <div className="grid grid-cols-2 gap-2.5 overflow-y-auto custom-scroll pb-2 flex-1" dir="rtl">
        {settings.toolsOrder.map((toolId) => {
          const meta = TOOL_META[toolId];
          if (!meta) return null;
          const isSwapSelected = selectedForSwap === toolId;
          const isActiveState =
            (toolId === 'one_handed' && settings.oneHandedMode !== 'off') ||
            (toolId === 'voice' && isListeningVoice);

          return (
            <button
              key={toolId}
              type="button"
              onClick={() => handleToolClick(toolId)}
              className={`h-12 px-3.5 rounded-2xl flex items-center justify-between gap-2 transition-all active:scale-[0.97] border ${
                isSwapSelected
                  ? 'border-sky-400 bg-sky-500/20 text-white'
                  : isActiveState
                  ? 'border-sky-500/60 bg-sky-500/15 text-sky-300'
                  : isLight
                  ? 'border-slate-200 bg-white text-slate-900 hover:bg-slate-50'
                  : 'border-white/5 bg-[#151619] text-white hover:bg-[#1E2025]'
              }`}
            >
              <span className="text-[13px] font-semibold truncate">{meta.label}</span>
              <span
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                  isLight ? 'text-slate-800' : 'text-white'
                }`}
              >
                <KurdiIcon name={meta.icon} className="w-[18px] h-[18px]" />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

interface ClipboardPanelProps {
  theme: KeyboardTheme;
  settings: KeyboardSettings;
  items: ClipboardItem[];
  currentText: string;
  onPasteItem: (text: string) => void;
  onSaveCurrent: () => void;
  onTogglePin: (id: string) => void;
  onEditItem: (id: string, newText: string) => void;
  onTranslateItem: (text: string) => void;
  onDeleteItem: (id: string) => void;
  onClearUnpinned: () => void;
  onClose: () => void;
}

export const ClipboardPanel: React.FC<ClipboardPanelProps> = ({
  theme,
  settings,
  items,
  currentText,
  onPasteItem,
  onSaveCurrent,
  onTogglePin,
  onEditItem,
  onTranslateItem,
  onDeleteItem,
  onClearUnpinned,
  onClose,
}) => {
  const isLight = Boolean(theme.isLight);
  const [menuItem, setMenuItem] = useState<ClipboardItem | null>(null);
  const [editingItem, setEditingItem] = useState<ClipboardItem | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);
  const pointerOriginRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
    };
  }, []);

  const sorted = [...items].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));

  const clearHoldTimer = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    pointerOriginRef.current = null;
  };

  const handleCardPointerDown = (item: ClipboardItem, e: React.PointerEvent) => {
    if (selectMode) return;
    longPressTriggeredRef.current = false;
    pointerOriginRef.current = { x: e.clientX, y: e.clientY };
    clearHoldTimer();
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      setMenuItem(item);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate(15);
        } catch {
          // Ignore
        }
      }
    }, 360);
  };

  const handleCardPointerMove = (e: React.PointerEvent) => {
    if (!pointerOriginRef.current || !longPressTimerRef.current) return;
    const dx = Math.abs(e.clientX - pointerOriginRef.current.x);
    const dy = Math.abs(e.clientY - pointerOriginRef.current.y);
    if (dx > 10 || dy > 10) {
      clearHoldTimer();
    }
  };

  const handleCardClick = (item: ClipboardItem) => {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }
    if (selectMode) {
      setSelectedIds((prev) =>
        prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id]
      );
      return;
    }
    onPasteItem(item.text);
  };

  const handleBulkDelete = () => {
    for (const id of selectedIds) {
      onDeleteItem(id);
    }
    setSelectedIds([]);
    setSelectMode(false);
  };

  const openEditor = (item: ClipboardItem) => {
    setMenuItem(null);
    setEditingItem(item);
    setEditDraft(item.text);
  };

  const saveEdit = () => {
    if (!editingItem) return;
    const clean = editDraft.trim();
    if (clean) {
      onEditItem(editingItem.id, clean);
    }
    setEditingItem(null);
    setEditDraft('');
  };

  return (
    <div
      className="relative flex flex-col w-full px-3 py-2.5 kb-noselect overflow-hidden"
      style={{
        backgroundColor: theme.bg,
        height: `${Math.max(settings.keyboardHeightPx + 36, 315)}px`,
      }}
      dir="rtl"
    >
      {/* Authentic Header: Right Back Arrow, Center Title "لەبەرگیراوەکان", Left List/Manage Controls */}
      <div className="flex items-center justify-between mb-2.5 shrink-0">
        <button
          type="button"
          onClick={onClose}
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
            isLight
              ? 'bg-slate-200 text-slate-900 hover:bg-slate-300'
              : 'bg-[#1A1B20] text-white hover:bg-[#262830]'
          }`}
          title="گەڕانەوە"
        >
          <ArrowRight className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-1.5">
          <span className={`text-[15px] font-extrabold ${isLight ? 'text-slate-900' : 'text-white'}`}>
            لەبەرگیراوەکان
          </span>
          {items.length > 0 && (
            <span className="text-[11px] font-bold text-zinc-400 tabular-nums">({items.length})</span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {selectMode ? (
            <>
              {selectedIds.length > 0 && (
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  className="h-8 px-2.5 rounded-full bg-rose-500/20 text-rose-400 text-xs font-bold hover:bg-rose-500/30"
                >
                  سڕینەوە ({selectedIds.length})
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setSelectMode(false);
                  setSelectedIds([]);
                }}
                className={`w-9 h-9 rounded-full flex items-center justify-center ${
                  isLight ? 'bg-slate-200 text-slate-900' : 'bg-[#1A1B20] text-white'
                }`}
                title="پاشگەزبوونەوە"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              {currentText.trim() && (
                <button
                  type="button"
                  onClick={onSaveCurrent}
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                    isLight
                      ? 'bg-sky-100 text-sky-700 hover:bg-sky-200'
                      : 'bg-[#1A1B20] text-sky-400 hover:bg-[#262830]'
                  }`}
                  title="پاشەکەوتکردنی دەقی ئێستا"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (items.length > 0) setSelectMode(true);
                }}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                  isLight
                    ? 'bg-slate-200 text-slate-900 hover:bg-slate-300'
                    : 'bg-[#1A1B20] text-white hover:bg-[#262830]'
                }`}
                title="هەڵبژاردن و بەڕێوەبردن"
              >
                <LayoutList className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 text-xs gap-2">
          <KurdiIcon name="ic_clipboards" className="w-7 h-7 opacity-40" />
          <span>هیچ دەقێکی لەبەرگیراو نییە</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 overflow-y-auto custom-scroll pb-1 flex-1 content-start">
          {sorted.map((item) => {
            const isSelected = selectedIds.includes(item.id);
            return (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                onPointerDown={(e) => handleCardPointerDown(item, e)}
                onPointerMove={handleCardPointerMove}
                onPointerUp={clearHoldTimer}
                onPointerCancel={clearHoldTimer}
                onContextMenu={(e) => {
                  e.preventDefault();
                  clearHoldTimer();
                  setMenuItem(item);
                }}
                onClick={() => handleCardClick(item)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleCardClick(item);
                  }
                }}
                className={`rounded-2xl p-3 border flex flex-col justify-between gap-2.5 transition-all cursor-pointer active:scale-[0.98] ${
                  isSelected
                    ? 'border-[#FF7A00] bg-[#FF7A00]/15'
                    : isLight
                    ? 'bg-white border-slate-200 text-slate-900 hover:border-slate-300'
                    : 'bg-[#16171C] border-white/[0.06] text-white hover:bg-[#1C1E25]'
                }`}
              >
                <div className="flex items-start justify-between gap-1.5">
                  <p className="text-right text-xs leading-relaxed line-clamp-3 flex-1 break-words">
                    {item.text}
                  </p>
                  {selectMode && (
                    <span
                      className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                        isSelected
                          ? 'bg-[#FF7A00] border-[#FF7A00] text-white'
                          : 'border-zinc-500'
                      }`}
                    >
                      {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                    </span>
                  )}
                </div>

                {/* Permanent status pill (nothing auto-deletes) */}
                <div
                  className={`w-full rounded-xl px-2.5 py-1 text-[10px] font-semibold flex items-center justify-center gap-1 ${
                    item.pinned
                      ? isLight
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-[#FF7A00]/15 text-[#FF9A3D]'
                      : isLight
                      ? 'bg-slate-100 text-slate-500'
                      : 'bg-[#22242C] text-zinc-400'
                  }`}
                >
                  {item.pinned && <Pin className="w-2.5 h-2.5 shrink-0" />}
                  <span className="truncate">
                    {item.pinned ? 'جێگیرکراوە · پارێزراوە' : 'هەمیشەیی پارێزراوە'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Subtle footer hint or clear action in select mode */}
      {!menuItem && !editingItem && sorted.length > 0 && (
        <div className="pt-1.5 flex items-center justify-between text-[10px] text-zinc-500 shrink-0 px-0.5">
          <span>دەست لەسەر هەر لەبەرگیراوێک ڕابگرە بۆ وەرگێڕان، دەستکاری یان سڕینەوە</span>
          {selectMode && (
            <button
              type="button"
              onClick={() => {
                onClearUnpinned();
                setSelectMode(false);
                setSelectedIds([]);
              }}
              className="text-rose-400 font-bold hover:underline shrink-0 mr-2"
            >
              پاککردنەوەی ناجێگیرەکان
            </button>
          )}
        </div>
      )}

      {/* Authentic Native Long-Press Context Popup Overlay (matching user's screenshot) */}
      {menuItem && (
        <div
          className="absolute inset-0 z-40 bg-black/70 backdrop-blur-[2px] flex items-center justify-center p-3 animate-in fade-in duration-150"
          onClick={() => setMenuItem(null)}
          dir="rtl"
        >
          <div
            className="w-full max-w-[360px] flex items-center gap-2.5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Highlighted Selected Clipboard Card (Right side in RTL) */}
            <div
              className={`flex-1 rounded-2xl p-3 border shadow-2xl flex flex-col justify-between gap-2.5 max-h-[210px] ${
                isLight
                  ? 'bg-white border-slate-200 text-slate-900'
                  : 'bg-[#1A1B21] border-white/15 text-white'
              }`}
            >
              <div className="text-right text-xs leading-relaxed overflow-y-auto custom-scroll max-h-[125px] break-words">
                {menuItem.text}
              </div>

              <button
                type="button"
                onClick={() => {
                  onTogglePin(menuItem.id);
                  setMenuItem((prev) => (prev ? { ...prev, pinned: !prev.pinned } : null));
                }}
                className={`w-full rounded-xl px-2.5 py-2 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors ${
                  menuItem.pinned
                    ? 'bg-[#FF7A00]/20 text-[#FF9A3D] border border-[#FF7A00]/40'
                    : isLight
                    ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    : 'bg-[#2C2E36] text-zinc-200 hover:bg-[#353842]'
                }`}
              >
                <Pin className="w-3.5 h-3.5 shrink-0" />
                <span>{menuItem.pinned ? 'جێگیرکراوە (لابردن)' : 'هەمیشەیی پارێزراوە'}</span>
              </button>
            </div>

            {/* Floating Action Menu Card (Left side in RTL): وەرگێڕان, دەستکاری, سڕینەوە */}
            <div
              className={`w-[152px] shrink-0 rounded-2xl border shadow-2xl py-1.5 flex flex-col overflow-hidden ${
                isLight
                  ? 'bg-white border-slate-200 text-slate-900'
                  : 'bg-[#1A1B21] border-white/10 text-white'
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  const txt = menuItem.text;
                  setMenuItem(null);
                  onTranslateItem(txt);
                }}
                className={`w-full px-4 py-3.5 flex items-center justify-between gap-3 text-sm font-bold transition-colors ${
                  isLight ? 'hover:bg-slate-100' : 'hover:bg-white/[0.06] active:bg-white/10'
                }`}
              >
                <span className="text-[#FF7A00] flex items-center justify-center">
                  <KurdiIcon name="ic_translate" className="w-[18px] h-[18px]" />
                </span>
                <span className="flex-1 text-right">وەرگێڕان</span>
              </button>

              <button
                type="button"
                onClick={() => openEditor(menuItem)}
                className={`w-full px-4 py-3.5 flex items-center justify-between gap-3 text-sm font-bold transition-colors ${
                  isLight ? 'hover:bg-slate-100' : 'hover:bg-white/[0.06] active:bg-white/10'
                }`}
              >
                <span className="text-[#FF7A00] flex items-center justify-center">
                  <Pencil className="w-[17px] h-[17px]" />
                </span>
                <span className="flex-1 text-right">دەستکاری</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const id = menuItem.id;
                  setMenuItem(null);
                  onDeleteItem(id);
                }}
                className={`w-full px-4 py-3.5 flex items-center justify-between gap-3 text-sm font-bold transition-colors ${
                  isLight ? 'hover:bg-slate-100' : 'hover:bg-white/[0.06] active:bg-white/10'
                }`}
              >
                <span className="text-[#FF7A00] flex items-center justify-center">
                  <KurdiIcon name="ic_trash" className="w-[18px] h-[18px]" />
                </span>
                <span className="flex-1 text-right">سڕینەوە</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inline Clipboard Item Editor Sheet */}
      {editingItem && (
        <div
          className="absolute inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3"
          onClick={() => setEditingItem(null)}
          dir="rtl"
        >
          <div
            className={`w-full max-w-[360px] rounded-2xl border p-3.5 shadow-2xl space-y-3 ${
              isLight
                ? 'bg-white border-slate-200 text-slate-900'
                : 'bg-[#181A20] border-white/15 text-white'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-extrabold">
                <Pencil className="w-3.5 h-3.5 text-[#FF7A00]" />
                <span>دەستکاریکردنی لەبەرگیراو</span>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <textarea
              value={editDraft}
              onChange={(e) => setEditDraft(e.target.value)}
              rows={4}
              autoFocus
              dir="auto"
              className={`w-full rounded-xl p-2.5 text-xs leading-relaxed border outline-none resize-none focus:border-[#FF7A00] ${
                isLight
                  ? 'bg-slate-50 border-slate-300 text-slate-900'
                  : 'bg-black/50 border-white/10 text-white'
              }`}
            />

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={saveEdit}
                className="flex-1 h-9 rounded-xl bg-[#FF7A00] hover:bg-[#EB7000] text-white text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
                <span>پاشەکەوتکردن</span>
              </button>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className={`h-9 px-3.5 rounded-xl text-xs font-bold ${
                  isLight
                    ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                    : 'bg-white/10 text-zinc-300 hover:bg-white/15'
                }`}
              >
                پاشگەزبوونەوە
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface TextDecoratorPanelProps {
  theme: KeyboardTheme;
  settings: KeyboardSettings;
  activeDecoratorId: string;
  editorText: string;
  onSelectDecorator: (id: string) => void;
  onApplyToEditor: (transformed: string) => void;
  onClose: () => void;
}

export const TextDecoratorPanel: React.FC<TextDecoratorPanelProps> = ({
  theme,
  settings,
  activeDecoratorId,
  editorText,
  onSelectDecorator,
  onApplyToEditor,
  onClose,
}) => {
  const isLight = Boolean(theme.isLight);
  const sample = editorText.trim().slice(0, 24) || 'سڵاو کوردستان';

  return (
    <div
      className="flex flex-col w-full px-3 py-2.5 kb-noselect"
      style={{
        backgroundColor: theme.bg,
        height: `${Math.max(settings.keyboardHeightPx + 36, 315)}px`,
      }}
      dir="rtl"
    >
      <div className="flex items-center justify-between mb-2.5 shrink-0">
        <div className="flex items-center gap-2">
          <KurdiIcon name="ic_text" className="w-4 h-4 text-sky-400" />
          <span className={`text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
            جوانکاری نووسین
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className={`w-8 h-8 rounded-full flex items-center justify-center ${
            isLight ? 'bg-slate-200 text-slate-900' : 'bg-zinc-800 text-white'
          }`}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 overflow-y-auto custom-scroll flex-1 content-start pb-1">
        {TEXT_DECORATORS.map((dec) => {
          const isSelected = activeDecoratorId === dec.id;
          const previewText = editorText.trim() ? dec.transform(sample) : dec.preview;
          return (
            <div
              key={dec.id}
              className={`rounded-xl p-2.5 border flex flex-col gap-1.5 transition-all ${
                isSelected
                  ? 'border-sky-500 bg-sky-500/15'
                  : isLight
                  ? 'border-slate-200 bg-white'
                  : 'border-white/5 bg-[#15171B]'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className={`text-[11px] font-semibold ${isLight ? 'text-slate-600' : 'text-zinc-400'}`}>
                  {dec.nameKu}
                </span>
                <button
                  type="button"
                  onClick={() => onSelectDecorator(dec.id)}
                  className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${
                    isSelected
                      ? 'bg-sky-500 text-white'
                      : isLight
                      ? 'bg-slate-200 text-slate-700'
                      : 'bg-zinc-800 text-zinc-300'
                  }`}
                >
                  {isSelected ? 'چالاکە' : 'هەڵبژاردن'}
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (editorText.trim()) {
                    onApplyToEditor(dec.transform(editorText));
                  } else {
                    onSelectDecorator(dec.id);
                  }
                }}
                className={`text-right text-sm font-medium truncate py-0.5 ${
                  isLight ? 'text-slate-900' : 'text-white'
                }`}
              >
                {previewText}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface QuickThemesPanelProps {
  theme: KeyboardTheme;
  settings: KeyboardSettings;
  onSelectTheme: (id: string) => void;
  onOpenThemeStore: () => void;
  onClose: () => void;
}

export const QuickThemesPanel: React.FC<QuickThemesPanelProps> = ({
  theme,
  settings,
  onSelectTheme,
  onOpenThemeStore,
  onClose,
}) => {
  const isLight = Boolean(theme.isLight);
  return (
    <div
      className="flex flex-col w-full px-3 py-2.5 kb-noselect"
      style={{
        backgroundColor: theme.bg,
        height: `${Math.max(settings.keyboardHeightPx + 36, 315)}px`,
      }}
      dir="rtl"
    >
      <div className="flex items-center justify-between mb-2.5 shrink-0">
        <div className="flex items-center gap-2">
          <KurdiIcon name="ic_themes" className="w-4 h-4 text-sky-400" />
          <span className={`text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
            ڕووکارەکان ({ALL_THEMES.length})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenThemeStore}
            className="h-8 px-3 rounded-lg bg-[#0B5FA8] text-white text-xs font-semibold"
          >
            فرۆشگای ڕووکار
          </button>
          <button
            type="button"
            onClick={onClose}
            className={`w-8 h-8 rounded-full flex items-center justify-center ${
              isLight ? 'bg-slate-200 text-slate-900' : 'bg-zinc-800 text-white'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 overflow-y-auto custom-scroll flex-1 content-start pb-1">
        {ALL_THEMES.map((t) => {
          const active = settings.activeThemeId === t.id;
          const bw = t.keyBorderWidth ?? (t.hasKeyBorder ? 1 : 0);
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelectTheme(t.id)}
              className={`rounded-xl p-2 border-2 transition-all flex flex-col gap-1.5 text-right ${
                active ? 'border-sky-400 scale-[1.01]' : 'border-transparent hover:border-white/20'
              }`}
              style={{ backgroundColor: t.bg }}
            >
              <div className="flex gap-1">
                <span
                  className="h-3.5 flex-1 rounded"
                  style={{
                    backgroundColor: t.keyBg,
                    border: bw > 0 ? `${bw}px solid ${t.keyBorder}` : 'none',
                  }}
                />
                <span
                  className="h-3.5 flex-1 rounded"
                  style={{
                    backgroundColor: t.keyBg,
                    border: bw > 0 ? `${bw}px solid ${t.keyBorder}` : 'none',
                  }}
                />
                <span
                  className="h-3.5 w-6 rounded"
                  style={{
                    backgroundColor: t.enterBg,
                    border: t.enterBorder ? `1px solid ${t.enterBorder}` : 'none',
                  }}
                />
              </div>
              <div className="flex items-center justify-between gap-1">
                <span
                  className="text-[10px] font-semibold truncate"
                  style={{ color: t.keyText }}
                >
                  {t.nameKu}
                </span>
                {active && <Check className="w-3 h-3 text-sky-400 shrink-0" />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

interface ResizePanelProps {
  theme: KeyboardTheme;
  settings: KeyboardSettings;
  onUpdate: (patch: Partial<KeyboardSettings>) => void;
  onClose: () => void;
}

export const ResizePanel: React.FC<ResizePanelProps> = ({
  theme,
  settings,
  onUpdate,
  onClose,
}) => {
  const isLight = Boolean(theme.isLight);
  return (
    <div
      className="flex flex-col w-full px-4 py-3 kb-noselect justify-between"
      style={{
        backgroundColor: theme.bg,
        height: `${Math.max(settings.keyboardHeightPx + 36, 315)}px`,
      }}
      dir="rtl"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <KurdiIcon name="ic_resize" className="w-4 h-4 text-sky-400" />
          <span className={`text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
            گۆڕینی قەبارەی تەختەکلیل
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="h-8 px-3.5 rounded-full bg-[#0B5FA8] text-white text-xs font-bold"
        >
          پاشەکەوت
        </button>
      </div>

      <div className="space-y-4 my-auto">
        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className={isLight ? 'text-slate-700' : 'text-zinc-300'}>بەرزی تەختەکلیل (تا نیوەی شاشە)</span>
            <span className="font-mono text-sky-400 tabular-nums">{settings.keyboardHeightPx}px</span>
          </div>
          <input
            type="range"
            min={210}
            max={480}
            value={settings.keyboardHeightPx}
            onChange={(e) => onUpdate({ keyboardHeightPx: Number(e.target.value) })}
            className="w-full accent-sky-500"
          />
        </div>

        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className={isLight ? 'text-slate-700' : 'text-zinc-300'}>قیاسی پیتەکان</span>
            <span className="font-mono text-sky-400 tabular-nums">{settings.fontSizePercent}%</span>
          </div>
          <input
            type="range"
            min={85}
            max={160}
            value={settings.fontSizePercent}
            onChange={(e) => onUpdate({ fontSizePercent: Number(e.target.value) })}
            className="w-full accent-sky-500"
          />
        </div>

        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className={isLight ? 'text-slate-700' : 'text-zinc-300'}>دۆخی یەکدەست</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { id: 'off', label: 'ئاسایی' },
                { id: 'right', label: 'دەستی ڕاست' },
                { id: 'left', label: 'دەستی چەپ' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onUpdate({ oneHandedMode: opt.id })}
                className={`h-9 rounded-xl text-xs font-semibold border transition-colors ${
                  settings.oneHandedMode === opt.id
                    ? 'bg-sky-500/20 border-sky-500 text-sky-400'
                    : isLight
                    ? 'bg-white border-slate-200 text-slate-700'
                    : 'bg-zinc-900 border-white/10 text-zinc-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-center">
        <button
          type="button"
          onClick={() =>
            onUpdate({ keyboardHeightPx: 248, fontSizePercent: 130, oneHandedMode: 'off' })
          }
          className="text-xs text-zinc-400 hover:text-white underline underline-offset-4"
        >
          گەڕاندنەوە بۆ قەبارەی بنەڕەتی
        </button>
      </div>
    </div>
  );
};

const translateCache = new Map<string, string>();
const rewriteCache = new Map<string, string>();

function setBoundedCache(cache: Map<string, string>, key: string, val: string) {
  if (cache.size >= 60) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) cache.delete(firstKey);
  }
  cache.set(key, val);
}

function readLiveEditorText(preferSelection: boolean, fallbackText: string): string {
  if (typeof window !== 'undefined' && window.AndroidIME?.getEditorText) {
    try {
      const live = window.AndroidIME.getEditorText(preferSelection);
      if (typeof live === 'string' && live.trim()) {
        return live;
      }
    } catch {
      // Fallback to React state
    }
  }
  return fallbackText;
}

async function consumeTextOrJsonStream(
  res: Response,
  jsonKey: 'translated' | 'result',
  fallbackError: string,
  onPartial: (text: string) => void
): Promise<string> {
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  if (!res.ok) {
    if (ct.includes('application/json')) {
      const errData = (await res.json()) as { error?: string };
      throw new Error(errData.error || fallbackError);
    }
    const errText = (await res.text()).trim();
    throw new Error(errText || fallbackError);
  }

  if (ct.includes('application/json') || !res.body) {
    const data = (await res.json()) as Record<string, unknown>;
    const finalVal = typeof data[jsonKey] === 'string' ? (data[jsonKey] as string).trim() : '';
    if (finalVal) onPartial(finalVal);
    return finalVal;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let acc = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      acc += decoder.decode(value, { stream: true });
      const trimmedStart = acc.trimStart();
      if (trimmedStart) onPartial(trimmedStart);
    }
  }
  acc += decoder.decode();
  const finalVal = acc.trim();
  if (finalVal) onPartial(finalVal);
  return finalVal;
}

interface TranslatePanelProps {
  theme: KeyboardTheme;
  settings: KeyboardSettings;
  editorText: string;
  initialText?: string | null;
  onUpdateSettings?: (patch: Partial<KeyboardSettings>) => void;
  onStartLiveTranslate?: () => void;
  onInsertTranslated: (text: string, replaceAll: boolean) => void;
  onClose: () => void;
}

const readSavedLang = (key: string, fallback: string) => {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
};

export const TranslatePanel: React.FC<TranslatePanelProps> = ({
  theme,
  settings,
  editorText,
  initialText,
  onUpdateSettings,
  onStartLiveTranslate,
  onInsertTranslated,
  onClose,
}) => {
  const isLight = Boolean(theme.isLight);
  const preferSelection = settings.aiTextSource === 'selected_or_all';
  const [sourceLang, setSourceLang] = useState(() => readSavedLang('kurdi_tr_src', 'ckb'));
  const [targetLang, setTargetLang] = useState(() => readSavedLang('kurdi_tr_tgt', 'en'));
  const [pickingLang, setPickingLang] = useState<'source' | 'target' | null>(null);
  const [input, setInput] = useState(() =>
    initialText !== null && initialText !== undefined
      ? initialText
      : readLiveEditorText(preferSelection, editorText)
  );
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const updateSourceLang = (code: string) => {
    setSourceLang(code);
    try {
      localStorage.setItem('kurdi_tr_src', code);
    } catch {
      // ignore storage errors
    }
  };

  const updateTargetLang = (code: string) => {
    setTargetLang(code);
    try {
      localStorage.setItem('kurdi_tr_tgt', code);
    } catch {
      // ignore storage errors
    }
  };

  useEffect(() => {
    if (initialText !== null && initialText !== undefined) {
      setInput(initialText);
    }
  }, [initialText]);

  // Pre-warm Vercel serverless function in background when AI fluent mode is active
  useEffect(() => {
    const resolved = resolveAiServer(settings.aiServerUrl);
    if (settings.translationEngine === 'ai_fluent' && resolved.source !== 'none') {
      fetch(`${resolved.baseUrl}/api/health`).catch(() => {});
    }
    return () => {
      abortRef.current?.abort();
    };
  }, [settings.aiServerUrl, settings.translationEngine]);

  const handleTranslate = async () => {
    const liveFallback = readLiveEditorText(preferSelection, editorText);
    const textToTranslate = (input || liveFallback).trim();
    if (!textToTranslate) {
      setError('تکایە دەقێک بنووسە بۆ وەرگێڕان.');
      return;
    }
    if (!input.trim() && liveFallback.trim()) {
      setInput(liveFallback.trim());
    }

    const engine = settings.translationEngine;
    const cacheKey = `${engine}|${sourceLang}|${targetLang}|${textToTranslate}`;
    const cached = translateCache.get(cacheKey);
    if (cached) {
      setError(null);
      setOutput(cached);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    const resolved = resolveAiServer(settings.aiServerUrl);

    const translateGoogleDirect = async (): Promise<string> => {
      const sl = sourceLang || 'auto';
      const tl = targetLang || 'en';
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(
        sl
      )}&tl=${encodeURIComponent(tl)}&dt=t&q=${encodeURIComponent(textToTranslate)}`;
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error('هەڵە لە پەیوەندی بە وەرگێڕی گوگڵەوە ڕوویدا.');
      const json = (await res.json()) as unknown[];
      const segments = Array.isArray(json?.[0]) ? (json[0] as unknown[][]) : [];
      const joined = segments
        .map((seg) => (Array.isArray(seg) && typeof seg[0] === 'string' ? seg[0] : ''))
        .join('')
        .trim();
      if (!joined) throw new Error('وەڵامێک لە وەرگێڕەوە نەگەڕایەوە.');
      return joined;
    };

    const translateWithGeminiServer = async (): Promise<string> => {
      const res = await fetch(`${resolved.baseUrl}/api/ai/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          text: textToTranslate,
          sourceLang,
          targetLang,
          sourceLangName: getTranslationLang(sourceLang).english,
          targetLangName: getTranslationLang(targetLang).english,
          engine,
          stream: true,
        }),
      });
      return consumeTextOrJsonStream(
        res,
        'translated',
        'هەڵە لە سێرڤەری AI ـدا ڕوویدا.',
        (partial) => setOutput(partial)
      );
    };

    try {
      // Fast Google mode: hit Google Translate directly (~150-300ms) instead of waiting for Vercel + LLM!
      if (engine === 'google_fast') {
        try {
          const fastResult = await translateGoogleDirect();
          setBoundedCache(translateCache, cacheKey, fastResult);
          setOutput(fastResult);
          return;
        } catch (googleErr: unknown) {
          if (controller.signal.aborted) return;
          if (resolved.source !== 'none') {
            const aiFallback = await translateWithGeminiServer();
            if (aiFallback) {
              setBoundedCache(translateCache, cacheKey, aiFallback);
              setOutput(aiFallback);
              return;
            }
          }
          throw googleErr;
        }
      }

      // Fluent Gemini AI mode: stream from Vercel/server first, fallback to Google direct if no server configured
      if (resolved.source !== 'none') {
        const streamed = await translateWithGeminiServer();
        if (streamed) {
          setBoundedCache(translateCache, cacheKey, streamed);
          setOutput(streamed);
          return;
        }
      }

      const fallbackTranslated = await translateGoogleDirect();
      setBoundedCache(translateCache, cacheKey, fallbackTranslated);
      setOutput(fallbackTranslated);
    } catch (e: unknown) {
      if (controller.signal.aborted) return;
      setError(
        e instanceof Error
          ? e.message
          : 'هەڵەی پەیوەندی ڕوویدا. دڵنیابە لە بوونی ئینتەرنێت.'
      );
    } finally {
      if (abortRef.current === controller) {
        setLoading(false);
      }
    }
  };

  const panelHeight = Math.max(settings.keyboardHeightPx + 36, 315);

  if (pickingLang) {
    return (
      <div className="w-full" style={{ height: `${panelHeight}px` }}>
        <TranslationLanguagePicker
          title={pickingLang === 'source' ? 'هەڵبژاردنی زمانی سەرچاوە' : 'هەڵبژاردنی زمانی مەبەست'}
          selectedCode={pickingLang === 'source' ? sourceLang : targetLang}
          includeAuto={pickingLang === 'source'}
          isLight={isLight}
          bgColor={theme.bg}
          onSelect={(code) => {
            if (pickingLang === 'source') {
              updateSourceLang(code);
            } else {
              updateTargetLang(code);
            }
          }}
          onClose={() => setPickingLang(null)}
        />
      </div>
    );
  }

  return (
    <div
      className="flex flex-col w-full px-3 py-2.5 gap-2"
      style={{
        backgroundColor: theme.bg,
        height: `${panelHeight}px`,
      }}
      dir="rtl"
    >
      <div className="flex items-center justify-between shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <KurdiIcon name="ic_translate" className="w-4 h-4 text-sky-400 shrink-0" />
          <span className={`text-sm font-bold shrink-0 ${isLight ? 'text-slate-900' : 'text-white'}`}>
            وەرگێڕان
          </span>
          {onUpdateSettings ? (
            <button
              type="button"
              onClick={() =>
                onUpdateSettings({
                  translationEngine:
                    settings.translationEngine === 'google_fast' ? 'ai_fluent' : 'google_fast',
                })
              }
              className={`h-6 px-2.5 rounded-full text-[10.5px] font-bold transition-colors truncate ${
                settings.translationEngine === 'ai_fluent'
                  ? 'bg-sky-500/20 text-sky-400 border border-sky-400/30'
                  : isLight
                  ? 'bg-slate-200 text-slate-700'
                  : 'bg-white/10 text-zinc-300'
              }`}
              title="گۆڕینی بزوێنەری وەرگێڕان"
            >
              {settings.translationEngine === 'ai_fluent' ? 'Gemini زیرەک' : 'گوگڵ خێرا'}
            </button>
          ) : (
            <span className="text-[11px] text-zinc-400 truncate">
              · {settings.translationEngine === 'ai_fluent' ? 'Gemini زیرەک' : 'گوگڵ خێرا'}
            </span>
          )}
          {onStartLiveTranslate && (
            <button
              type="button"
              onClick={onStartLiveTranslate}
              className="h-6 px-2.5 rounded-full text-[10.5px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-400/30 whitespace-nowrap shrink-0"
              title="وەرگێڕانی ڕاستەوخۆ لەسەرووی پیتەکان"
            >
              ڕاستەوخۆ
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
            isLight ? 'bg-slate-200 text-slate-900' : 'bg-zinc-800 text-white'
          }`}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => setPickingLang('source')}
          className={`flex-1 h-9 rounded-xl px-2.5 text-xs font-bold border flex items-center justify-between gap-1.5 min-w-0 active:scale-[0.98] transition-transform ${
            isLight
              ? 'bg-white border-slate-200 text-slate-900'
              : 'bg-[#16181D] border-white/10 text-white'
          }`}
        >
          <span className="truncate">{getTranslationLang(sourceLang).label}</span>
          <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
        </button>

        <button
          type="button"
          onClick={() => {
            if (sourceLang === 'auto') {
              const nextSrc = targetLang;
              const nextTgt = targetLang === 'ckb' ? 'en' : 'ckb';
              updateSourceLang(nextSrc);
              updateTargetLang(nextTgt);
              return;
            }
            const prevSrc = sourceLang;
            updateSourceLang(targetLang);
            updateTargetLang(prevSrc);
          }}
          className="w-9 h-9 rounded-xl bg-sky-600/20 text-sky-400 flex items-center justify-center shrink-0 hover:bg-sky-600/30 active:scale-95 transition-transform"
          title="گۆڕینەوە"
        >
          <ArrowLeftRight className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => setPickingLang('target')}
          className={`flex-1 h-9 rounded-xl px-2.5 text-xs font-bold border flex items-center justify-between gap-1.5 min-w-0 active:scale-[0.98] transition-transform ${
            isLight
              ? 'bg-white border-slate-200 text-slate-900'
              : 'bg-[#16181D] border-white/10 text-white'
          }`}
        >
          <span className="truncate">{getTranslationLang(targetLang).label}</span>
          <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
        </button>
      </div>

      <div className="flex gap-2 shrink-0">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleTranslate();
          }}
          placeholder="دەقەکەت لێرە بنووسە..."
          className={`flex-1 h-10 rounded-xl px-3 text-xs outline-none border ${
            isLight
              ? 'bg-white border-slate-200 text-slate-900'
              : 'bg-[#16181D] border-white/10 text-white placeholder:text-zinc-500'
          }`}
        />
        <button
          type="button"
          onClick={handleTranslate}
          disabled={loading}
          className="h-10 px-4 rounded-xl bg-[#0B5FA8] hover:bg-[#0D70C7] disabled:opacity-60 text-white text-xs font-bold flex items-center gap-1.5 shrink-0"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'وەرگێڕە'}
        </button>
      </div>

      <div
        className={`flex-1 rounded-xl p-3 border overflow-y-auto custom-scroll flex flex-col justify-between gap-2 ${
          isLight
            ? 'bg-white border-slate-200 text-slate-900'
            : 'bg-[#121418] border-white/5 text-white'
        }`}
      >
        {error ? (
          <p className="text-xs text-rose-400 my-auto text-center">{error}</p>
        ) : output ? (
          <>
            <p className="text-sm leading-relaxed select-text" dir="auto">
              {output}
            </p>
            <div className="flex items-center gap-2 pt-2 border-t border-white/5">
              <button
                type="button"
                onClick={() => {
                  onInsertTranslated(output, true);
                  onClose();
                }}
                className="flex-1 h-8 rounded-lg bg-sky-600 text-white text-xs font-semibold hover:bg-sky-500"
              >
                جێگرەوەی دەق
              </button>
              <button
                type="button"
                onClick={() => {
                  onInsertTranslated(output, false);
                  onClose();
                }}
                className={`flex-1 h-8 rounded-lg text-xs font-semibold ${
                  isLight ? 'bg-slate-200 text-slate-900' : 'bg-zinc-800 text-white'
                }`}
              >
                زیادکردن
              </button>
            </div>
          </>
        ) : (
          <p className="text-xs text-zinc-500 my-auto text-center">
            دەقەکەت بنووسە و لەسەر «وەرگێڕە» دابگرە بۆ وەرگێڕانی خێرا
          </p>
        )}
      </div>
    </div>
  );
};

interface SmartAIPanelProps {
  theme: KeyboardTheme;
  settings: KeyboardSettings;
  editorText: string;
  onApplyText: (text: string, replaceAll: boolean) => void;
  onClose: () => void;
}

const AI_MODES = [
  { id: 'fix', label: 'ڕاستکردنەوە' },
  { id: 'badini', label: 'سۆرانی ← بادینی' },
  { id: 'sorani', label: 'بادینی ← سۆرانی' },
  { id: 'expand', label: 'درێژکردنەوە' },
  { id: 'poetic', label: 'شاعیرانە' },
  { id: 'shorten', label: 'کورتکردنەوە' },
  { id: 'rephrase', label: 'داڕشتنەوە' },
  { id: 'explain', label: 'مانا' },
  { id: 'formal', label: 'فەرمی' },
  { id: 'friendly', label: 'دۆستانە' },
  { id: 'reply', label: 'وەڵامی نامە' },
] as const;

type PanelAIMode = (typeof AI_MODES)[number]['id'] | 'tone' | 'custom';

const TONE_STYLES = [
  { id: 'casual', label: 'ئاسایی' },
  { id: 'professional', label: 'فەرمی' },
  { id: 'academic', label: 'ئەکادیمی' },
] as const;

const TONE_INTENTS = [
  { id: 'polite', label: 'بەڕێزانە' },
  { id: 'work', label: 'کار' },
  { id: 'email', label: 'ئیمەیڵ' },
  { id: 'humor', label: 'گاڵتەوگەپ' },
  { id: 'academic', label: 'لێکۆڵینەوە' },
] as const;

const TONE_LENGTHS = [
  { id: 'very_short', label: 'زۆر کورت' },
  { id: 'short', label: 'کورت' },
  { id: 'medium', label: 'مامناوەند' },
  { id: 'long', label: 'درێژ' },
  { id: 'detailed', label: 'بەوردی' },
] as const;

export const SmartAIPanel: React.FC<SmartAIPanelProps> = ({
  theme,
  settings,
  editorText,
  onApplyText,
  onClose,
}) => {
  const isLight = Boolean(theme.isLight);
  const preferSelection = settings.aiTextSource === 'selected_or_all';
  const [activeMode, setActiveMode] = useState<PanelAIMode>('fix');
  const [capturedText, setCapturedText] = useState<string>(() =>
    readLiveEditorText(preferSelection, editorText)
  );
  const [editingInput, setEditingInput] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [toneOpen, setToneOpen] = useState(false);
  const [toneStyle, setToneStyle] = useState<NonNullable<ToneOptions['style']>>('professional');
  const [toneIntent, setToneIntent] = useState<NonNullable<ToneOptions['intent']>>('polite');
  const [toneLength, setToneLength] = useState<NonNullable<ToneOptions['length']>>('medium');
  const [customPrompt, setCustomPrompt] = useState('');
  const [result, setResult] = useState('');
  const [usedOffline, setUsedOffline] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Sync live host text & pre-warm Vercel serverless endpoint as soon as panel opens
  useEffect(() => {
    const live = readLiveEditorText(preferSelection, editorText);
    if (live.trim()) {
      setCapturedText(live);
    }
    const resolved = resolveAiServer(settings.aiServerUrl);
    if (resolved.source !== 'none') {
      fetch(`${resolved.baseUrl}/api/health`).catch(() => {});
    }
    return () => {
      abortRef.current?.abort();
    };
  }, [editorText, preferSelection, settings.aiServerUrl]);

  const runRewrite = async (
    mode: PanelAIMode,
    options?: { instructionOverride?: string; bypassCache?: boolean }
  ) => {
    setActiveMode(mode);
    const liveHost = editingInput
      ? capturedText
      : readLiveEditorText(preferSelection, capturedText || editorText);
    const liveText = (liveHost || capturedText || editorText).trim();
    if (liveText && liveText !== capturedText) {
      setCapturedText(liveText);
    }

    if (!liveText) {
      setResult('');
      setEditingInput(true);
      setError('سەرەتا دەقێک بنووسە یان لێرە بیلکێنە.');
      return;
    }

    const cleanCustom = (options?.instructionOverride ?? customPrompt).trim();
    if (mode === 'custom' && !cleanCustom) {
      setError('تکایە فەرمانێک بنووسە (وەک: بیکە بە ئیمەیڵی فەرمی).');
      return;
    }

    const tonePayload: ToneOptions | undefined =
      mode === 'tone'
        ? { style: toneStyle, intent: toneIntent, length: toneLength }
        : undefined;

    const cacheKey = `${mode}|${cleanCustom}|${tonePayload ? JSON.stringify(tonePayload) : ''}|${liveText}`;
    if (!options?.bypassCache) {
      const cached = rewriteCache.get(cacheKey);
      if (cached) {
        setError(null);
        setUsedOffline(false);
        setResult(cached);
        return;
      }
    }

    const resolved = resolveAiServer(settings.aiServerUrl);

    if (resolved.source === 'none') {
      setError(null);
      setUsedOffline(true);
      setResult(runOfflineSmartRewrite(liveText, mode, tonePayload));
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setUsedOffline(false);
    setResult('');
    try {
      const res = await fetch(`${resolved.baseUrl}/api/ai/rewrite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          text: liveText,
          mode,
          customPrompt: mode === 'custom' ? cleanCustom : undefined,
          tone: tonePayload,
          stream: true,
        }),
      });

      const finalResult = await consumeTextOrJsonStream(
        res,
        'result',
        'هەڵە لە داڕشتنەوەدا ڕوویدا.',
        (partial) => {
          setLoading(false);
          setResult(partial);
        }
      );

      if (finalResult) {
        setBoundedCache(rewriteCache, cacheKey, finalResult);
        setResult(finalResult);
      }
    } catch (err: unknown) {
      if (controller.signal.aborted) return;
      // Seamless high-quality offline fallback if server is temporarily unreachable, while offering error info
      const offlineOut = runOfflineSmartRewrite(liveText, mode, tonePayload);
      if (resolved.source === 'settings' || resolved.source === 'env') {
        if (offlineOut && offlineOut !== liveText) {
          setUsedOffline(true);
          setResult(offlineOut);
        } else {
          setError(
            err instanceof Error
              ? err.message
              : 'نەتوانرا پەیوەندی بە سێرڤەری AI ـەوە بکرێت. دڵنیابە لە بەستەری Vercel و ئینتەرنێت.'
          );
        }
      } else {
        setUsedOffline(true);
        setResult(offlineOut);
      }
    } finally {
      if (abortRef.current === controller) {
        setLoading(false);
      }
    }
  };

  return (
    <div
      className="flex flex-col w-full px-3 py-2.5 gap-2"
      style={{
        backgroundColor: theme.bg,
        height: `${Math.max(settings.keyboardHeightPx + 54, 336)}px`,
      }}
      dir="rtl"
    >
      {/* Header */}
      <div className="flex items-center justify-between shrink-0 gap-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <KurdiIcon name="ic_smart" className="w-4 h-4 text-sky-400 shrink-0" />
          <span className={`text-xs sm:text-sm font-bold shrink-0 ${isLight ? 'text-slate-900' : 'text-white'}`}>
            وەڵامدەرەوەی زیرەک (AI)
          </span>
          <button
            type="button"
            onClick={() => {
              setToneOpen((v) => !v);
              setCustomOpen(false);
            }}
            className={`h-6 px-2 rounded-full text-[10.5px] font-bold transition-colors whitespace-nowrap shrink-0 flex items-center gap-1 ${
              toneOpen || activeMode === 'tone'
                ? 'bg-sky-500/20 text-sky-400 border border-sky-400/35'
                : isLight
                ? 'bg-slate-200 text-slate-700'
                : 'bg-white/10 text-zinc-300'
            }`}
            title="شێوازی دەربڕین"
          >
            <SlidersHorizontal className="w-3 h-3" />
            <span>شێواز</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setCustomOpen((v) => !v);
              setToneOpen(false);
            }}
            className={`h-6 px-2 rounded-full text-[10.5px] font-bold transition-colors whitespace-nowrap shrink-0 ${
              customOpen || activeMode === 'custom'
                ? 'bg-sky-500/20 text-sky-400 border border-sky-400/35'
                : isLight
                ? 'bg-slate-200 text-slate-700'
                : 'bg-white/10 text-zinc-300'
            }`}
          >
            فەرمان
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
            isLight ? 'bg-slate-200 text-slate-900' : 'bg-zinc-800 text-white'
          }`}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Inline editable text box when host search bar restricts reading or user wants to edit text directly */}
      {(editingInput || !capturedText.trim()) && (
        <div className="flex items-center gap-1.5 shrink-0">
          <input
            type="text"
            value={capturedText}
            onChange={(e) => {
              setCapturedText(e.target.value);
              if (error) setError(null);
            }}
            placeholder="دەقەکەت لێرە بنووسە یان بیلکێنە..."
            className={`flex-1 h-8 rounded-xl px-2.5 text-xs outline-none border ${
              isLight
                ? 'bg-white border-slate-300 text-slate-900'
                : 'bg-[#16181D] border-white/15 text-white placeholder:text-zinc-500'
            }`}
            dir="auto"
          />
          {capturedText.trim() && (
            <button
              type="button"
              onClick={() => setEditingInput(false)}
              className="h-8 px-2.5 rounded-xl bg-sky-600 text-white text-[11px] font-bold shrink-0"
            >
              باشە
            </button>
          )}
        </div>
      )}

      {/* Official AI Tone Studio Drawer (Style / Intent / Length from strings.xml) */}
      {toneOpen && (
        <div
          className={`rounded-xl p-2 border space-y-1.5 shrink-0 ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#14171F] border-white/10'
          }`}
        >
          <div className="flex items-center gap-1 overflow-x-auto custom-scroll">
            <span className="text-[10px] font-bold text-zinc-400 shrink-0 pl-1">شێواز:</span>
            {TONE_STYLES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setToneStyle(s.id)}
                className={`h-6 px-2 rounded-lg text-[10.5px] font-bold shrink-0 ${
                  toneStyle === s.id
                    ? 'bg-[#0B5FA8] text-white'
                    : isLight
                    ? 'bg-white text-slate-700 border border-slate-200'
                    : 'bg-white/[0.06] text-zinc-300'
                }`}
              >
                {s.label}
              </button>
            ))}
            <span className="text-[10px] font-bold text-zinc-400 shrink-0 pr-1.5 pl-1">مەبەست:</span>
            {TONE_INTENTS.map((i) => (
              <button
                key={i.id}
                type="button"
                onClick={() => setToneIntent(i.id)}
                className={`h-6 px-2 rounded-lg text-[10.5px] font-bold shrink-0 ${
                  toneIntent === i.id
                    ? 'bg-[#0B5FA8] text-white'
                    : isLight
                    ? 'bg-white text-slate-700 border border-slate-200'
                    : 'bg-white/[0.06] text-zinc-300'
                }`}
              >
                {i.label}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1 overflow-x-auto custom-scroll">
              <span className="text-[10px] font-bold text-zinc-400 shrink-0 pl-1">درێژی:</span>
              {TONE_LENGTHS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setToneLength(l.id)}
                  className={`h-6 px-2 rounded-lg text-[10.5px] font-bold shrink-0 ${
                    toneLength === l.id
                      ? 'bg-[#0B5FA8] text-white'
                      : isLight
                      ? 'bg-white text-slate-700 border border-slate-200'
                      : 'bg-white/[0.06] text-zinc-300'
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                setToneOpen(false);
                runRewrite('tone');
              }}
              className="h-6 px-2.5 rounded-lg bg-sky-600 text-white text-[10.5px] font-bold shrink-0"
            >
              ئەنجامدان
            </button>
          </div>
        </div>
      )}

      {/* Custom Prompt Drawer */}
      {customOpen && (
        <div className="flex items-center gap-1.5 shrink-0">
          <input
            type="text"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') runRewrite('custom');
            }}
            placeholder="فەرمانەکەت بنووسە (وەک: بیکە بە ئیمەیڵی فەرمی)..."
            className={`flex-1 h-8 rounded-xl px-2.5 text-xs outline-none border ${
              isLight
                ? 'bg-white border-slate-200 text-slate-900'
                : 'bg-[#16181D] border-white/10 text-white placeholder:text-zinc-500'
            }`}
          />
          <button
            type="button"
            onClick={() => runRewrite('custom')}
            className="h-8 px-3 rounded-xl bg-[#0B5FA8] hover:bg-[#0D70C7] text-white text-xs font-bold shrink-0"
          >
            جێبەجێکردن
          </button>
        </div>
      )}

      {/* Horizontal Mode Strip */}
      <div className="flex items-center gap-1.5 overflow-x-auto custom-scroll pb-0.5 shrink-0">
        {AI_MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => runRewrite(m.id)}
            className={`h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
              activeMode === m.id
                ? 'bg-[#0B5FA8] text-white'
                : isLight
                ? 'bg-slate-200 text-slate-800 hover:bg-slate-300'
                : 'bg-[#181A20] text-zinc-200 hover:bg-[#23262F]'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Result Area */}
      <div
        className={`flex-1 rounded-xl p-3 border overflow-y-auto custom-scroll flex flex-col justify-between gap-2 ${
          isLight
            ? 'bg-white border-slate-200 text-slate-900'
            : 'bg-[#121418] border-white/5 text-white'
        }`}
      >
        {loading && !result ? (
          <div className="flex items-center justify-center gap-2 my-auto text-sky-400 text-xs">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>ژیری دەسکرد خەریکی داڕشتنەوەیە...</span>
          </div>
        ) : error ? (
          <div className="my-auto flex flex-col items-center gap-2 text-center px-2">
            <p className="text-xs text-rose-400 leading-relaxed">{error}</p>
            {capturedText.trim() && (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setUsedOffline(true);
                  setResult(runOfflineSmartRewrite(capturedText, activeMode));
                }}
                className={`h-7 px-3 rounded-lg text-[11px] font-bold transition-colors ${
                  isLight
                    ? 'bg-slate-200 text-slate-800 hover:bg-slate-300'
                    : 'bg-white/10 text-zinc-200 hover:bg-white/15'
                }`}
              >
                بەکارهێنانی دۆخی ئۆفڵاین
              </button>
            )}
          </div>
        ) : result ? (
          <>
            <div className="space-y-1.5">
              {usedOffline && (
                <div className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-400 text-[10px] font-bold">
                  دۆخی ئۆفڵاین
                </div>
              )}
              <p className="text-sm leading-relaxed select-text whitespace-pre-wrap" dir="auto">
                {result}
              </p>
            </div>
            <div className="flex items-center gap-1.5 pt-2 border-t border-white/5">
              <button
                type="button"
                onClick={() => {
                  onApplyText(result, true);
                  onClose();
                }}
                className="flex-1 h-8 rounded-lg bg-sky-600 text-white text-xs font-semibold hover:bg-sky-500"
              >
                جێگرەوەی دەق
              </button>
              <button
                type="button"
                onClick={() => {
                  onApplyText(result, false);
                  onClose();
                }}
                className={`flex-1 h-8 rounded-lg text-xs font-semibold ${
                  isLight ? 'bg-slate-200 text-slate-900' : 'bg-zinc-800 text-white'
                }`}
              >
                زیادکردن
              </button>
              <button
                type="button"
                onClick={() => runRewrite(activeMode, { bypassCache: true })}
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  isLight ? 'bg-slate-200 text-slate-800' : 'bg-zinc-800 text-zinc-300 hover:text-white'
                }`}
                title="دووبارە دروستکردنەوە"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </>
        ) : (
          <div className="my-auto text-center space-y-1.5 px-2">
            {capturedText.trim() && (
              <button
                type="button"
                onClick={() => setEditingInput(true)}
                className={`text-[11px] max-w-full truncate px-2.5 py-1 rounded-lg inline-flex items-center gap-1.5 ${
                  isLight ? 'bg-slate-100 text-slate-600' : 'bg-white/[0.04] text-zinc-400'
                }`}
                dir="auto"
                title="دەستکاریکردنی دەقی سەرچاوە"
              >
                <Pencil className="w-3 h-3 shrink-0 opacity-70" />
                <span className="truncate">«{capturedText.trim()}»</span>
              </button>
            )}
            <p className="text-xs text-zinc-500">
              یەکێک لە شێوازەکانی سەرەوە هەڵبژێرە بۆ داڕشتنەوە و گۆڕینی دەقەکەت
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
