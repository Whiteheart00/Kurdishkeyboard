import React, { useState } from 'react';
import {
  ArrowLeftRight,
  Clock,
  Download,
  Globe,
  Hash,
  Keyboard as KeyboardIcon,
  Layers,
  LayoutGrid,
  List,
  MoveVertical,
  Smile,
  Sparkles,
  Type,
} from 'lucide-react';
import { EmojiStyleMode, KeyboardSettings } from '../../types/keyboard';
import { BOTTOM_ROW_PRESETS, NUMBER_STYLE_OPTIONS } from '../../data/layouts';
import { EMOJI_SKIN_TONES } from '../../data/richContent';
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
              {settings.keySpacingPercent}% / {settings.keySpacingPercent}%
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

        {/* Inline Live Metric Slider */}
        {editingMetric && (
          <div className={`rounded-2xl p-4 border space-y-2 ${cardBg}`}>
            <div className="flex justify-between text-xs font-bold">
              <span>
                {editingMetric === 'font'
                  ? 'قیاسی فۆنت'
                  : editingMetric === 'icon'
                  ? 'قەبارەی ئایکۆنەکان'
                  : 'مەودای نێوان دوگمەکان'}
              </span>
              <span className="font-mono text-sky-400 tabular-nums">
                {editingMetric === 'font'
                  ? settings.fontSizePercent
                  : editingMetric === 'icon'
                  ? settings.iconSizePercent
                  : settings.keySpacingPercent}
                %
              </span>
            </div>
            <input
              type="range"
              min={editingMetric === 'spacing' ? 50 : 80}
              max={160}
              value={
                editingMetric === 'font'
                  ? settings.fontSizePercent
                  : editingMetric === 'icon'
                  ? settings.iconSizePercent
                  : settings.keySpacingPercent
              }
              onChange={(e) => {
                const v = Number(e.target.value);
                if (editingMetric === 'font') onUpdate({ fontSizePercent: v });
                else if (editingMetric === 'icon') onUpdate({ iconSizePercent: v });
                else onUpdate({ keySpacingPercent: v });
              }}
              className="w-full accent-sky-400"
            />
          </div>
        )}

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

const EMOJI_STYLES: { id: EmojiStyleMode; label: string }[] = [
  { id: 'system', label: 'System' },
  { id: 'rounded', label: 'Rounded' },
  { id: 'minimal', label: 'Minimal' },
  { id: 'classic', label: 'Classic' },
];

