import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  ArrowRight,
  ArrowUpDown,
  Check,
  LayoutList,
  Loader2,
  Pencil,
  Pin,
  Plus,
  Search,
  X,
} from 'lucide-react';
import {
  ClipboardItem,
  KeyboardSettings,
  KeyboardTheme,
  SettingsRoute,
} from '../../types/keyboard';
import {
  EMOJI_CATEGORIES,
  EmojiEntry,
  KAOMOJI_LIST,
  resolveEmojiWithSkinTone,
  searchEmojis,
  TEXT_DECORATORS,
  ZIKR_CATEGORIES,
} from '../../data/richContent';
import { ALL_THEMES } from '../../data/themes';
import { KurdiIcon, KurdiIconName } from '../icons/KurdiIcons';

export type ActiveKeyboardPanel =
  | 'keys'
  | 'emoji'
  | 'tools'
  | 'clipboard'
  | 'decorate'
  | 'themes'
  | 'resize'
  | 'translate'
  | 'ai_smart';

export type RichTab = 'emoji' | 'zikr' | 'kaomoji';

interface EmojiZikrKaomojiPanelProps {
  theme: KeyboardTheme;
  settings: KeyboardSettings;
  initialTab?: RichTab;
  onInsert: (text: string, source: 'emoji' | 'zikr' | 'kaomoji') => void;
  onBackspace: () => void;
  onClose: () => void;
  onOpenSettings: (route: SettingsRoute) => void;
}

