import React, { useState } from 'react';
import { Check, ChevronDown, ChevronUp, Plus, Store } from 'lucide-react';
import { KeyboardSettings, KeyboardTheme, SettingsRoute } from '../../types/keyboard';
import { BUILTIN_THEMES, findThemeById, STORE_THEMES } from '../../data/themes';
import { getKeyShapeStyleProps, KEY_SHAPE_OPTIONS, tOfficial } from '../../data/officialData';
import { KurdiIcon } from '../icons/KurdiIcons';
import {
  MiniKeyboardPreview,
  NotificationBanner,
  ProBadge,
  SubPageHeader,
} from './SettingsUI';

interface ThemesScreenProps {
  settings: KeyboardSettings;
  onUpdate: (patch: Partial<KeyboardSettings>) => void;
  onNavigate: (route: SettingsRoute) => void;
  onBack: () => void;
  isLightApp: boolean;
}

const ACCENT_PRESETS = [
  '#2990FF',
  '#14F1D9',
  '#A855F7',
  '#10B981',
  '#F59E0B',
  '#EF4444',
];

export const ThemesScreen: React.FC<ThemesScreenProps> = ({
  settings,
  onUpdate,
  onNavigate,
  onBack,
  isLightApp,
}) => {
  const [showAllBuiltins, setShowAllBuiltins] = useState(false);
  const [showAccentPicker, setShowAccentPicker] = useState(false);

  const visibleBuiltins = showAllBuiltins ? BUILTIN_THEMES : BUILTIN_THEMES.slice(0, 6);
  const darkPreviewTheme = BUILTIN_THEMES.find((t) => t.id === 'rukar_futodark') || BUILTIN_THEMES[0];
  const lightPreviewTheme = BUILTIN_THEMES.find((t) => t.isLight) || BUILTIN_THEMES[1];
  const currentTheme = findThemeById(settings.activeThemeId, settings.customTheme);
  const lang = settings.appLanguage || 'ckb';

  const cycleThemeMode = () => {
    const order: KeyboardSettings['keyboardThemeMode'][] = ['dark', 'light', 'auto'];
    const next = order[(order.indexOf(settings.keyboardThemeMode) + 1) % order.length];
    const patch: Partial<KeyboardSettings> = { keyboardThemeMode: next };
    if (next === 'light') {
      patch.activeThemeId = lightPreviewTheme.id;
    } else if (next === 'dark') {
      patch.activeThemeId = 'amoled_cobalt';
    }
    onUpdate(patch);
  };

  return (
    <div className="min-h-full flex flex-col pb-24" dir="rtl">
      <SubPageHeader title="ڕووکار، ڕەنگ و دۆخەکان" onBack={onBack} isLightApp={isLightApp} />

      <div className="px-4 pt-3 space-y-4">
        <NotificationBanner
          enabled={settings.notificationsEnabled}
          onEnable={() => onUpdate({ notificationsEnabled: true })}
        />

        {/* Top 2 Navy Cards */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={cycleThemeMode}
            className={`rounded-3xl p-4 border flex flex-col items-center justify-center gap-2 text-center transition-colors ${
              isLightApp
                ? 'bg-sky-50 border-sky-200 text-slate-900'
                : 'bg-[#071D31] border-sky-400/20 text-white hover:bg-[#0A2640]'
            }`}
          >
            <KurdiIcon name="ic_mode" className="w-7 h-7 text-[#9AC5FF]" />
            <div className="text-sm font-bold">دۆخی ڕووکار</div>
            <div className="text-xs text-zinc-400">
              {settings.keyboardThemeMode === 'dark'
                ? 'هەمیشە تاریک'
                : settings.keyboardThemeMode === 'light'
                ? 'هەمیشە ڕووناک'
                : 'خۆکار'}
            </div>
          </button>

          <button
            type="button"
            onClick={() => setShowAccentPicker((v) => !v)}
            className={`rounded-3xl p-4 border flex flex-col items-center justify-center gap-2 text-center transition-colors ${
              isLightApp
                ? 'bg-sky-50 border-sky-200 text-slate-900'
                : 'bg-[#071D31] border-sky-400/20 text-white hover:bg-[#0A2640]'
            }`}
          >
            <KurdiIcon name="ic_colors" className="w-7 h-7 text-[#9AC5FF]" />
            <div className="text-sm font-bold">ڕەنگی بەرنامەکە</div>
            <span
              className="w-5 h-5 rounded-full border border-white/30"
              style={{ backgroundColor: settings.appAccentColor }}
            />
          </button>
        </div>

        {showAccentPicker && (
          <div className="rounded-2xl bg-[#14171D] border border-white/10 p-3.5 flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-zinc-300">ڕەنگی سەرەکی:</span>
            <div className="flex items-center gap-2">
              {ACCENT_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => onUpdate({ appAccentColor: c })}
                  className={`w-7 h-7 rounded-full border-2 transition-transform ${
                    settings.appAccentColor === c ? 'border-white scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Explore Modern Themes Store Banner */}
        <button
          type="button"
          onClick={() => onNavigate('theme_store')}
          className="w-full relative overflow-hidden rounded-3xl p-5 text-right bg-gradient-to-br from-[#0B112B] via-[#101C44] to-[#081226] border border-sky-400/25 shadow-xl group active:scale-[0.99] transition-transform"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-2.5 flex-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-sky-300">
                <Store className="w-4 h-4" />
                <span>فرۆشگای ڕووکارەکان</span>
              </div>
              <h3 className="text-xl font-extrabold text-white leading-tight">
                ڕووکارە مۆدێرنەکان ببینە
              </h3>
              <p className="text-xs text-sky-100/75 leading-relaxed">
                زیاتر لە ٢٠ ڕووکاری فەرمی تاریک، نیۆن، کریستاڵ و ڕووناک بۆ تەختەکلیلەکەت تاقیبکەرەوە
              </p>
              <div className="inline-flex items-center gap-2 h-9 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 text-white text-xs font-bold shadow-md">
                <KurdiIcon name="ic_download" className="w-3.5 h-3.5" />
                <span>داگرتنی ڕووکارەکان</span>
              </div>
            </div>

            <div className="w-28 shrink-0 hidden sm:block opacity-95 group-hover:scale-105 transition-transform">
              <MiniKeyboardPreview theme={STORE_THEMES[2] || STORE_THEMES[0]} />
            </div>
          </div>
        </button>

        {/* Official 9 Key Shape Styles Selector (Live Preview Grid) */}
        <div
          className={`rounded-3xl p-4 border space-y-3.5 ${
            isLightApp
              ? 'bg-white border-slate-200'
              : 'bg-[#121316] border-white/[0.06]'
          }`}
        >
          <div className="space-y-1 text-center">
            <div className="flex items-center justify-center gap-2 text-sm font-bold">
              <KurdiIcon name="ic_keyboard_keys" className="w-4 h-4 text-[#9AC5FF]" />
              <span>شێوازی دوگمەکان ({KEY_SHAPE_OPTIONS.length})</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              {tOfficial(
                lang,
                'spotlight__theme_key_shape_title',
                'لێرە دەتوانی ستایلی دوگمەکانی کیبۆردەکەت دیاری بکەیت (شوشەیی، نیۆن، سێ ڕەهەندی، هەمەڕەنگ..)'
              )}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {KEY_SHAPE_OPTIONS.map((opt) => {
              const active = (settings.keyShapeStyle || 'default') === opt.id;
              const bw = currentTheme.keyBorderWidth ?? (currentTheme.hasKeyBorder ? 1 : 0);
              const baseBorder = bw > 0 ? `${bw}px solid ${currentTheme.keyBorder}` : 'none';
              const previewProps = getKeyShapeStyleProps(
                opt.id,
                currentTheme,
                currentTheme.keyBg,
                baseBorder,
                currentTheme.keyShadow,
                false,
                false
              );
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onUpdate({ keyShapeStyle: opt.id })}
                  className={`relative rounded-2xl p-2 border-2 transition-all flex flex-col items-center gap-1.5 ${
                    active
                      ? 'border-[#9AC5FF] bg-sky-500/10 shadow-md shadow-sky-500/10'
                      : isLightApp
                      ? 'border-slate-200 hover:border-slate-300 bg-slate-50/70'
                      : 'border-white/[0.06] hover:border-white/20 bg-white/[0.02]'
                  }`}
                >
                  {opt.isPro && !settings.proUnlocked && (
                    <div className="absolute top-1 left-1">
                      <ProBadge unlocked={false} />
                    </div>
                  )}
                  <div
                    className="w-full rounded-xl p-1.5 flex items-center justify-center gap-1"
                    style={{ backgroundColor: currentTheme.bg }}
                    dir="rtl"
                  >
                    {['ک', 'و', 'ر'].map((ch) => (
                      <span
                        key={ch}
                        className={`flex-1 h-6 flex items-center justify-center text-[11px] font-bold ${previewProps.className}`}
                        style={{
                          ...previewProps.style,
                          color: currentTheme.keyText,
                        }}
                      >
                        {ch}
                      </span>
                    ))}
                  </div>
                  <span className="text-[10px] font-bold text-center leading-tight line-clamp-2">
                    {tOfficial(lang, opt.stringKey, opt.id)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Auto Split Preview Card */}
        <button
          type="button"
          onClick={() => onUpdate({ keyboardThemeMode: 'auto' })}
          className="w-full relative rounded-3xl overflow-hidden border border-white/10 grid grid-cols-2"
          dir="ltr"
        >
          <div className="p-2" style={{ backgroundColor: darkPreviewTheme.bg }}>
            <MiniKeyboardPreview theme={darkPreviewTheme} />
          </div>
          <div className="p-2" style={{ backgroundColor: lightPreviewTheme.bg }}>
            <MiniKeyboardPreview theme={lightPreviewTheme} />
          </div>
          <span className="absolute top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-[#094A82] text-white text-xs font-bold shadow-lg">
            خۆکار
          </span>
        </button>

        {/* Built-in Official Rukar Themes Container (All 21 themes!) */}
        <div
          className={`rounded-3xl p-4 border space-y-4 ${
            isLightApp
              ? 'bg-white border-slate-200'
              : 'bg-[#121316] border-white/[0.06]'
          }`}
        >
          <div className="flex items-center justify-center gap-2 text-sm font-bold">
            <KurdiIcon name="ic_themes" className="w-4 h-4 text-[#9AC5FF]" />
            <span>ڕووکارە فەرمییەکان ({BUILTIN_THEMES.length})</span>
          </div>

          {/* Create Custom Theme Card */}
          <button
            type="button"
            onClick={() => onNavigate('custom_theme')}
            className={`w-full h-24 rounded-2xl border relative flex flex-col items-center justify-center gap-2 transition-colors ${
              isLightApp
                ? 'bg-sky-50 border-sky-200 hover:bg-sky-100'
                : 'bg-[#102030] border-sky-400/20 hover:bg-[#14283D]'
            }`}
          >
            <div className="absolute top-2.5 left-2.5">
              <ProBadge unlocked={settings.proUnlocked} />
            </div>
            <span className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center text-white">
              <Plus className="w-5 h-5" />
            </span>
            <span className="text-xs font-bold text-zinc-200">دروستکردنی ڕووکاری تایبەت</span>
          </button>

          {/* 2-Column Official Rukar Theme Preview Grid */}
          <div className="grid grid-cols-2 gap-3">
            {visibleBuiltins.map((t) => {
              const selected = settings.activeThemeId === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onUpdate({ activeThemeId: t.id })}
                  className={`rounded-2xl p-1.5 transition-all border-2 flex flex-col gap-1.5 ${
                    selected
                      ? 'border-[#9AC5FF] shadow-lg shadow-sky-500/15 bg-sky-500/5'
                      : 'border-transparent hover:border-white/15'
                  }`}
                >
                  <MiniKeyboardPreview theme={t} selected={selected} />
                  <span className="text-[11px] font-bold text-center truncate w-full text-zinc-300">
                    {t.nameKu}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setShowAllBuiltins((v) => !v)}
            className="w-full py-2 flex items-center justify-center gap-1.5 text-xs font-bold text-[#9AC5FF] hover:text-white transition-colors"
          >
            <span>
              {showAllBuiltins
                ? 'کەمتر پیشان بدە'
                : `بینینی هەمووی (${BUILTIN_THEMES.length} ڕووکار)`}
            </span>
            {showAllBuiltins ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

interface ThemeStoreScreenProps {
  settings: KeyboardSettings;
  onUpdate: (patch: Partial<KeyboardSettings>) => void;
  onBack: () => void;
  isLightApp: boolean;
}

export const ThemeStoreScreen: React.FC<ThemeStoreScreenProps> = ({
  settings,
  onUpdate,
  onBack,
  isLightApp,
}) => {
  const handleDownloadAndApply = (theme: KeyboardTheme) => {
    const nextDownloaded = settings.downloadedThemeIds.includes(theme.id)
      ? settings.downloadedThemeIds
      : [...settings.downloadedThemeIds, theme.id];
    onUpdate({
      downloadedThemeIds: nextDownloaded,
      activeThemeId: theme.id,
    });
  };

  return (
    <div className="min-h-full flex flex-col pb-24" dir="rtl">
      <SubPageHeader title="داگرتنی ڕووکار" onBack={onBack} isLightApp={isLightApp} />

      <div className="px-4 pt-3 space-y-5">
        <NotificationBanner
          enabled={settings.notificationsEnabled}
          onEnable={() => onUpdate({ notificationsEnabled: true })}
        />

        <div className="flex items-center gap-2.5 text-base font-extrabold">
          <span className="w-9 h-9 rounded-full bg-[#161B26] text-[#9AC5FF] flex items-center justify-center">
            <Store className="w-4 h-4" />
          </span>
          <span>ڕووکارە بەردەستەکان</span>
        </div>

        {/* Full-width Store Theme Previews with Sky Blue Download Button matching Screenshots 31-39 */}
        <div className="space-y-6">
          {STORE_THEMES.map((t) => {
            const isDownloaded = settings.downloadedThemeIds.includes(t.id);
            const isActive = settings.activeThemeId === t.id;

            return (
              <div key={t.id} className="space-y-2.5">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold text-zinc-300">{t.nameKu}</span>
                  {isActive && (
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      چالاکە
                    </span>
                  )}
                </div>

                <div
                  className={`rounded-2xl overflow-hidden border-2 transition-colors ${
                    isActive ? 'border-[#9AC5FF]' : 'border-white/10'
                  }`}
                >
                  <MiniKeyboardPreview
                    theme={t}
                    detailed
                    showProCorner={Boolean(t.isPro)}
                    proUnlocked={settings.proUnlocked}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleDownloadAndApply(t)}
                  className={`w-full h-12 rounded-2xl text-sm font-extrabold flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
                    isActive
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-[#A4C9FF] hover:bg-[#B8D5FF] text-[#051B3A]'
                  }`}
                >
                  {isActive ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>بەکارهێنراوە</span>
                    </>
                  ) : isDownloaded ? (
                    <>
                      <KurdiIcon name="ic_smart" className="w-4 h-4" />
                      <span>بەکارهێنان</span>
                    </>
                  ) : (
                    <>
                      <KurdiIcon name="ic_download" className="w-4 h-4" />
                      <span>داگرتن</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

interface CustomThemeScreenProps {
  settings: KeyboardSettings;
  onUpdate: (patch: Partial<KeyboardSettings>) => void;
  onBack: () => void;
  isLightApp: boolean;
}

export const CustomThemeScreen: React.FC<CustomThemeScreenProps> = ({
  settings,
  onUpdate,
  onBack,
  isLightApp,
}) => {
  const ct = settings.customTheme;
  const updateCustom = (patch: Partial<KeyboardTheme>) => {
    const next = { ...ct, ...patch };
    onUpdate({ customTheme: next, activeThemeId: 'custom_user_theme' });
  };

  return (
    <div className="min-h-full flex flex-col pb-24" dir="rtl">
      <SubPageHeader title="دروستکردنی ڕووکاری تایبەت" onBack={onBack} isLightApp={isLightApp} />

      <div className="px-4 pt-4 space-y-5">
        <div className="rounded-2xl overflow-hidden border border-white/10">
          <MiniKeyboardPreview theme={ct} detailed />
        </div>

        <div className="rounded-3xl bg-[#14161A] border border-white/10 p-4 space-y-4">
          {[
            { label: 'ڕەنگی پاشبنەما', key: 'bg' as const, val: ct.bg },
            { label: 'ڕەنگی دوگمەکان', key: 'keyBg' as const, val: ct.keyBg },
            { label: 'ڕەنگی پیتەکان', key: 'keyText' as const, val: ct.keyText },
            { label: 'ڕەنگی لێواری دوگمە', key: 'keyBorder' as const, val: ct.keyBorder },
            { label: 'ڕەنگی دوگمەی ناردن (Enter)', key: 'enterBg' as const, val: ct.enterBg },
          ].map((row) => (
            <div key={row.key} className="flex items-center justify-between">
              <span className="text-sm font-bold text-white">{row.label}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-zinc-400">{row.val}</span>
                <input
                  type="color"
                  value={row.val}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (row.key === 'bg') {
                      updateCustom({ bg: value, toolbarBg: value });
                    } else if (row.key === 'keyBg') {
                      updateCustom({ keyBg: value, spaceBg: value });
                    } else if (row.key === 'enterBg') {
                      updateCustom({ enterBg: value, accent: value });
                    } else {
                      updateCustom({ [row.key]: value } as Partial<KeyboardTheme>);
                    }
                  }}
                  className="w-9 h-9 rounded-lg cursor-pointer bg-transparent border-0"
                />
              </div>
            </div>
          ))}

          <div className="pt-2 border-t border-white/5 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-300 font-bold">خڕبوونی گۆشەکان</span>
              <span className="font-mono text-sky-400">{ct.borderRadius}px</span>
            </div>
            <input
              type="range"
              min={4}
              max={18}
              value={ct.borderRadius}
              onChange={(e) => updateCustom({ borderRadius: Number(e.target.value) })}
              className="w-full accent-sky-400"
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-white/5">
            <span className="text-sm font-bold text-white">پیشاندانی لێواری دوگمەکان</span>
            <button
              type="button"
              onClick={() => updateCustom({ hasKeyBorder: !ct.hasKeyBorder })}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold ${
                ct.hasKeyBorder ? 'bg-sky-500 text-white' : 'bg-zinc-800 text-zinc-400'
              }`}
            >
              {ct.hasKeyBorder ? 'چالاکە' : 'ناچالاکە'}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            onUpdate({ activeThemeId: 'custom_user_theme' });
            onBack();
          }}
          className="w-full h-12 rounded-2xl bg-[#A4C9FF] text-[#051B3A] font-extrabold text-sm"
        >
          پاشەکەوت و جێبەجێکردن
        </button>
      </div>
    </div>
  );
};