export const EmojiSettingsScreen: React.FC<EmojiSettingsScreenProps> = ({
  settings,
  onUpdate,
  onBack,
  isLightApp,
}) => {
  const cardBg = isLightApp
    ? 'bg-white border-slate-200 text-slate-900'
    : 'bg-[#17181B] border-white/[0.06] text-white';

  const cycleStyle = () => {
    const idx = EMOJI_STYLES.findIndex((s) => s.id === settings.emojiStyle);
    const next = EMOJI_STYLES[(idx + 1) % EMOJI_STYLES.length];
    onUpdate({ emojiStyle: next.id });
  };

  return (
    <div className="min-h-full flex flex-col pb-24" dir="rtl">
      <SubPageHeader
        title="شێوەی خەندەکان، مێژووی پیشاندان و ڕەنگ"
        onBack={onBack}
        isLightApp={isLightApp}
      />

      <div className="px-4 pt-3 space-y-4">
        <NotificationBanner
          enabled={settings.notificationsEnabled}
          onEnable={() => onUpdate({ notificationsEnabled: true })}
        />

        {/* Emoji Live Preview Card matching Screenshot 26 */}
        <div className={`rounded-3xl p-5 border text-center space-y-3 ${cardBg}`}>
          <div className="text-xs font-bold text-[#9AC5FF]">نمونەی شێوەی ئیمۆجی ئێستا</div>
          <div className="grid grid-cols-3 gap-4 max-w-[200px] mx-auto text-4xl py-1">
            <span>😍</span>
            <span>🫠</span>
            <span>🥹</span>
            <span>🙄</span>
            <span>😂</span>
            <span>😳</span>
          </div>
        </div>

        {/* 2x2 Cards matching Screenshots 26 & 28 */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={cycleStyle}
            className={`rounded-3xl p-4 border text-right space-y-1.5 ${cardBg}`}
          >
            <Smile className="w-6 h-6 text-[#8EC2FF]" />
            <div className="text-sm font-bold">شێوەی ئیمۆجی</div>
            <div className="text-xs text-zinc-400">
              {EMOJI_STYLES.find((s) => s.id === settings.emojiStyle)?.label || 'System'}
            </div>
          </button>

          <button
            type="button"
            onClick={cycleStyle}
            className={`rounded-3xl p-4 border text-right space-y-1.5 ${cardBg}`}
          >
            <Download className="w-6 h-6 text-[#8EC2FF]" />
            <div className="text-sm font-bold">گۆڕینی شێوە</div>
            <div className="text-xs text-zinc-400">شێوازە بەردەستەکان</div>
          </button>

          <button
            type="button"
            onClick={() =>
              onUpdate({
                emojiColumns: settings.emojiColumns === 8 ? 6 : settings.emojiColumns + 1,
              })
            }
            className={`rounded-3xl p-4 border text-right space-y-1.5 relative ${cardBg}`}
          >
            <div className="absolute top-3 left-3">
              <ProBadge unlocked={settings.proUnlocked} />
            </div>
            <Clock className="w-6 h-6 text-[#8EC2FF]" />
            <div className="text-sm font-bold">ڕێژەی پیشاندان</div>
            <div className="text-xs text-zinc-400">{settings.emojiColumns} خەندە لە هەر ڕیزێکدا</div>
          </button>

          <button
            type="button"
            onClick={() => onUpdate({ recentEmojis: ['😂', '❤️', '🙏', '😍', '🔥', '🥹', '👋'] })}
            className={`rounded-3xl p-4 border text-right space-y-1.5 ${cardBg}`}
          >
            <LayoutGrid className="w-6 h-6 text-[#8EC2FF]" />
            <div className="text-sm font-bold">گۆڕینی شوێنی بەشەکان</div>
            <div className="text-xs text-zinc-400">ڕێکخستنی خەندە، زیکر و کاومۆجی</div>
          </button>
        </div>

        {/* Toggles matching Screenshot 28 */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-bold flex items-center gap-2">
                <span>پێشنیارکردنی خەندەکان</span>
                <ProBadge unlocked={settings.proUnlocked} />
              </div>
              <div className="text-xs text-zinc-400 mt-0.5">
                پیشاندانی خەندە و کاردانەوەکان لەکاتی نووسیندا
              </div>
            </div>
            <AppToggle
              checked={settings.emojiSuggestions}
              onChange={(v) => onUpdate({ emojiSuggestions: v })}
              label="پێشنیارکردنی خەندەکان"
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-bold">مێژووی ئیمۆجی</div>
              <div className="text-xs text-zinc-400 mt-0.5">
                هێشتنەوەی دوایین ئیمۆجییە بەکارهێندراوەکان بۆ ئاسانکاری
              </div>
            </div>
            <AppToggle
              checked={settings.emojiHistoryEnabled}
              onChange={(v) => onUpdate({ emojiHistoryEnabled: v })}
              label="مێژووی ئیمۆجی"
            />
          </div>

          {/* Skin Tone Selector matching Screenshot 28 bottom */}
          <div className={`rounded-3xl p-4 border space-y-3 ${cardBg}`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold">ڕەنگی خەندەکان</span>
              <span className="text-xs text-zinc-400">
                {EMOJI_SKIN_TONES.find((t) => t.mod === settings.emojiSkinTone)?.label || 'بنەڕەتی'}
              </span>
            </div>
            <div className="grid grid-cols-6 gap-2">
              {EMOJI_SKIN_TONES.map((tone) => {
                const active = settings.emojiSkinTone === tone.mod;
                return (
                  <button
                    key={tone.id}
                    type="button"
                    onClick={() => onUpdate({ emojiSkinTone: tone.mod })}
                    className={`h-11 rounded-2xl text-2xl flex items-center justify-center border transition-all ${
                      active
                        ? 'border-[#9AC5FF] bg-sky-500/20 scale-105'
                        : 'border-white/5 hover:bg-white/5'
                    }`}
                    title={tone.label}
                  >
                    {tone.sample}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
