import React, { useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronLeft,
  Globe,
  Keyboard as KeyboardIcon,
  Languages,
  Link2,
  Loader2,
  Play,
  Plus,
  Server,
  ShieldCheck,
  Sparkles,
  Trash2,
  Type,
  X,
} from 'lucide-react';
import {
  KeyboardFontStyle,
  KeyboardSettings,
  LanguageConfig,
  SettingsRoute,
} from '../../types/keyboard';
import fontsMetaRaw from '../../data/generated/fontsMeta.json';
import {
  ALL_SUBTYPE_PRESETS,
  CHARACTER_LAYOUT_OPTIONS,
  getCharacterLayoutLabel,
} from '../../data/layouts';
import {
  AiHealthTestResult,
  getBuildTimeApiBaseUrl,
  normalizeAiServerUrl,
  resolveAiServer,
  testAiServerConnection,
} from '../../utils/aiServer';
import { AppToggle, NotificationBanner, SubPageHeader } from './SettingsUI';

interface FontMetaItem {
  id: KeyboardFontStyle;
  realName: string;
  labelKu: string;
}

const KURDI_REAL_FONTS = fontsMetaRaw as FontMetaItem[];

const FONT_STYLES: { id: KeyboardFontStyle; label: string; sample: string }[] = [
  ...KURDI_REAL_FONTS.map((f) => ({
    id: f.id,
    label: f.labelKu,
    sample: 'سڵاو کوردستان — بەخێربێن ١٢٣',
  })),
  { id: 'system', label: 'فۆنتی سیستەم (Vazirmatn)', sample: 'سڵاو کوردستان — بەخێربێن 123' },
  { id: 'naskh', label: 'فۆنتی نەسخ (Noto Naskh)', sample: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ' },
  { id: 'kufi', label: 'فۆنتی کوفی (Noto Kufi)', sample: 'تەختەکلیلی کوردی' },
];

interface LanguagesScreenProps {
  settings: KeyboardSettings;
  onUpdate: (patch: Partial<KeyboardSettings>) => void;
  onNavigate: (route: SettingsRoute) => void;
  onBack: () => void;
  isLightApp: boolean;
}

export const LanguagesScreen: React.FC<LanguagesScreenProps> = ({
  settings,
  onUpdate,
  onNavigate,
  onBack,
  isLightApp,
}) => {
  const [sheet, setSheet] = useState<
    'none' | 'translation' | 'font' | 'app_lang' | 'add_lang' | 'layout_picker'
  >('none');
  const [layoutPickerLangCode, setLayoutPickerLangCode] = useState<string>('ckb');

  const cardBg = isLightApp
    ? 'bg-white border-slate-200 text-slate-900'
    : 'bg-[#17181B] border-white/[0.06] text-white';

  const currentFontLabel =
    FONT_STYLES.find((f) => f.id === settings.fontStyle)?.label || 'فۆنتی KurdiKebord';

  const toggleLangNumberRow = (code: string, enabled: boolean) => {
    const next = settings.enabledLanguages.map((l) =>
      l.code === code ? { ...l, numberRow: enabled } : l
    );
    onUpdate({ enabledLanguages: next });
  };

  const changeLangLayout = (langCode: string, layoutId: string) => {
    const opt = CHARACTER_LAYOUT_OPTIONS.find((o) => o.id === layoutId);
    const next = settings.enabledLanguages.map((l) =>
      l.code === langCode
        ? {
            ...l,
            characterLayoutId: layoutId,
            subtitle: opt?.label || getCharacterLayoutLabel(layoutId),
            dir: opt?.direction || l.dir,
          }
        : l
    );
    onUpdate({ enabledLanguages: next, activeLanguage: langCode });
    setSheet('none');
  };

  const removeLanguage = (code: string) => {
    if (settings.enabledLanguages.length <= 1) return;
    const next = settings.enabledLanguages.filter((l) => l.code !== code);
    const nextActive =
      settings.activeLanguage === code ? next[0].code : settings.activeLanguage;
    onUpdate({ enabledLanguages: next, activeLanguage: nextActive });
  };

  const addLanguage = (lang: LanguageConfig) => {
    if (settings.enabledLanguages.some((l) => l.code === lang.code)) return;
    onUpdate({
      enabledLanguages: [...settings.enabledLanguages, lang],
      activeLanguage: lang.code,
    });
    setSheet('none');
  };

  const editingLang = settings.enabledLanguages.find((l) => l.code === layoutPickerLangCode);

  return (
    <div className="min-h-full flex flex-col relative pb-24" dir="rtl">
      <SubPageHeader title="زمان، فۆنت و ژیری دەسکرد" onBack={onBack} isLightApp={isLightApp} />

      <div className="px-4 pt-3 space-y-4">
        <NotificationBanner
          enabled={settings.notificationsEnabled}
          onEnable={() => onUpdate({ notificationsEnabled: true })}
        />

        {/* 2x2 Top Feature Cards */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setSheet('font')}
            className={`rounded-3xl p-4 border text-right space-y-2 transition-colors hover:border-sky-500/40 ${cardBg}`}
          >
            <Type className="w-6 h-6 text-[#8EC2FF]" />
            <div className="text-sm font-bold">شێوازی فۆنت</div>
            <div className="text-xs text-zinc-400 truncate">{currentFontLabel}</div>
          </button>

          <button
            type="button"
            onClick={() => setSheet('app_lang')}
            className={`rounded-3xl p-4 border text-right space-y-2 transition-colors hover:border-sky-500/40 ${cardBg}`}
          >
            <Globe className="w-6 h-6 text-[#8EC2FF]" />
            <div className="text-sm font-bold">زمانی بەرنامەکە</div>
            <div className="text-xs text-zinc-400">
              {settings.appLanguage === 'en'
                ? 'English'
                : settings.appLanguage === 'kmr'
                ? 'Kurdî (Kurmancî)'
                : 'کوردی (سۆرانی)'}
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('ai_settings')}
            className={`rounded-3xl p-4 border text-right space-y-2 transition-colors hover:border-sky-500/40 ${cardBg}`}
          >
            <Sparkles className="w-6 h-6 text-[#8EC2FF]" />
            <div className="text-sm font-bold">ژیری دەسکرد (AI)</div>
            <div className="text-xs text-zinc-400">ڕێکخستنی شێوازی کارکردن</div>
          </button>

          <button
            type="button"
            onClick={() => setSheet('translation')}
            className={`rounded-3xl p-4 border text-right space-y-2 transition-colors hover:border-sky-500/40 ${cardBg}`}
          >
            <Languages className="w-6 h-6 text-[#8EC2FF]" />
            <div className="text-sm font-bold">سەرچاوەی وەرگێڕان</div>
            <div className="text-xs text-zinc-400">
              {settings.translationEngine === 'ai_fluent'
                ? 'ژیری دەسکرد (ڕەوان)'
                : 'وەرگێڕی گۆگڵ (خێرا)'}
            </div>
          </button>
        </div>

        {/* Enabled Languages Cards */}
        <div className="space-y-3 pt-1">
          {settings.enabledLanguages.map((lang) => (
            <div key={lang.code} className={`rounded-3xl p-4 border space-y-3 ${cardBg}`}>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => onUpdate({ activeLanguage: lang.code })}
                  className="text-right"
                >
                  <div className="text-base font-bold flex items-center gap-2">
                    <span>{lang.nativeName}</span>
                    {settings.activeLanguage === lang.code && (
                      <span className="text-[11px] font-semibold text-sky-400">· چالاک</span>
                    )}
                  </div>
                  <div className="text-xs text-zinc-400">
                    {getCharacterLayoutLabel(lang.characterLayoutId)}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => removeLanguage(lang.code)}
                  disabled={settings.enabledLanguages.length <= 1}
                  className="w-10 h-10 rounded-full bg-red-500/15 text-red-400 hover:bg-red-500/25 disabled:opacity-30 flex items-center justify-center transition-colors"
                  title="سڕینەوەی زمان"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Per-Language Character Layout Picker (All 41 official layouts!) */}
              <button
                type="button"
                onClick={() => {
                  setLayoutPickerLangCode(lang.code);
                  setSheet('layout_picker');
                }}
                className="w-full flex items-center justify-between pt-2.5 border-t border-white/5 text-right group"
              >
                <div className="flex items-center gap-2">
                  <KeyboardIcon className="w-4 h-4 text-[#8EC2FF]" />
                  <span className="text-sm font-medium text-zinc-300">شێوازی ڕیزبەندی</span>
                </div>
                <div className="flex items-center gap-1 text-xs font-bold text-[#9AC5FF] group-hover:text-white">
                  <span>{getCharacterLayoutLabel(lang.characterLayoutId)}</span>
                  <ChevronLeft className="w-4 h-4" />
                </div>
              </button>

              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <span className="text-sm font-medium text-zinc-300">لیستی ژمارەکان</span>
                <AppToggle
                  checked={lang.numberRow}
                  onChange={(val) => toggleLangNumberRow(lang.code, val)}
                  label={`لیستی ژمارەکان بۆ ${lang.nativeName}`}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Add Language Floating CTA */}
        <div className="flex justify-start pt-2">
          <button
            type="button"
            onClick={() => setSheet('add_lang')}
            className="h-12 px-5 rounded-2xl bg-[#0B5FA8] hover:bg-[#0D70C7] text-white text-sm font-bold flex items-center gap-2 shadow-lg shadow-sky-900/30 active:scale-95 transition-all"
          >
            <Plus className="w-5 h-5" />
            <span>زیادکردنی زمان ({ALL_SUBTYPE_PRESETS.length})</span>
          </button>
        </div>
      </div>

      {/* Bottom Sheets */}
      {sheet !== 'none' && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end justify-center p-0 sm:p-4"
          onClick={() => setSheet('none')}
        >
          <div
            className={`w-full max-w-md max-h-[82vh] flex flex-col rounded-t-3xl sm:rounded-3xl p-5 space-y-4 border ${
              isLightApp
                ? 'bg-white border-slate-200 text-slate-900'
                : 'bg-[#0C0D10] border-white/10 text-white'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full bg-zinc-600 mx-auto shrink-0" />

            {sheet === 'translation' && (
              <>
                <div className="flex items-center justify-between shrink-0">
                  <h3 className="text-lg font-extrabold">سەرچاوەی وەرگێڕان</h3>
                  <button
                    type="button"
                    onClick={() => setSheet('none')}
                    className="p-1 text-zinc-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-2.5">
                  {(
                    [
                      { id: 'google_fast', label: 'وەرگێڕی گۆگڵ (خێرا)' },
                      { id: 'ai_fluent', label: 'ژیری دەسکرد (ڕەوان)' },
                    ] as const
                  ).map((opt) => {
                    const active = settings.translationEngine === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          onUpdate({ translationEngine: opt.id });
                          setSheet('none');
                        }}
                        className={`w-full h-14 px-4 rounded-2xl flex items-center justify-between transition-colors ${
                          active
                            ? 'bg-[#17202D] border border-sky-400/40'
                            : 'hover:bg-white/5 border border-transparent'
                        }`}
                      >
                        <span className="text-sm font-bold">{opt.label}</span>
                        <span
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            active ? 'border-[#9AC5FF]' : 'border-zinc-500'
                          }`}
                        >
                          {active && <span className="w-2.5 h-2.5 rounded-full bg-[#9AC5FF]" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {sheet === 'font' && (
              <>
                <div className="flex items-center justify-between shrink-0">
                  <h3 className="text-lg font-extrabold">شێوازی فۆنتی تەختەکلیل ({FONT_STYLES.length})</h3>
                  <button
                    type="button"
                    onClick={() => setSheet('none')}
                    className="p-1 text-zinc-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-2 overflow-y-auto custom-scroll pr-0.5">
                  {FONT_STYLES.map((f) => {
                    const active = settings.fontStyle === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => {
                          onUpdate({ fontStyle: f.id });
                          setSheet('none');
                        }}
                        className={`w-full px-4 py-3 rounded-2xl flex items-center justify-between border transition-colors ${
                          active
                            ? 'bg-[#17202D] border-sky-400/40'
                            : 'border-white/5 hover:bg-white/5'
                        }`}
                      >
                        <div className="text-right space-y-0.5">
                          <div className="text-xs font-bold text-zinc-400">{f.label}</div>
                          <div className={`text-base font-semibold font-style-${f.id}`}>
                            {f.sample}
                          </div>
                        </div>
                        {active && <Check className="w-4 h-4 text-sky-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {sheet === 'layout_picker' && editingLang && (
              <>
                <div className="flex items-center justify-between shrink-0">
                  <div>
                    <h3 className="text-lg font-extrabold">شێوازی ڕیزبەندی — {editingLang.nativeName}</h3>
                    <p className="text-xs text-zinc-400">هەر یەکێک لە ٤١ ڕیزبەندییە فەرمییەکان هەڵبژێرە</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSheet('none')}
                    className="p-1 text-zinc-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-4 overflow-y-auto custom-scroll pr-0.5">
                  {(
                    [
                      { key: 'kurdish', title: 'شێوازە کوردییەکان (١٣ شێواز)' },
                      { key: 'fancy', title: 'شێوازە جوانکارەکان (Fancy Styles 1–10)' },
                      { key: 'arabic_persian', title: 'عەرەبی و فارسی' },
                      { key: 'international', title: 'زمانە جیهانییەکان (QWERTY / AZERTY / ...)' },
                    ] as const
                  ).map((grp) => {
                    const items = CHARACTER_LAYOUT_OPTIONS.filter((o) => o.group === grp.key);
                    return (
                      <div key={grp.key} className="space-y-1.5">
                        <div className="text-[11px] font-bold text-[#9AC5FF] px-1">
                          {grp.title}
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {items.map((opt) => {
                            const active = editingLang.characterLayoutId === opt.id;
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => changeLangLayout(editingLang.code, opt.id)}
                                className={`px-3 py-2.5 rounded-xl border text-right flex items-center justify-between gap-1.5 transition-colors ${
                                  active
                                    ? 'bg-[#17202D] border-sky-400 text-sky-300 font-bold'
                                    : 'border-white/10 hover:bg-white/5 text-zinc-200'
                                }`}
                              >
                                <span className="text-xs truncate">{opt.label}</span>
                                {active && <Check className="w-3.5 h-3.5 text-sky-400 shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {sheet === 'app_lang' && (
              <>
                <h3 className="text-lg font-extrabold shrink-0">زمانی بەرنامەکە</h3>
                <div className="space-y-2">
                  {(
                    [
                      { id: 'ckb', label: 'کوردی (سۆرانی)' },
                      { id: 'kmr', label: 'Kurdî (Kurmancî)' },
                      { id: 'en', label: 'English' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        onUpdate({ appLanguage: opt.id });
                        setSheet('none');
                      }}
                      className={`w-full h-12 px-4 rounded-2xl flex items-center justify-between border ${
                        settings.appLanguage === opt.id
                          ? 'bg-[#17202D] border-sky-400/40'
                          : 'border-white/5 hover:bg-white/5'
                      }`}
                    >
                      <span className="text-sm font-bold">{opt.label}</span>
                      {settings.appLanguage === opt.id && (
                        <Check className="w-4 h-4 text-sky-400" />
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}

            {sheet === 'add_lang' && (
              <>
                <div className="flex items-center justify-between shrink-0">
                  <h3 className="text-lg font-extrabold">زیادکردنی زمان ({ALL_SUBTYPE_PRESETS.length} زمان)</h3>
                  <button
                    type="button"
                    onClick={() => setSheet('none')}
                    className="p-1 text-zinc-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-2 overflow-y-auto custom-scroll pr-0.5">
                  {ALL_SUBTYPE_PRESETS.map((lang) => {
                    const already = settings.enabledLanguages.some((l) => l.code === lang.code);
                    return (
                      <button
                        key={lang.code}
                        type="button"
                        disabled={already}
                        onClick={() => addLanguage(lang)}
                        className="w-full px-4 py-3 rounded-2xl flex items-center justify-between border border-white/10 hover:bg-white/5 disabled:opacity-40"
                      >
                        <div className="text-right">
                          <div className="text-sm font-bold">{lang.nativeName}</div>
                          <div className="text-xs text-zinc-400">
                            {lang.name} · {lang.subtitle}
                          </div>
                        </div>
                        {already ? (
                          <span className="text-xs text-emerald-400 font-semibold">زیادکراوە</span>
                        ) : (
                          <Plus className="w-4 h-4 text-sky-400" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface AISettingsScreenProps {
  settings: KeyboardSettings;
  onUpdate: (patch: Partial<KeyboardSettings>) => void;
  onBack: () => void;
  onFocusKeyboard: () => void;
  isLightApp: boolean;
}

export const AISettingsScreen: React.FC<AISettingsScreenProps> = ({
  settings,
  onUpdate,
  onBack,
  onFocusKeyboard,
  isLightApp,
}) => {
  const [showGuide, setShowGuide] = useState(false);
  const [showVercelGuide, setShowVercelGuide] = useState(false);
  const [urlModalOpen, setUrlModalOpen] = useState(false);
  const [urlDraft, setUrlDraft] = useState(settings.aiServerUrl || '');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<AiHealthTestResult | null>(null);

  const envServerUrl = getBuildTimeApiBaseUrl();
  const resolved = resolveAiServer(settings.aiServerUrl);

  const openUrlModal = () => {
    setUrlDraft(settings.aiServerUrl || envServerUrl || '');
    setUrlError(null);
    setUrlModalOpen(true);
  };

  const handleSaveServerUrl = () => {
    try {
      const normalized = normalizeAiServerUrl(urlDraft);
      onUpdate({ aiServerUrl: normalized });
      setUrlModalOpen(false);
      setUrlError(null);
      setTestResult(null);
    } catch (err: unknown) {
      setUrlError(err instanceof Error ? err.message : 'بەستەرەکە دروست نییە.');
    }
  };

  const handleClearServerUrl = () => {
    onUpdate({ aiServerUrl: '' });
    setUrlDraft('');
    setUrlError(null);
    setTestResult(null);
    setUrlModalOpen(false);
  };

  const handleTestConnection = async () => {
    if (resolved.source === 'none') {
      setTestResult({
        status: 'error',
        message: 'تکایە سەرەتا بەستەری سێرڤەری Vercel دابنێ (نموونە: https://your-app.vercel.app).',
      });
      return;
    }
    setTesting(true);
    setTestResult(null);
    const res = await testAiServerConnection(resolved.baseUrl);
    setTestResult(res);
    setTesting(false);
  };

  const borderMuted = isLightApp ? 'border-slate-200' : 'border-white/5';
  const subText = isLightApp ? 'text-slate-500' : 'text-zinc-400';
  const sectionAccent = isLightApp ? 'text-[#0B5FA8]' : 'text-[#9AC5FF]';
  const cardSurface = isLightApp
    ? 'bg-slate-50 border-slate-200 text-slate-700'
    : 'bg-[#14171E] border-white/10 text-zinc-300';

  const serverSubtitle = (() => {
    if (resolved.source === 'settings') {
      return `${resolved.baseUrl} · دانراوە لە ئەپ`;
    }
    if (resolved.source === 'env') {
      return `${resolved.baseUrl} · دانراوە لە GitHub Secrets`;
    }
    if (resolved.source === 'same_origin') {
      return 'سێرڤەری بنەڕەتی وێب · کرتە بکە بۆ دانانی لینکی Vercel';
    }
    return 'دانەنراوە — کرتە بکە بۆ دانانی لینکی خۆڕایی Vercel';
  })();

  return (
    <div className="min-h-full flex flex-col pb-24" dir="rtl">
      <SubPageHeader title="ژیری دەسکرد (AI)" onBack={onBack} isLightApp={isLightApp} />
      <div className="px-4 pt-3 space-y-5">
        <NotificationBanner
          enabled={settings.notificationsEnabled}
          onEnable={() => onUpdate({ notificationsEnabled: true })}
        />

        <div className="flex items-center justify-between gap-4 py-2">
          <div>
            <div className="text-base font-bold">وەڵامدەرەوەی زیرەک</div>
            <div className={`text-xs mt-1 ${subText}`}>
              بەکارهێنانی ژیری دەسکرد بۆ ڕاستکردنەوە و داڕشتنەوەی دەقەکان
            </div>
          </div>
          <AppToggle
            checked={settings.smartReplyEnabled}
            onChange={(v) => onUpdate({ smartReplyEnabled: v })}
            label="وەڵامدەرەوەی زیرەک"
          />
        </div>

        <div className="space-y-3 pt-1">
          <div className={`text-xs font-bold ${sectionAccent}`}>ڕێکخستنی ژیری دەسکرد</div>

          <div className={`py-2 border-b ${borderMuted}`}>
            <div className="text-sm font-bold">مۆدێلی ژیری دەسکرد</div>
            <div className={`text-xs mt-0.5 ${subText}`}>ژیری دەسکردی Gemini (پڕۆکسی سێرڤەری پارێزراو)</div>
          </div>

          <button
            type="button"
            onClick={() =>
              onUpdate({
                aiTextSource:
                  settings.aiTextSource === 'selected_or_all' ? 'all' : 'selected_or_all',
              })
            }
            className={`w-full py-2.5 text-right border-b ${borderMuted} ${
              isLightApp ? 'hover:bg-slate-100' : 'hover:bg-white/[0.03]'
            } rounded-xl px-2 -mx-2 transition-colors`}
          >
            <div className="text-sm font-bold">سەرچاوەی دەق</div>
            <div className={`text-xs mt-0.5 ${subText}`}>
              {settings.aiTextSource === 'selected_or_all'
                ? 'دەقی دیاریکراو یان هەمووی'
                : 'تەنها هەموو دەقەکە'}
            </div>
          </button>
        </div>

        {/* Vercel AI Server Proxy Section */}
        <div className="space-y-3 pt-1">
          <div className={`text-xs font-bold ${sectionAccent}`}>پەیوەندی سێرڤەر (Vercel AI)</div>

          <button
            type="button"
            onClick={openUrlModal}
            className={`w-full py-2.5 text-right border-b ${borderMuted} ${
              isLightApp ? 'hover:bg-slate-100' : 'hover:bg-white/[0.03]'
            } rounded-xl px-2 -mx-2 transition-colors flex items-center justify-between gap-3`}
          >
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold flex items-center gap-2">
                <span>بەستەری سێرڤەری AI (Vercel)</span>
                {(resolved.source === 'settings' || resolved.source === 'env') && (
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                )}
              </div>
              <div className={`text-xs mt-0.5 truncate ${subText}`} dir="auto">
                {serverSubtitle}
              </div>
            </div>
            <Link2 className={`w-4 h-4 shrink-0 ${sectionAccent}`} />
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing}
              className={`flex-1 h-11 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-60 ${
                isLightApp
                  ? 'border-sky-300 bg-sky-50 text-sky-800 hover:bg-sky-100'
                  : 'border-sky-400/35 bg-sky-500/10 text-[#9AC5FF] hover:bg-sky-500/15'
              }`}
            >
              {testing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>خەریکی پشکنینە...</span>
                </>
              ) : (
                <>
                  <Server className="w-4 h-4" />
                  <span>پشکنینی پەیوەندی سێرڤەر</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={openUrlModal}
              className={`h-11 px-4 rounded-2xl border text-xs font-bold transition-colors ${
                isLightApp
                  ? 'border-slate-300 text-slate-700 hover:bg-slate-100'
                  : 'border-white/15 text-zinc-200 hover:bg-white/5'
              }`}
            >
              دەستکاری
            </button>
          </div>

          {testResult && (
            <div
              className={`rounded-2xl p-3 border text-xs leading-relaxed flex items-start gap-2.5 ${
                testResult.status === 'ready'
                  ? isLightApp
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : testResult.status === 'missing_key'
                  ? isLightApp
                    ? 'bg-amber-50 border-amber-200 text-amber-800'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                  : isLightApp
                  ? 'bg-rose-50 border-rose-200 text-rose-800'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              {testResult.status === 'ready' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}

          {/* Free Vercel 1-Click Setup Guide */}
          <button
            type="button"
            onClick={() => setShowVercelGuide((v) => !v)}
            className={`w-full h-11 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 transition-colors ${
              isLightApp
                ? 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
                : 'border-white/15 bg-white/[0.03] text-zinc-100 hover:bg-white/[0.06]'
            }`}
          >
            <ShieldCheck className={`w-4 h-4 ${sectionAccent}`} />
            <span>چۆنیەتی دروستکردنی لینکی خۆڕایی Vercel (بێ کارتی بانک)</span>
          </button>

          {showVercelGuide && (
            <div className={`rounded-2xl border p-4 space-y-2.5 text-xs leading-relaxed ${cardSurface}`}>
              <p className="font-bold text-sm">
                دروستکردنی سێرڤەری AI بە خۆڕایی لە Vercel (لە ١ خولەکدا):
              </p>
              <p>١. پڕۆژەکەت لەسەر هەژماری GitHub ـەکەت دابنێ.</p>
              <p>
                ٢. بچۆ سەر <span className="font-mono font-bold" dir="ltr">vercel.com</span> و بە
                هەژماری GitHub بچۆ ژوورەوە (هیچ کارتی بانکێک ناوێت).
              </p>
              <p>
                ٣. لەسەر <span className="font-bold">Add New Project</span> دابگرە و ڕیپۆزیتۆری
                تەختەکلیلی کوردی هەڵبژێرە.
              </p>
              <p>
                ٤. پێش Deploy، لە بەشی <span className="font-bold">Environment Variables</span>{' '}
                ناوی <span className="font-mono font-bold" dir="ltr">GEMINI_API_KEY</span> بنووسە و
                کلیلەکەت لە خانەی Value دابنێ، پاشان <span className="font-bold">Deploy</span>{' '}
                دابگرە.
              </p>
              <p>
                ٥. ئەو لینکەی Vercel پێت دەدات (وەک{' '}
                <span className="font-mono" dir="ltr">https://kurdi-keyboard.vercel.app</span>)
                کۆپی بکە و لێرە لە «بەستەری سێرڤەری AI» دایبنێ — یان لە{' '}
                <span className="font-bold">GitHub Secrets</span> بە ناوی{' '}
                <span className="font-mono font-bold" dir="ltr">VITE_API_BASE_URL</span> دایبنێ تا
                بۆ APK ـەکەش خۆکار بێت.
              </p>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowGuide((v) => !v)}
          className={`w-full h-12 rounded-2xl border text-sm font-bold flex items-center justify-center gap-2 transition-colors ${
            isLightApp
              ? 'border-sky-300 text-sky-800 hover:bg-sky-50'
              : 'border-sky-400/35 hover:bg-sky-500/10'
          }`}
        >
          <span>چۆنیەتی بەکارهێنانی ژیری دەسکرد</span>
          <span className="w-6 h-6 rounded-full bg-[#9AC5FF] text-[#051B3A] flex items-center justify-center">
            <Play className="w-3 h-3 fill-current" />
          </span>
        </button>

        {showGuide && (
          <div className={`rounded-2xl border p-4 space-y-2.5 text-xs leading-relaxed ${cardSurface}`}>
            <p>١. لەسەر تەختەکلیلەکە دەقێک بە کوردی یان ئینگلیزی بنووسە.</p>
            <p>
              ٢. لەسەر ئایکۆنی ئەستێرەی زیرەک (✨) لە سەرەوەی تەختەکلیلەکە یان «وەڵامدەرەوەی زیرەک»
              لە لیستی ئامرازەکان دابگرە.
            </p>
            <p>
              ٣. یەکێک لە شێوازەکان هەڵبژێرە (ڕاستکردنەوە، فەرمی، دۆستانە، کورتکردنەوە، وەڵامی
              زیرەک) و دەستبەجێ ئەنجامەکە دابنێ!
            </p>
            <button
              type="button"
              onClick={onFocusKeyboard}
              className="mt-2 h-9 px-4 rounded-xl bg-sky-600 text-white font-bold"
            >
              ئێستا تاقیبکەرەوە
            </button>
          </div>
        )}
      </div>

      {/* Material You Centered Dialog for Vercel AI Server URL */}
      {urlModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-5"
          onClick={() => setUrlModalOpen(false)}
          dir="rtl"
        >
          <div
            className={`w-full max-w-sm rounded-[28px] p-6 space-y-5 shadow-2xl border ${
              isLightApp
                ? 'bg-white border-slate-200 text-slate-900'
                : 'bg-[#25272C] border-white/10 text-white'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-1.5">
              <h3 className="text-lg font-extrabold">بەستەری سێرڤەری AI (Vercel)</h3>
              <p className={`text-xs leading-relaxed ${subText}`}>
                لینکی پڕۆژەکەت لە Vercel لێرە دابنێ. کلیلی Gemini بە پارێزراوی لەناو سێرڤەری Vercel
                دەمێنێتەوە.
              </p>
            </div>

            <div className="space-y-1.5">
              <div
                className={`rounded-t-xl px-3.5 pt-2.5 pb-2 border-b-2 transition-colors ${
                  urlError
                    ? 'border-rose-400 bg-rose-500/10'
                    : isLightApp
                    ? 'border-sky-600 bg-slate-100'
                    : 'border-[#9AC5FF] bg-[#30333A]'
                }`}
              >
                <label className={`block text-[11px] font-bold mb-1 ${sectionAccent}`}>
                  Vercel Server URL
                </label>
                <input
                  type="url"
                  dir="ltr"
                  value={urlDraft}
                  onChange={(e) => {
                    setUrlDraft(e.target.value);
                    if (urlError) setUrlError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveServerUrl();
                  }}
                  placeholder="https://your-app.vercel.app"
                  autoFocus
                  className="w-full bg-transparent text-sm outline-none font-mono placeholder:text-zinc-500"
                />
              </div>
              {urlError && <p className="text-[11px] text-rose-400 font-semibold">{urlError}</p>}
            </div>

            <div className="flex items-center justify-between pt-1">
              <div>
                {settings.aiServerUrl && (
                  <button
                    type="button"
                    onClick={handleClearServerUrl}
                    className="text-xs font-bold text-rose-400 hover:text-rose-300 px-2 py-1.5"
                  >
                    پاککردنەوە
                  </button>
                )}
              </div>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setUrlModalOpen(false)}
                  className={`text-sm font-bold px-2 py-1.5 transition-colors ${
                    isLightApp ? 'text-slate-600 hover:text-slate-900' : 'text-[#9AC5FF]/85 hover:text-[#9AC5FF]'
                  }`}
                >
                  پاشگەزبوونەوە
                </button>
                <button
                  type="button"
                  onClick={handleSaveServerUrl}
                  className={`text-sm font-extrabold px-2 py-1.5 transition-colors ${
                    isLightApp ? 'text-[#0B5FA8] hover:text-sky-700' : 'text-[#9AC5FF] hover:text-white'
                  }`}
                >
                  جێبەجێکردن
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
