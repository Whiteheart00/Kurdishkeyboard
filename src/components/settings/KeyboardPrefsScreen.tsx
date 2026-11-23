import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  ChevronDown,
  Clock,
  Eye,
  EyeOff,
  Globe,
  Hash,
  Keyboard as KeyboardIcon,
  Layers,
  LayoutGrid,
  List,
  MoveVertical,
  RotateCcw,
  Smile,
  Sparkles,
  Trash2,
  Type,
} from 'lucide-react';
import {
  CapitalizationBehavior,
  EmojiHistoryUpdateStrategy,
  EmojiInitialTabMode,
  EmojiStyleMode,
  EmojiSuggestionTypeMode,
  KeyboardSettings,
  NumberRowMode,
} from '../../types/keyboard';
import { BOTTOM_ROW_PRESETS, NUMBER_STYLE_OPTIONS } from '../../data/layouts';
import {
  composePersonEmoji,
  EMOJI_CATEGORIES,
  EMOJI_HAIR_STYLES,
  EMOJI_SKIN_TONES,
} from '../../data/richContent';
import { EmojiGlyph } from '../keyboard/EmojiGlyph';
import { AppToggle, NotificationBanner, ProBadge, SubPageHeader } from './SettingsUI';

interface KeyboardPrefsScreenProps {
  settings: KeyboardSettings;
  onUpdate: (patch: Partial<KeyboardSettings>) => void;
  onBack: () => void;
  isLightApp: boolean;
}