export const EmojiZikrKaomojiPanel: React.FC<EmojiZikrKaomojiPanelProps> = ({
  theme,
  settings,
  initialTab = 'emoji',
  onInsert,
  onBackspace,
  onClose,
  onOpenSettings,
}) => {
  const [activeTab, setActiveTab] = useState<RichTab>(initialTab);
  const [emojiCat, setEmojiCat] = useState<string>(EMOJI_CATEGORIES[0]?.id || 'smileys');
  const [emojiSearch, setEmojiSearch] = useState<string>('');
  const [variantPopup, setVariantPopup] = useState<{ base: string; variants: string[] } | null>(null);
  const [zikrCat, setZikrCat] = useState<'recent' | 'duaa' | 'quran' | 'salawat'>('duaa');
  const [kaomojiCat, setKaomojiCat] = useState<'recent' | 'all'>('all');

  const pressTimerRef = useRef<number | null>(null);

  const isLight = Boolean(theme.isLight);
  const panelBg = theme.bg;
  const mutedText = isLight ? 'text-slate-500' : 'text-zinc-400';
  const mainText = isLight ? 'text-slate-900' : 'text-white';
  const pillBg = isLight ? 'bg-slate-200/80' : 'bg-zinc-800/80';
  const activePillBg = isLight ? 'bg-blue-100 text-blue-700' : 'bg-[#17283D] text-[#74B3FF]';

  const displayedEmojis = useMemo<EmojiEntry[]>(() => {
    if (emojiSearch.trim()) {
      return searchEmojis(emojiSearch, 84);
    }
    if (emojiCat === 'recent') {
      return settings.recentEmojis.map((c) => ({ c }));
    }
    return EMOJI_CATEGORIES.find((c) => c.id === emojiCat)?.items || [];
  }, [emojiSearch, emojiCat, settings.recentEmojis]);

  const startEmojiHold = (entry: EmojiEntry) => {
    if (!entry.v || entry.v.length === 0) return;
    if (pressTimerRef.current) window.clearTimeout(pressTimerRef.current);
    pressTimerRef.current = window.setTimeout(() => {
      setVariantPopup({ base: entry.c, variants: [entry.c, ...(entry.v || [])] });
    }, 380);
  };

  const clearEmojiHold = () => {
    if (pressTimerRef.current) {
      window.clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  return (
    <div
      className="flex flex-col w-full kb-noselect relative"
      style={{ backgroundColor: panelBg, height: `${Math.max(settings.keyboardHeightPx + 44, 325)}px` }}
      dir="ltr"
      onClick={() => {
        if (variantPopup) setVariantPopup(null);
      }}
    >
      {/* Top Sub-Category Bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 shrink-0 gap-1">
        {activeTab === 'emoji' && (
          <div className="flex items-center gap-1 overflow-x-auto custom-scroll flex-1">
            <button
              type="button"
              onClick={() => {
                setEmojiSearch('');
                setEmojiCat('recent');
              }}
              className={`min-w-[38px] h-9 px-2 rounded-full flex items-center justify-center transition-colors ${
                emojiCat === 'recent' && !emojiSearch ? activePillBg : mutedText
              }`}
              title="دوایینەکان"
            >
              <KurdiIcon name="ic_history1" className="w-4 h-4" />
            </button>
            {EMOJI_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setEmojiSearch('');
                  setEmojiCat(cat.id);
                }}
                className={`min-w-[38px] h-9 px-2 rounded-full flex items-center justify-center text-base transition-colors ${
                  emojiCat === cat.id && !emojiSearch ? activePillBg : 'opacity-70 hover:opacity-100'
                }`}
                title={cat.label}
              >
                {cat.icon}
              </button>
            ))}
          </div>
        )}

        {activeTab === 'zikr' && (
          <div className="flex items-center justify-around flex-1 gap-1">
            <button
              type="button"
              onClick={() => setZikrCat('recent')}
              className={`h-9 px-4 rounded-full flex items-center justify-center transition-colors ${
                zikrCat === 'recent' ? activePillBg : mainText
              }`}
              title="دوایین زیکرەکان"
            >
              <KurdiIcon name="ic_history1" className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setZikrCat('duaa')}
              className={`h-9 px-5 rounded-full flex items-center justify-center transition-colors ${
                zikrCat === 'duaa' ? activePillBg : mainText
              }`}
              title="دوعا و زیکر"
            >
              <KurdiIcon name="ic_zikr" className="w-[18px] h-[18px]" />
            </button>
            <button
              type="button"
              onClick={() => setZikrCat('quran')}
              className={`h-9 px-5 rounded-full flex items-center justify-center transition-colors ${
                zikrCat === 'quran' ? activePillBg : mainText
              }`}
              title="دوعا قورئانییەکان"
            >
              <KurdiIcon name="ic_ayat" className="w-[18px] h-[18px]" />
            </button>
            <button
              type="button"
              onClick={() => setZikrCat('salawat')}
              className={`h-9 px-5 rounded-full flex items-center justify-center transition-colors ${
                zikrCat === 'salawat' ? activePillBg : mainText
              }`}
              title="سەڵاوات"
            >
              <KurdiIcon name="ic_tasbih1" className="w-[18px] h-[18px]" />
            </button>
          </div>
        )}

        {activeTab === 'kaomoji' && (
          <div className="flex items-center gap-3 flex-1">
            <button
              type="button"
              onClick={() => setKaomojiCat('recent')}
              className={`h-9 px-4 rounded-full flex items-center justify-center transition-colors ${
                kaomojiCat === 'recent' ? activePillBg : mainText
              }`}
              title="دوایینەکان"
            >
              <KurdiIcon name="ic_history1" className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setKaomojiCat('all')}
              className={`h-9 px-5 rounded-full flex items-center justify-center transition-colors ${
                kaomojiCat === 'all' ? activePillBg : mainText
              }`}
              title="کاومۆجی"
            >
              <KurdiIcon name="ic_kaomoji" className="w-5 h-5" />
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
        </div>
      )}

      {/* Skin-Tone Variant Picker Overlay */}
      {variantPopup && (
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 px-2.5 py-2 rounded-2xl shadow-2xl border border-white/15 flex items-center gap-1.5"
          style={{ backgroundColor: theme.popupBg || (isLight ? '#FFFFFF' : '#1B1E26') }}
          onClick={(e) => e.stopPropagation()}
        >
          {variantPopup.variants.map((v, i) => (
            <button
              key={`${v}_${i}`}
              type="button"
              onClick={() => {
                onInsert(v, 'emoji');
                setVariantPopup(null);
              }}
              className="w-10 h-10 rounded-xl text-2xl flex items-center justify-center hover:bg-sky-500/20 active:scale-90 transition-transform"
            >
              {v}
            </button>
          ))}
        </div>
      )}

      {/* Main Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto custom-scroll px-2 py-1.5">
        {activeTab === 'emoji' && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-1.5" dir="rtl">
              <span className={`text-[11px] font-bold ${mutedText}`}>
                {emojiSearch.trim()
                  ? `ئەنجامی گەڕان بۆ «${emojiSearch}»`
                  : emojiCat === 'recent'
                  ? 'دوایین ئیمۆجییەکان'
                  : EMOJI_CATEGORIES.find((c) => c.id === emojiCat)?.label || 'خەندەکان'}
              </span>
              <span className={`text-[10px] font-mono tabular-nums ${mutedText}`}>
                {displayedEmojis.length}
              </span>
            </div>

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
                  const rendered = resolveEmojiWithSkinTone(entry, settings.emojiSkinTone);
                  const hasVariants = Boolean(entry.v && entry.v.length > 0);
                  return (
                    <button
                      key={`${entry.c}_${i}`}
                      type="button"
                      onPointerDown={() => startEmojiHold(entry)}
                      onPointerUp={clearEmojiHold}
                      onPointerLeave={clearEmojiHold}
                      onContextMenu={(e) => {
                        if (hasVariants) {
                          e.preventDefault();
                          setVariantPopup({ base: entry.c, variants: [entry.c, ...(entry.v || [])] });
                        }
                      }}
                      onClick={() => onInsert(rendered, 'emoji')}
                      className="relative h-10 rounded-xl flex items-center justify-center text-2xl hover:bg-white/10 active:scale-90 transition-transform"
                      title={entry.k || entry.e || entry.c}
                    >
                      {rendered}
                      {hasVariants && (
                        <span className="absolute bottom-1 right-1 w-1 h-1 rounded-full bg-zinc-500/70" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'zikr' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5" dir="rtl">
            {zikrCat === 'recent'
              ? settings.recentZikr.map((phrase, idx) => (
                  <button
                    key={`rec_${idx}`}
                    type="button"
                    onClick={() => onInsert(`${phrase} `, 'zikr')}
                    className={`min-h-[48px] px-2.5 py-2 rounded-xl text-center leading-snug text-[11.5px] font-medium hover:bg-white/10 active:scale-95 transition-all flex items-center justify-center ${mainText}`}
                    style={{
                      backgroundColor: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.04)',
                    }}
                  >
                    <span className="line-clamp-2">{phrase}</span>
                  </button>
                ))
              : ZIKR_CATEGORIES[zikrCat].map((entry, idx) => (
                  <button
                    key={`${zikrCat}_${idx}`}
                    type="button"
                    onClick={() => onInsert(`${entry.v} `, 'zikr')}
                    className={`min-h-[48px] px-2.5 py-2 rounded-xl text-center leading-snug text-[11.5px] font-medium hover:bg-white/10 active:scale-95 transition-all flex items-center justify-center ${mainText}`}
                    style={{
                      backgroundColor: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.04)',
                    }}
                    title={entry.v}
                  >
                    <span className="line-clamp-2">{entry.d}</span>
                  </button>
                ))}
          </div>
        )}

        {activeTab === 'kaomoji' && (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
            {(kaomojiCat === 'recent' ? settings.recentKaomoji : KAOMOJI_LIST).map((k, idx) => (
              <button
                key={`${k}_${idx}`}
                type="button"
                onClick={() => onInsert(`${k} `, 'kaomoji')}
                className={`min-h-[44px] px-1.5 py-2 rounded-xl text-center text-[13px] font-semibold tracking-tight hover:bg-white/10 active:scale-95 transition-all flex items-center justify-center whitespace-nowrap ${mainText}`}
              >
                {k}
              </button>
            ))}
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
            <span className={isLight ? 'text-slate-700' : 'text-zinc-300'}>بەرزی تەختەکلیل</span>
            <span className="font-mono text-sky-400 tabular-nums">{settings.keyboardHeightPx}px</span>
          </div>
          <input
            type="range"
            min={240}
            max={360}
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
            onUpdate({ keyboardHeightPx: 292, fontSizePercent: 130, oneHandedMode: 'off' })
          }
          className="text-xs text-zinc-400 hover:text-white underline underline-offset-4"
        >
          گەڕاندنەوە بۆ قەبارەی بنەڕەتی
        </button>
      </div>
    </div>
  );
};

interface TranslatePanelProps {
  theme: KeyboardTheme;
  settings: KeyboardSettings;
  editorText: string;
  initialText?: string | null;
  onInsertTranslated: (text: string, replaceAll: boolean) => void;
  onClose: () => void;
}

const LANG_OPTIONS = [
  { code: 'ckb', label: 'کوردی (سۆرانی)' },
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'العربية' },
  { code: 'fa', label: 'فارسی' },
  { code: 'tr', label: 'Türkçe' },
];

export const TranslatePanel: React.FC<TranslatePanelProps> = ({
  theme,
  settings,
  editorText,
  initialText,
  onInsertTranslated,
  onClose,
}) => {
  const isLight = Boolean(theme.isLight);
  const [sourceLang, setSourceLang] = useState('ckb');
  const [targetLang, setTargetLang] = useState('en');
  const [input, setInput] = useState(initialText ?? editorText);
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialText !== null && initialText !== undefined) {
      setInput(initialText);
    }
  }, [initialText]);

  const handleTranslate = async () => {
    const textToTranslate = (input || editorText).trim();
    if (!textToTranslate) {
      setError('تکایە دەقێک بنووسە بۆ وەرگێڕان.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textToTranslate,
          sourceLang,
          targetLang,
          engine: settings.translationEngine,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'هەڵە لە وەرگێڕاندا ڕوویدا.');
      }
      setOutput(data.translated || '');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'هەڵەی پەیوەندی ڕوویدا.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex flex-col w-full px-3 py-2.5 gap-2"
      style={{
        backgroundColor: theme.bg,
        height: `${Math.max(settings.keyboardHeightPx + 36, 315)}px`,
      }}
      dir="rtl"
    >
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <KurdiIcon name="ic_translate" className="w-4 h-4 text-sky-400" />
          <span className={`text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
            وەرگێڕان
          </span>
          <span className="text-[11px] text-zinc-400">
            · {settings.translationEngine === 'ai_fluent' ? 'ژیری دەسکرد (ڕەوان)' : 'خێرا'}
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

      <div className="flex items-center gap-2 shrink-0">
        <select
          value={sourceLang}
          onChange={(e) => setSourceLang(e.target.value)}
          className={`flex-1 h-9 rounded-xl px-2.5 text-xs font-semibold outline-none border ${
            isLight
              ? 'bg-white border-slate-200 text-slate-900'
              : 'bg-[#16181D] border-white/10 text-white'
          }`}
        >
          {LANG_OPTIONS.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => {
            setSourceLang(targetLang);
            setTargetLang(sourceLang);
          }}
          className="w-9 h-9 rounded-xl bg-sky-600/20 text-sky-400 flex items-center justify-center shrink-0 hover:bg-sky-600/30"
          title="گۆڕینەوە"
        >
          <ArrowLeftRight className="w-4 h-4" />
        </button>

        <select
          value={targetLang}
          onChange={(e) => setTargetLang(e.target.value)}
          className={`flex-1 h-9 rounded-xl px-2.5 text-xs font-semibold outline-none border ${
            isLight
              ? 'bg-white border-slate-200 text-slate-900'
              : 'bg-[#16181D] border-white/10 text-white'
          }`}
        >
          {LANG_OPTIONS.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
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
          <p className="text-xs text-rose-400">{error}</p>
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
  { id: 'formal', label: 'فەرمی' },
  { id: 'friendly', label: 'دۆستانە' },
  { id: 'shorten', label: 'کورتکردنەوە' },
  { id: 'reply', label: 'وەڵامی زیرەک' },
] as const;

export const SmartAIPanel: React.FC<SmartAIPanelProps> = ({
  theme,
  settings,
  editorText,
  onApplyText,
  onClose,
}) => {
  const isLight = Boolean(theme.isLight);
  const [activeMode, setActiveMode] = useState<(typeof AI_MODES)[number]['id']>('fix');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runRewrite = async (mode: (typeof AI_MODES)[number]['id']) => {
    setActiveMode(mode);
    if (!editorText.trim()) {
      setError('سەرەتا دەقێک لە خانەی نووسیندا بنووسە.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: editorText, mode }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'هەڵە لە داڕشتنەوەدا ڕوویدا.');
      }
      setResult(data.result || '');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'هەڵەی پەیوەندی ڕوویدا.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex flex-col w-full px-3 py-2.5 gap-2"
      style={{
        backgroundColor: theme.bg,
        height: `${Math.max(settings.keyboardHeightPx + 36, 315)}px`,
      }}
      dir="rtl"
    >
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <KurdiIcon name="ic_smart" className="w-4 h-4 text-sky-400" />
          <span className={`text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
            وەڵامدەرەوەی زیرەک (AI)
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

      <div className="flex items-center gap-1.5 overflow-x-auto custom-scroll pb-0.5 shrink-0">
        {AI_MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => runRewrite(m.id)}
            disabled={loading}
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

      <div
        className={`flex-1 rounded-xl p-3 border overflow-y-auto custom-scroll flex flex-col justify-between gap-2 ${
          isLight
            ? 'bg-white border-slate-200 text-slate-900'
            : 'bg-[#121418] border-white/5 text-white'
        }`}
      >
        {loading ? (
          <div className="flex items-center justify-center gap-2 my-auto text-sky-400 text-xs">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>ژیری دەسکرد خەریکی داڕشتنەوەیە...</span>
          </div>
        ) : error ? (
          <p className="text-xs text-rose-400 my-auto text-center">{error}</p>
        ) : result ? (
          <>
            <p className="text-sm leading-relaxed select-text" dir="auto">
              {result}
            </p>
            <div className="flex items-center gap-2 pt-2 border-t border-white/5">
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
            </div>
          </>
        ) : (
          <p className="text-xs text-zinc-500 my-auto text-center">
            یەکێک لە شێوازەکانی سەرەوە هەڵبژێرە بۆ داڕشتنەوە و باشترکردنی دەقەکەت
          </p>
        )}
      </div>
    </div>
  );
};