export const KeyboardPrefsScreen: React.FC<KeyboardPrefsScreenProps> = ({
  settings,
  onUpdate,
  onBack,
  isLightApp,
}) => {
  const [editingMetric, setEditingMetric] = useState<'font' | 'icon' | 'spacing' | null>(null);

  const cardBg = isLightApp
    ? 'bg-white border-slate-200 text-slate-900'
    : 'bg-[#17181B] border-white/[0.06] text-white';

  const cycleNumberStyle = () => {
    const idx = NUMBER_STYLE_OPTIONS.findIndex((o) => o.id === settings.numberStyle);
    const next = NUMBER_STYLE_OPTIONS[(idx + 1) % NUMBER_STYLE_OPTIONS.length];
    onUpdate({ numberStyle: next.id });
  };

  return (
    <div className="min-h-full flex flex-col pb-24" dir="rtl">
      <SubPageHeader title="قیاسی فۆنت، مەودا و ئامرازەکان" onBack={onBack} isLightApp={isLightApp} />

      <div className="px-4 pt-3 space-y-4">
        <NotificationBanner
          enabled={settings.notificationsEnabled}
          onEnable={() => onUpdate({ notificationsEnabled: true })}
        />

        {/* 2x2 Metric Cards */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setEditingMetric(editingMetric === 'font' ? null : 'font')}
            className={`rounded-3xl p-4 border text-right space-y-1.5 transition-colors ${cardBg} ${
              editingMetric === 'font' ? 'border-sky-400' : ''
            }`}
          >
            <Type className="w-6 h-6 text-[#8EC2FF]" />
            <div className="text-sm font-bold">قیاسی فۆنت</div>
            <div className="text-xs text-zinc-400 font-mono tabular-nums" dir="ltr">
              {settings.fontSizePercent}% / {settings.fontSizePercent}%
            </div>
          </button>

          <button
            type="button"
            onClick={() => setEditingMetric(editingMetric === 'icon' ? null : 'icon')}
            className={`rounded-3xl p-4 border text-right space-y-1.5 transition-colors ${cardBg} ${
              editingMetric === 'icon' ? 'border-sky-400' : ''
            }`}
          >
            <LayoutGrid className="w-6 h-6 text-[#8EC2FF]" />
            <div className="text-sm font-bold">قەبارەی ئایکۆنەکان</div>
            <div className="text-xs text-zinc-400 font-mono tabular-nums" dir="ltr">
              {settings.iconSizePercent}% / {settings.iconSizePercent}%
            </div>
          </button>

          <button
            type="button"
            onClick={() => setEditingMetric(editingMetric === 'spacing' ? null : 'spacing')}
            className={`rounded-3xl p-4 border text-right space-y-1.5 relative transition-colors ${cardBg} ${
              editingMetric === 'spacing' ? 'border-sky-400' : ''
            }`}
          >
            <div className="absolute top-3 left-3">
              <ProBadge unlocked={settings.proUnlocked} />
            </div>
            <MoveVertical className="w-6 h-6 text-[#8EC2FF]" />
            <div className="text-sm font-bold">مەودای نێوان دوگمەکان</div>
            <div className="text-xs text-zinc-400 font-mono tabular-nums" dir="ltr">
              {settings.keySpacingHorizontal ?? settings.keySpacingPercent}% /{' '}
              {settings.keySpacingVertical ?? settings.keySpacingPercent}%
            </div>
          </button>

          <button
            type="button"
            onClick={cycleNumberStyle}
            className={`rounded-3xl p-4 border text-right space-y-1.5 transition-colors ${cardBg}`}
          >
            <Hash className="w-6 h-6 text-[#8EC2FF]" />
            <div className="text-sm font-bold">لیستی ژمارەکان</div>
            <div className="text-xs text-zinc-400">
              {NUMBER_STYLE_OPTIONS.find((n) => n.id === settings.numberStyle)?.labelKu ||
                'لاتینی (123)'}
            </div>
          </button>
        </div>

        {/* Inline Live Metric Slider (supports independent Horizontal & Vertical key spacing!) */}
        {editingMetric && (
          <div className={`rounded-2xl p-4 border space-y-3 ${cardBg}`}>
            {editingMetric === 'spacing' ? (
              <>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold">
                    <span>مەودای ئاسۆیی نێوان دوگمەکان</span>
                    <span className="font-mono text-sky-400 tabular-nums">
                      {settings.keySpacingHorizontal ?? settings.keySpacingPercent}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={50}
                    max={160}
                    value={settings.keySpacingHorizontal ?? settings.keySpacingPercent}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      onUpdate({ keySpacingHorizontal: v, keySpacingPercent: v });
                    }}
                    className="w-full accent-sky-400"
                  />
                </div>
                <div className="space-y-1.5 pt-2 border-t border-white/5">
                  <div className="flex justify-between text-xs font-bold">
                    <span>مەودای ستوونی نێوان ڕیزەکان</span>
                    <span className="font-mono text-sky-400 tabular-nums">
                      {settings.keySpacingVertical ?? settings.keySpacingPercent}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={50}
                    max={160}
                    value={settings.keySpacingVertical ?? settings.keySpacingPercent}
                    onChange={(e) => onUpdate({ keySpacingVertical: Number(e.target.value) })}
                    className="w-full accent-sky-400"
                  />
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold">
                  <span>
                    {editingMetric === 'font' ? 'قیاسی فۆنت' : 'قەبارەی ئایکۆنەکان'}
                  </span>
                  <span className="font-mono text-sky-400 tabular-nums">
                    {editingMetric === 'font'
                      ? settings.fontSizePercent
                      : settings.iconSizePercent}
                    %
                  </span>
                </div>
                <input
                  type="range"
                  min={80}
                  max={160}
                  value={
                    editingMetric === 'font'
                      ? settings.fontSizePercent
                      : settings.iconSizePercent
                  }
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (editingMetric === 'font') onUpdate({ fontSizePercent: v });
                    else onUpdate({ iconSizePercent: v });
                  }}
                  className="w-full accent-sky-400"
                />
              </div>
            )}
          </div>
        )}

        {/* Long-Press Delay & Number Row Mode (from original KurdiKeyboard keyboard prefs) */}
        <div className={`rounded-3xl p-4 border space-y-4 ${cardBg}`}>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#8EC2FF]" />
                ماوەی دەستڕاگرتن لەسەر پیتەکان
              </span>
              <span className="font-mono text-sky-400 tabular-nums" dir="ltr">
                {settings.longPressDelayMs || 300} ms
              </span>
            </div>
            <input
              type="range"
              min={150}
              max={600}
              step={10}
              value={settings.longPressDelayMs || 300}
              onChange={(e) => onUpdate({ longPressDelayMs: Number(e.target.value) })}
              className="w-full accent-sky-400"
            />
            <div className="flex justify-between text-[10px] text-zinc-400">
              <span>خێرا (150ms)</span>
              <span>ئاسایی (300ms)</span>
              <span>هێواش (600ms)</span>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-white/5">
            <div className="text-xs font-bold">ڕیزی ژمارەکانی سەرەوە</div>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { id: 'per_language' as NumberRowMode, label: 'بەپێی زمان' },
                  { id: 'always' as NumberRowMode, label: 'هەمیشە هەبێت' },
                  { id: 'never' as NumberRowMode, label: 'شاراوە بێت' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onUpdate({ numberRowMode: opt.id })}
                  className={`h-9 rounded-xl text-[11px] font-bold border transition-colors ${
                    (settings.numberRowMode || 'per_language') === opt.id
                      ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                      : 'border-white/10 text-zinc-400 hover:bg-white/5'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-white/5">
            <div className="text-xs font-bold">شێوازی قفڵکردنی پیتی گەورە (Caps Lock)</div>
            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  { id: 'capslock_by_double_tap' as CapitalizationBehavior, label: 'دوو جار داگرتن' },
                  { id: 'capslock_by_cycle' as CapitalizationBehavior, label: 'گۆڕینی یەکبەدوایەک' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onUpdate({ capitalizationBehavior: opt.id })}
                  className={`h-9 rounded-xl text-[11px] font-bold border transition-colors ${
                    (settings.capitalizationBehavior || 'capslock_by_double_tap') === opt.id
                      ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                      : 'border-white/10 text-zinc-400 hover:bg-white/5'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Row Preset Selector (All official bottom_row_* JSON presets!) */}
        <div className={`rounded-3xl p-4 border space-y-3 ${cardBg}`}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold">شێوازی ڕیزی خوارەوە</span>
            <span className="text-[11px] text-sky-400 font-semibold">
              {BOTTOM_ROW_PRESETS.find((p) => p.id === settings.bottomRowPreset)?.labelKu}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {BOTTOM_ROW_PRESETS.map((preset) => {
              const active = settings.bottomRowPreset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onUpdate({ bottomRowPreset: preset.id })}
                  className={`px-3 py-2 rounded-xl text-right border transition-colors ${
                    active
                      ? 'bg-sky-500/20 border-sky-400 text-sky-300 font-bold'
                      : 'border-white/10 text-zinc-300 hover:bg-white/5'
                  }`}
                >
                  <div className="text-xs truncate">{preset.labelKu}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* All Visual & Bottom Key Toggles */}
        <div className="space-y-4 pt-2">
          {[
            {
              title: 'کاریگەری جوڵان',
              sub: 'پیشاندانی ئەنیمەیشنی جوڵەی پیتەکان لەکاتی نووسیندا',
              pro: true,
              val: settings.keyAnimation,
              set: (v: boolean) => onUpdate({ keyAnimation: v }),
              icon: Sparkles,
            },
            {
              title: 'ڕەنگی داینامیکی پاشبنەما',
              sub: 'گۆڕینی ڕەنگی پشتەوە بە خۆکاری لەکاتی دەستلێدان',
              pro: true,
              val: settings.dynamicBackgroundGlow,
              set: (v: boolean) => onUpdate({ dynamicBackgroundGlow: v }),
              icon: Layers,
            },
            {
              title: 'بچووککراوەی پیت',
              sub: 'پیشاندانی بچووککراوەی پیت لەکاتی نووسین',
              val: settings.keyPopupPreview,
              set: (v: boolean) => onUpdate({ keyPopupPreview: v }),
              icon: Type,
            },
            {
              title: 'پیتە لاوەکییەکانی خانەی دووەم',
              sub: 'نیشاندانی پیتە لاوەکییەکان وەک (ص، ض، ث، ذ) لەسەر پیتە سەرەکییەکان',
              val: settings.showSecondaryHints,
              set: (v: boolean) => onUpdate({ showSecondaryHints: v }),
              icon: KeyboardIcon,
            },
            {
              title: 'دوگمەکانی خوارەوە',
              sub: 'پیشاندان/شاردنەوەی دوگمە بنەڕەتیەکانی بەشی خوارەوە',
              val: settings.showBottomKeys,
              set: (v: boolean) => onUpdate({ showBottomKeys: v }),
              icon: KeyboardIcon,
            },
            {
              title: 'دوگمەی زمان',
              sub: 'نیشاندانی دوگمەی گۆڕینی زمان لە ڕیزی خوارەوە',
              val: settings.showGlobeKey,
              set: (v: boolean) => onUpdate({ showGlobeKey: v }),
              icon: Globe,
            },
            {
              title: 'پیشاندانی لیستی زمانەکان',
              sub: 'پیشاندانی لیستێکی خێرا بۆ زمانەکان لەکاتی دەستڕاگرتن لەسەر دوگمەی گۆڕینی زمان',
              val: settings.showLanguagePickerOnLongPress,
              set: (v: boolean) => onUpdate({ showLanguagePickerOnLongPress: v }),
              icon: List,
            },
            {
              title: 'دوگمەی خەندە',
              sub: 'نیشاندانی دوگمەی ئیمۆجی و زیکر لە خوارەوە',
              val: settings.showEmojiKey,
              set: (v: boolean) => onUpdate({ showEmojiKey: v }),
              icon: Smile,
            },
            {
              title: 'دوگمەی فاریزە',
              sub: 'نیشاندانی دوگمەی فاریزە لە تەنیشت دوگمەی بۆشایی',
              val: settings.showCommaKey,
              set: (v: boolean) => onUpdate({ showCommaKey: v }),
              icon: Type,
            },
            {
              title: 'پێچەوانەکردنی دوگمەکان',
              sub: 'شوێنی دوگمەی زمان و ئیمۆجی پێچەوانە دەکرێتەوە',
              val: settings.swapGlobeAndEmoji,
              set: (v: boolean) => onUpdate({ swapGlobeAndEmoji: v }),
              icon: ArrowLeftRight,
            },
            {
              title: 'شریتی ئامرازەکانی سەرەوە',
              sub: 'پیشاندانی شریتی کۆپی، لکاندن و جووڵاندنی کێرسەر لە سەرەوەی کیبۆرد',
              val: settings.showTopToolbar,
              set: (v: boolean) => onUpdate({ showTopToolbar: v }),
              icon: LayoutGrid,
            },
            {
              title: 'گەڕانەوە بۆ پیتەکان بە دوگمەی بۆشایی',
              sub: 'دوای داگرتنی بۆشایی لە بەشی هێماکاندا خۆکارانە دەگەڕێتەوە سەر پیتەکان',
              val: settings.spaceBarSwitchesToCharacters !== false,
              set: (v: boolean) => onUpdate({ spaceBarSwitchesToCharacters: v }),
              icon: KeyboardIcon,
            },
            {
              title: 'پیتی گەورەی خۆکار (Auto-Cap)',
              sub: 'یەکەم پیتی هەر ڕستەیەک لە زمانە لاتینییەکاندا خۆکارانە گەورە دەکات',
              val: settings.autoCapitalization !== false,
              set: (v: boolean) => onUpdate({ autoCapitalization: v }),
              icon: Type,
            },
            {
              title: 'بۆشایی خۆکار دوای خاڵبەندی',
              sub: 'دانانی بۆشایی خۆکار دوای نووسینی (، . ؟ !)',
              val: Boolean(settings.autoSpacePunctuation),
              set: (v: boolean) => onUpdate({ autoSpacePunctuation: v }),
              icon: Sparkles,
            },
            {
              title: 'فڕینی پیتەکان لەکاتی نووسین',
              sub: 'کاریگەری بەرزبوونەوەی پیت بە شێوەیەکی جوان لەکاتی دەستلێدان',
              val: Boolean(settings.flyingLettersEnabled),
              set: (v: boolean) => onUpdate({ flyingLettersEnabled: v }),
              icon: Sparkles,
            },
          ].map((row) => {
            const Icon = row.icon;
            return (
              <div key={row.title} className="flex items-center justify-between gap-3 py-1">
                <div className="flex items-start gap-3 flex-1">
                  <Icon className="w-5 h-5 text-zinc-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-sm font-bold flex items-center gap-2">
                      <span>{row.title}</span>
                      {row.pro && <ProBadge unlocked={settings.proUnlocked} />}
                    </div>
                    <div className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{row.sub}</div>
                  </div>
                </div>
                <AppToggle checked={row.val} onChange={row.set} label={row.title} />
              </div>
            );
          })}

          {settings.flyingLettersEnabled && (
            <div className={`rounded-2xl p-4 border space-y-2 ${cardBg}`}>
              <div className="flex items-center justify-between text-xs font-bold">
                <span>قەبارەی پیتە فڕیوەکان</span>
                <span className="font-mono text-sky-400 tabular-nums">
                  {settings.flyingLettersSizeMultiplier || 90}%
                </span>
              </div>
              <input
                type="range"
                min={60}
                max={140}
                step={5}
                value={settings.flyingLettersSizeMultiplier || 90}
                onChange={(e) => onUpdate({ flyingLettersSizeMultiplier: Number(e.target.value) })}
                className="w-full accent-sky-400"
              />
            </div>
          )}

          {/* Spacebar Label Setting */}
          <div className={`rounded-2xl p-4 border space-y-2.5 ${cardBg}`}>
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold">ناوی سەر دوگمەی بۆشایی</div>
              <ProBadge unlocked={settings.proUnlocked} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'language', label: 'ناوی زمان' },
                  { id: 'none', label: 'بێ ناو' },
                  { id: 'custom', label: 'ناوی تایبەت' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onUpdate({ spacebarLabelMode: opt.id })}
                  className={`h-9 rounded-xl text-xs font-bold border transition-colors ${
                    settings.spacebarLabelMode === opt.id
                      ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                      : 'border-white/10 text-zinc-400 hover:bg-white/5'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {settings.spacebarLabelMode === 'custom' && (
              <input
                type="text"
                value={settings.customSpacebarText}
                onChange={(e) => onUpdate({ customSpacebarText: e.target.value })}
                placeholder="ناوی سەر دوگمەی بۆشایی بنووسە..."
                className="w-full h-10 rounded-xl px-3 text-xs bg-black/40 border border-white/10 text-white outline-none focus:border-sky-400"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface EmojiSettingsScreenProps {
  settings: KeyboardSettings;
  onUpdate: (patch: Partial<KeyboardSettings>) => void;
  onBack: () => void;
  isLightApp: boolean;
}

const EMOJI_STYLES: { id: EmojiStyleMode; label: string; desc: string }[] = [
  { id: 'facebook', label: 'فەیسبووک / مەسنجەر', desc: 'شێوازی فەرمی مەسنجەر' },
  { id: 'system', label: 'فۆنتی سیستەم', desc: 'بنەڕەتی مۆبایل' },
  { id: 'twemoji', label: 'تەخت و ڕوون', desc: 'ڕەنگی زیندوو و سووک' },
  { id: 'rounded', label: 'نەرم و خڕ', desc: 'سێبەری سووک' },
  { id: 'classic', label: 'کلاسیک', desc: 'گەرم و کلاسیکی' },
];

const HISTORY_STRATEGIES: { id: EmojiHistoryUpdateStrategy; label: string }[] = [
  { id: 'auto_prepend', label: 'خۆکار (سەرەتا)' },
  { id: 'auto_append', label: 'خۆکار (کۆتایی)' },
  { id: 'manual_prepend', label: 'دەستی (سەرەتا)' },
  { id: 'manual_append', label: 'دەستی (کۆتایی)' },
];

export const EmojiSettingsScreen: React.FC<EmojiSettingsScreenProps> = ({
  settings,
  onUpdate,
  onBack,
  isLightApp,
}) => {
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [clearedToast, setClearedToast] = useState(false);

  const cardBg = isLightApp
    ? 'bg-white border-slate-200 text-slate-900'
    : 'bg-[#17181B] border-white/[0.06] text-white';

  const subtleBtn = isLightApp
    ? 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
    : 'bg-white/[0.04] border-white/10 text-zinc-300 hover:bg-white/[0.08]';

  const activeBtn = isLightApp
    ? 'bg-sky-100 border-sky-400 text-sky-900 font-bold'
    : 'bg-sky-500/20 border-sky-400 text-sky-200 font-bold';

  const emojiFontClass = `emoji-style-${settings.emojiStyle || 'system'}`;
  const personPreview = composePersonEmoji('🧑', settings.emojiSkinTone, settings.emojiHairStyle);
  const handPreview = settings.emojiSkinTone ? `👋${settings.emojiSkinTone}` : '👋';

  const orderedCategories = useMemo(() => {
    const order = settings.emojiCategoryOrder || [];
    const byId = new Map(EMOJI_CATEGORIES.map((c) => [c.id, c]));
    const list = [];
    for (const id of order) {
      const cat = byId.get(id);
      if (cat) {
        list.push(cat);
        byId.delete(id);
      }
    }
    for (const cat of byId.values()) list.push(cat);
    return list;
  }, [settings.emojiCategoryOrder]);

  const disabledSet = useMemo(
    () => new Set(settings.emojiDisabledCategories || []),
    [settings.emojiDisabledCategories]
  );

  const moveCategory = (index: number, delta: -1 | 1) => {
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= orderedCategories.length) return;
    const ids = orderedCategories.map((c) => c.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(nextIndex, 0, moved);
    onUpdate({ emojiCategoryOrder: ids });
  };

  const toggleCategoryEnabled = (id: string) => {
    const next = new Set(disabledSet);
    if (next.has(id)) {
      next.delete(id);
    } else {
      // Always keep at least 1 category enabled
      if (orderedCategories.length - next.size <= 1) return;
      next.add(id);
    }
    onUpdate({ emojiDisabledCategories: Array.from(next) });
  };

  const resetCategories = () => {
    onUpdate({
      emojiCategoryOrder: EMOJI_CATEGORIES.map((c) => c.id),
      emojiDisabledCategories: [],
    });
  };

  const clearRecentHistory = () => {
    const zh = settings.zikrHistories || {
      duaa: { pinned: [], recent: [] },
      quran: { pinned: [], recent: [] },
      salawat: { pinned: [], recent: [] },
    };
    onUpdate({
      recentEmojis: [],
      recentKaomoji: [],
      recentZikr: [...zh.duaa.pinned, ...zh.quran.pinned, ...zh.salawat.pinned],
      zikrHistories: {
        duaa: { pinned: zh.duaa.pinned, recent: [] },
        quran: { pinned: zh.quran.pinned, recent: [] },
        salawat: { pinned: zh.salawat.pinned, recent: [] },
      },
    });
    setClearedToast(true);
    window.setTimeout(() => setClearedToast(false), 2200);
  };

  return (
    <div className="min-h-full flex flex-col pb-24" dir="rtl">
      <SubPageHeader
        title="ڕێکخستنەکانی ئیمۆجی، زیکر و کاومۆجی"
        onBack={onBack}
        isLightApp={isLightApp}
      />

      <div className="px-4 pt-3 space-y-4">
        <NotificationBanner
          enabled={settings.notificationsEnabled}
          onEnable={() => onUpdate({ notificationsEnabled: true })}
        />

        {/* Live Preview Card */}
        <div className={`rounded-3xl p-5 border text-center space-y-3 ${cardBg}`}>
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-[#9AC5FF]">پێشبینینی ڕاستەوخۆ</span>
            <span className="text-zinc-400 tabular-nums">
              {EMOJI_STYLES.find((s) => s.id === settings.emojiStyle)?.label || 'فۆنتی سیستەم'} ·{' '}
              {settings.emojiFontSizePx || 24}px
            </span>
          </div>
          <div className="grid grid-cols-6 gap-2 items-center justify-items-center py-1">
            {['😍', '😂', personPreview, handPreview, '🥹', '🔥'].map((sampleEm, idx) => (
              <EmojiGlyph
                key={`prev_${idx}_${settings.emojiStyle}`}
                emoji={sampleEm}
                styleMode={settings.emojiStyle}
                sizePx={Math.max(18, Math.min(36, settings.emojiFontSizePx || 24))}
              />
            ))}
          </div>
          <div
            className={`pt-2 border-t text-center leading-relaxed ${
              isLightApp ? 'border-slate-200 text-slate-700' : 'border-white/10 text-zinc-300'
            }`}
            style={{ fontSize: `${Math.max(10, Math.min(18, settings.zikrFontSizePx || 12))}px` }}
          >
            بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ · ¯\_(ツ)_/¯
          </div>
        </div>

        {/* Emoji Style Switcher (Includes Real Facebook / Messenger Style) */}
        <div className={`rounded-3xl p-4 border space-y-3 ${cardBg}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Smile className="w-4 h-4 text-[#8EC2FF]" />
              <span className="text-sm font-bold">شێوازی ئیمۆجی (مەسنجەر، سیستەم و زیاتر)</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {EMOJI_STYLES.map((st, idx) => {
              const active =
                settings.emojiStyle === st.id ||
                (st.id === 'twemoji' && settings.emojiStyle === 'minimal');
              const isFacebook = st.id === 'facebook';
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => onUpdate({ emojiStyle: st.id })}
                  className={`min-h-[54px] px-3 py-2 rounded-2xl border text-right transition-all flex items-center justify-between gap-2 ${
                    idx === 0 ? 'col-span-2' : ''
                  } ${
                    active
                      ? isFacebook
                        ? 'bg-[#0084FF]/20 border-[#0084FF] text-[#8EC2FF] font-bold'
                        : activeBtn
                      : subtleBtn
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate">{st.label}</div>
                    <div className="text-[10.5px] opacity-75 truncate mt-0.5">{st.desc}</div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {isFacebook ? (
                      <>
                        <EmojiGlyph emoji="😍" styleMode="facebook" sizePx={22} />
                        <EmojiGlyph emoji="😂" styleMode="facebook" sizePx={22} />
                        <EmojiGlyph emoji="❤️" styleMode="facebook" sizePx={22} />
                      </>
                    ) : (
                      <EmojiGlyph emoji="😍" styleMode={st.id} sizePx={22} />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Independent Emoji & Zikr Font Sizes + Grid Columns */}
        <div className={`rounded-3xl p-4 border space-y-4 ${cardBg}`}>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold">
              <span>قەبارەی ئیمۆجییەکان</span>
              <span className="text-[#9AC5FF] font-mono tabular-nums">
                {settings.emojiFontSizePx || 24} px
              </span>
            </div>
            <input
              type="range"
              min={18}
              max={36}
              step={1}
              value={settings.emojiFontSizePx || 24}
              onChange={(e) => onUpdate({ emojiFontSizePx: Number(e.target.value) })}
              className="w-full accent-[#A4C9FF] cursor-pointer"
            />
          </div>

          <div className="space-y-2 pt-2 border-t border-white/5">
            <div className="flex items-center justify-between text-xs font-bold">
              <span>قەبارەی دەقی زیکر و کاومۆجی</span>
              <span className="text-[#9AC5FF] font-mono tabular-nums">
                {settings.zikrFontSizePx || 12} px
              </span>
            </div>
            <input
              type="range"
              min={10}
              max={18}
              step={1}
              value={settings.zikrFontSizePx || 12}
              onChange={(e) => onUpdate({ zikrFontSizePx: Number(e.target.value) })}
              className="w-full accent-[#A4C9FF] cursor-pointer"
            />
          </div>

          <div className="space-y-2 pt-2 border-t border-white/5">
            <div className="flex items-center justify-between text-xs font-bold">
              <span>ژمارەی ئیمۆجی لە هەر ڕیزێکدا</span>
              <span className="text-[#9AC5FF] font-mono tabular-nums">
                {settings.emojiColumns} ستوون
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[6, 7, 8, 9].map((cols) => (
                <button
                  key={cols}
                  type="button"
                  onClick={() => onUpdate({ emojiColumns: cols })}
                  className={`h-10 rounded-xl border text-xs font-bold tabular-nums transition-colors ${
                    settings.emojiColumns === cols ? activeBtn : subtleBtn
                  }`}
                >
                  {cols}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Skin Tone & Hair Style Pickers */}
        <div className={`rounded-3xl p-4 border space-y-4 ${cardBg}`}>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold">ڕەنگی پێستی خەندەکان</span>
              <span className="text-xs text-zinc-400">
                {EMOJI_SKIN_TONES.find((t) => t.mod === settings.emojiSkinTone)?.label || 'بنەڕەتی'}
              </span>
            </div>
            <div className="grid grid-cols-6 gap-1.5">
              {EMOJI_SKIN_TONES.map((tone) => {
                const active = settings.emojiSkinTone === tone.mod;
                return (
                  <button
                    key={tone.id}
                    type="button"
                    onClick={() => onUpdate({ emojiSkinTone: tone.mod })}
                    className={`h-11 rounded-2xl flex items-center justify-center border transition-all ${
                      active
                        ? 'border-[#9AC5FF] bg-sky-500/20 scale-105'
                        : 'border-white/5 hover:bg-white/5'
                    }`}
                    title={tone.label}
                  >
                    <EmojiGlyph emoji={tone.sample} styleMode={settings.emojiStyle} sizePx={24} />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2.5 pt-3 border-t border-white/5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold">شێوازی قژ</span>
              <span className="text-xs text-zinc-400">
                {EMOJI_HAIR_STYLES.find((h) => h.mod === (settings.emojiHairStyle || ''))?.label ||
                  'بنەڕەتی'}
              </span>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {EMOJI_HAIR_STYLES.map((hair) => {
                const active = (settings.emojiHairStyle || '') === hair.mod;
                const sample = composePersonEmoji('🧑', settings.emojiSkinTone, hair.mod);
                return (
                  <button
                    key={hair.id}
                    type="button"
                    onClick={() => onUpdate({ emojiHairStyle: hair.mod })}
                    className={`min-h-[56px] px-1 py-1.5 rounded-2xl flex flex-col items-center justify-center gap-1 border transition-all ${
                      active
                        ? 'border-[#9AC5FF] bg-sky-500/20'
                        : 'border-white/5 hover:bg-white/5'
                    }`}
                    title={hair.label}
                  >
                    <EmojiGlyph emoji={sample} styleMode={settings.emojiStyle} sizePx={24} />
                    <span className="text-[10px] text-zinc-400 truncate max-w-full">
                      {hair.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Category Reorder & Enable/Disable Manager */}
        <div className={`rounded-3xl border overflow-hidden ${cardBg}`}>
          <button
            type="button"
            onClick={() => setShowCategoryManager((v) => !v)}
            className="w-full p-4 flex items-center justify-between text-right"
          >
            <div className="flex items-center gap-3">
              <LayoutGrid className="w-5 h-5 text-[#8EC2FF] shrink-0" />
              <div>
                <div className="text-sm font-bold">ڕیزکردن و شاردنەوەی پۆلەکانی ئیمۆجی</div>
                <div className="text-xs text-zinc-400 mt-0.5">
                  {orderedCategories.length - disabledSet.size} پۆل چالاکە لە{' '}
                  {orderedCategories.length} پۆل
                </div>
              </div>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-zinc-400 transition-transform ${
                showCategoryManager ? 'rotate-180 text-[#9AC5FF]' : ''
              }`}
            />
          </button>

          {showCategoryManager && (
            <div className="px-4 pb-4 space-y-2 border-t border-white/5 pt-3">
              {orderedCategories.map((cat, idx) => {
                const isDisabled = disabledSet.has(cat.id);
                return (
                  <div
                    key={cat.id}
                    className={`flex items-center justify-between gap-2 px-3 py-2 rounded-2xl border ${
                      isDisabled ? 'opacity-55' : ''
                    } ${isLightApp ? 'bg-slate-50 border-slate-200' : 'bg-white/[0.03] border-white/[0.07]'}`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <EmojiGlyph emoji={cat.icon} styleMode={settings.emojiStyle} sizePx={20} className="shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-bold truncate">{cat.label}</div>
                        <div className="text-[10px] text-zinc-400 tabular-nums">
                          {cat.items.length} ئیمۆجی
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveCategory(idx, -1)}
                        className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 flex items-center justify-center"
                        title="بردنە سەرەوە"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === orderedCategories.length - 1}
                        onClick={() => moveCategory(idx, 1)}
                        className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 flex items-center justify-center"
                        title="بردنە خوارەوە"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleCategoryEnabled(cat.id)}
                        className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                          isDisabled
                            ? 'bg-rose-500/15 text-rose-400'
                            : 'bg-sky-500/15 text-[#8EC2FF]'
                        }`}
                        title={isDisabled ? 'پیشاندانی پۆل' : 'شاردنەوەی پۆل'}
                      >
                        {isDisabled ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                );
              })}

              <button
                type="button"
                onClick={resetCategories}
                className={`w-full h-10 mt-1 rounded-2xl border text-xs font-bold flex items-center justify-center gap-1.5 ${subtleBtn}`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>گەڕاندنەوە بۆ ڕیزبەندی بنەڕەتی</span>
              </button>
            </div>
          )}
        </div>

        {/* History, Startup Tab & Sort Strategy Settings */}
        <div className={`rounded-3xl p-4 border space-y-4 ${cardBg}`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-bold">مێژووی ئیمۆجی، زیکر و کاومۆجی</div>
              <div className="text-xs text-zinc-400 mt-0.5">
                هەڵگرتنی دوایین بەکارهاتووەکان و پینکراوەکان بە جیا بۆ هەر بەشێک
              </div>
            </div>
            <AppToggle
              checked={settings.emojiHistoryEnabled}
              onChange={(v) => onUpdate({ emojiHistoryEnabled: v })}
              label="مێژووی ئیمۆجی"
            />
          </div>

          <div className="space-y-2 pt-2 border-t border-white/5">
            <div className="text-xs font-bold">تابی سەرەتایی لەکاتی کردنەوەی پانێڵی ئیمۆجی</div>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { id: 'recent' as EmojiInitialTabMode, label: 'دوایینەکان' },
                  { id: 'last_used' as EmojiInitialTabMode, label: 'دوایین پۆلی داخراو' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onUpdate({ emojiInitialTab: opt.id })}
                  className={`h-10 rounded-xl border text-xs font-bold transition-colors ${
                    (settings.emojiInitialTab || 'last_used') === opt.id ? activeBtn : subtleBtn
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-white/5">
            <div className="text-xs font-bold">شێوازی ڕیزکردنی مێژوو</div>
            <div className="grid grid-cols-2 gap-1.5">
              {HISTORY_STRATEGIES.map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => onUpdate({ emojiHistoryUpdateStrategy: st.id })}
                  className={`h-9 px-2 rounded-xl border text-xs transition-colors ${
                    (settings.emojiHistoryUpdateStrategy || 'auto_prepend') === st.id
                      ? activeBtn
                      : subtleBtn
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/5">
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold text-zinc-400">زۆرترین پینکراو</div>
              <div className="grid grid-cols-2 gap-1">
                {[12, 24, 36, 50].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => onUpdate({ emojiHistoryPinnedMaxSize: n })}
                    className={`h-8 rounded-lg border text-xs tabular-nums ${
                      (settings.emojiHistoryPinnedMaxSize || 24) === n ? activeBtn : subtleBtn
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="text-[11px] font-bold text-zinc-400">زۆرترین دوایینەکان</div>
              <div className="grid grid-cols-2 gap-1">
                {[20, 40, 60, 80].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => onUpdate({ emojiHistoryRecentMaxSize: n })}
                    className={`h-8 rounded-lg border text-xs tabular-nums ${
                      (settings.emojiHistoryRecentMaxSize || 40) === n ? activeBtn : subtleBtn
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={clearRecentHistory}
            className="w-full h-10 rounded-2xl border border-rose-500/25 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>
              {clearedToast
                ? 'مێژووی دوایینەکان پاککرایەوە (پینکراوەکان پارێزراون)'
                : 'پاککردنەوەی مێژووی دوایینەکان'}
            </span>
          </button>
        </div>

        {/* Emoji Suggestions Settings */}
        <div className={`rounded-3xl p-4 border space-y-4 ${cardBg}`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-bold flex items-center gap-2">
                <span>پێشنیارکردنی خەندەکان</span>
                <ProBadge unlocked={settings.proUnlocked} />
              </div>
              <div className="text-xs text-zinc-400 mt-0.5">
                پیشاندانی خەندەی گونجاو لە شریتی پێشنیارەکاندا لەکاتی نووسین
              </div>
            </div>
            <AppToggle
              checked={settings.emojiSuggestions}
              onChange={(v) => onUpdate({ emojiSuggestions: v })}
              label="پێشنیارکردنی خەندەکان"
            />
          </div>

          {settings.emojiSuggestions && (
            <div className="space-y-3 pt-2 border-t border-white/5">
              <div className="space-y-1.5">
                <div className="text-xs font-bold">شێوازی چالاکبوونی پێشنیار</div>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { id: 'inline_text' as EmojiSuggestionTypeMode, label: 'ڕاستەوخۆ لەناو دەق' },
                      { id: 'leading_colon' as EmojiSuggestionTypeMode, label: 'بە جووتخاڵ (:دڵ)' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onUpdate({ emojiSuggestionType: opt.id })}
                      className={`h-10 rounded-xl border text-xs font-bold transition-colors ${
                        (settings.emojiSuggestionType || 'inline_text') === opt.id
                          ? activeBtn
                          : subtleBtn
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <div className="text-[11px] font-bold text-zinc-400">کەمترین پیت بۆ گەڕان</div>
                  <div className="grid grid-cols-3 gap-1">
                    {[1, 2, 3].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => onUpdate({ emojiSuggestionQueryMinLength: n })}
                        className={`h-8 rounded-lg border text-xs tabular-nums ${
                          (settings.emojiSuggestionQueryMinLength || 2) === n
                            ? activeBtn
                            : subtleBtn
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="text-[11px] font-bold text-zinc-400">زۆرترین پێشنیار</div>
                  <div className="grid grid-cols-4 gap-1">
                    {[1, 2, 3, 4].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => onUpdate({ emojiSuggestionMaxCount: n })}
                        className={`h-8 rounded-lg border text-xs tabular-nums ${
                          (settings.emojiSuggestionMaxCount || 3) === n ? activeBtn : subtleBtn
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                <div>
                  <div className="text-xs font-bold">پیشاندانی ناوی ئیمۆجی</div>
                  <div className="text-[11px] text-zinc-400">ناوی کوردی/ئینگلیزی لە تەنیشت خەندە</div>
                </div>
                <AppToggle
                  checked={Boolean(settings.emojiSuggestionShowName)}
                  onChange={(v) => onUpdate({ emojiSuggestionShowName: v })}
                  label="پیشاندانی ناوی ئیمۆجی"
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold">نوێکردنەوەی مێژوو لە پێشنیار</div>
                  <div className="text-[11px] text-zinc-400">
                    زیادکردنی خەندە هەڵبژێردراوەکان بۆ دوایینەکان
                  </div>
                </div>
                <AppToggle
                  checked={settings.emojiSuggestionUpdateHistory !== false}
                  onChange={(v) => onUpdate({ emojiSuggestionUpdateHistory: v })}
                  label="نوێکردنەوەی مێژوو"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
