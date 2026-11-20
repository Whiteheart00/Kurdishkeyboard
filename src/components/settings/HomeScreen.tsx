import React, { useState } from 'react';
import { ChevronLeft, Star, X } from 'lucide-react';
import { KeyboardSettings, SettingsRoute } from '../../types/keyboard';
import { getAppDirection, tOfficial } from '../../data/officialData';
import { downloadProjectZip } from '../../utils/downloadZip';
import { KurdiIcon, KurdiIconName, KurdiLogo, PremiumBadgeIcon } from '../icons/KurdiIcons';
import { NotificationBanner } from './SettingsUI';

interface HomeScreenProps {
  settings: KeyboardSettings;
  onUpdate: (patch: Partial<KeyboardSettings>) => void;
  onNavigate: (route: SettingsRoute) => void;
  onOpenProModal: () => void;
  isLightApp: boolean;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  settings,
  onUpdate,
  onNavigate,
  onOpenProModal,
  isLightApp,
}) => {
  const [downloadingZip, setDownloadingZip] = useState(false);
  const lang = settings.appLanguage || 'ckb';
  const dir = getAppDirection(lang);

  const handleDownloadZip = async () => {
    if (downloadingZip) return;
    setDownloadingZip(true);
    await downloadProjectZip();
    setDownloadingZip(false);
  };
  const cardSurface = isLightApp
    ? 'bg-white border-slate-200 text-slate-900'
    : 'bg-[#121316] border-white/[0.06] text-white';
  const rowHover = isLightApp ? 'hover:bg-slate-50' : 'hover:bg-white/[0.04]';
  const iconCircle = isLightApp
    ? 'bg-slate-100 text-sky-700'
    : 'bg-[#1D2129] text-[#8EC2FF]';

  const ratingSummary = tOfficial(
    lang,
    'settings__home__status_rating_summary',
    'ئەگەر سوودت لە تەختەکلیلی کوردی وەرگرتووە، تکایە بە ٥ ئەستێرە پشتگیریمان بکە'
  ).replace(/\\n/g, ' ');

  return (
    <div className="px-4 pb-24 pt-2 space-y-4" dir={dir}>
      {/* Top App Bar with Official KurdiKeyboard Logo */}
      <div className="flex items-center justify-between py-2">
        <div className="flex items-center gap-2.5">
          <KurdiLogo className="w-9 h-9 drop-shadow-md shrink-0" />
          <h1
            className={`text-xl font-extrabold tracking-tight ${
              isLightApp ? 'text-slate-900' : 'text-white'
            }`}
          >
            {tOfficial(lang, 'settings__home__display_name', 'تەختەکلیلی کوردی')}
          </h1>
        </div>

        <button
          type="button"
          onClick={onOpenProModal}
          className={`h-9 pl-3.5 pr-1.5 rounded-full flex items-center gap-2 border transition-colors ${
            settings.proUnlocked
              ? 'bg-amber-500/15 border-amber-400/40 text-amber-300'
              : isLightApp
              ? 'bg-slate-100 border-slate-200 text-slate-800'
              : 'bg-[#17191E] border-white/10 text-zinc-200'
          }`}
        >
          {settings.proUnlocked ? (
            <PremiumBadgeIcon className="w-6 h-6" />
          ) : (
            <span className="w-6 h-6 rounded-full bg-gradient-to-br from-sky-400 to-indigo-700 flex items-center justify-center text-white">
              <KurdiIcon name="ic_global" className="w-3.5 h-3.5" />
            </span>
          )}
          <span className="text-xs font-bold">{settings.proUnlocked ? 'پێشکەوتوو' : 'ئاسایی'}</span>
        </button>
      </div>

      {/* Red Notification Banner */}
      <NotificationBanner
        enabled={settings.notificationsEnabled}
        onEnable={() => onUpdate({ notificationsEnabled: true })}
      />

      {/* Pro Version Banner Card with Official Hexagonal PRO Vector Badge */}
      <button
        type="button"
        onClick={onOpenProModal}
        className={`w-full rounded-3xl p-4 border flex items-center justify-between text-start transition-all active:scale-[0.99] ${
          isLightApp
            ? 'bg-gradient-to-l from-slate-100 to-white border-slate-200 text-slate-900'
            : 'bg-gradient-to-l from-[#1A2029] via-[#14171D] to-[#111318] border-white/10 text-white'
        }`}
      >
        <div className="flex items-center gap-3.5">
          <PremiumBadgeIcon className="w-11 h-11 shrink-0 drop-shadow-md" />
          <div>
            <div className="text-sm font-bold">
              {settings.proUnlocked
                ? 'وەشانی پێشکەوتوو چالاکە'
                : tOfficial(lang, 'settings__home__premium_teaser_title', 'وەشانی پێشکەوتووی بەرنامەکە')}
            </div>
            <div className="text-xs text-zinc-400 mt-0.5">
              {settings.proUnlocked
                ? 'هەموو ڕووکار و تایبەتمەندییەکان کراونەتەوە'
                : tOfficial(
                    lang,
                    'settings__home__premium_teaser_description',
                    'بە چەندین تایبەتمەندی هەمەجۆر بەردەستە..'
                  )}
            </div>
          </div>
        </div>
        <ChevronLeft className="w-5 h-5 text-zinc-400 shrink-0" />
      </button>

      {/* 1-Click GitHub APK ZIP Download Card */}
      <div
        className={`rounded-3xl p-4 border space-y-2.5 ${
          isLightApp
            ? 'bg-sky-50 border-sky-200 text-slate-900'
            : 'bg-gradient-to-l from-[#0B2340] via-[#0B1B30] to-[#091320] border-sky-400/30 text-white'
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-[#0B5FA8]/30 border border-sky-400/25 flex items-center justify-center shrink-0">
            <KurdiIcon name="ic_download" className="w-5 h-5 text-[#9AC5FF]" />
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-extrabold">دابەزاندنی فایلی ZIP بۆ APK (GitHub)</div>
            <div className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
              تەواوی پڕۆژەکە + کۆدی تەختەکلیلی سیستەمی ئەندرۆید (Direct Boot)
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDownloadZip}
          disabled={downloadingZip}
          className="w-full h-10 rounded-2xl bg-[#0B5FA8] hover:bg-[#0E70C4] active:scale-[0.98] disabled:opacity-60 text-white text-xs font-extrabold flex items-center justify-center gap-2 transition-all shadow-md"
        >
          <KurdiIcon name="ic_download" className="w-4 h-4" />
          <span>
            {downloadingZip
              ? 'خەریکی ئامادەکردنی فایلی ZIP...'
              : 'دابەزاندنی kurdikeyboard-github-apk.zip'}
          </span>
        </button>
      </div>

      {/* Rate App Card with Official 4-Color Google Play Vector */}
      {!settings.ratingDismissed && (
        <div
          className={`relative rounded-3xl p-5 text-center border space-y-3.5 ${
            isLightApp
              ? 'bg-sky-50 border-sky-200 text-slate-900'
              : 'bg-gradient-to-b from-[#071D33] to-[#051424] border-sky-500/20 text-white'
          }`}
        >
          <button
            type="button"
            onClick={() => onUpdate({ ratingDismissed: true })}
            className="absolute top-3.5 left-3.5 w-8 h-8 rounded-full flex items-center justify-center text-sky-300/70 hover:bg-white/10"
            aria-label="داخستن"
          >
            <X className="w-4 h-4" />
          </button>

          <h3 className={`text-base font-extrabold ${isLightApp ? 'text-sky-900' : 'text-[#8EC2FF]'}`}>
            {tOfficial(lang, 'settings__home__status_rating_title', 'هەڵسەنگاندنی بەرنامەکە')}
          </h3>

          <div className="flex items-center justify-center gap-2" dir="ltr">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => onUpdate({ userRating: star })}
                className="p-1 active:scale-90 transition-transform"
                aria-label={`${star} stars`}
              >
                <Star
                  className={`w-7 h-7 transition-colors ${
                    star <= settings.userRating
                      ? 'text-amber-400 fill-amber-400'
                      : 'text-sky-200/35'
                  }`}
                />
              </button>
            ))}
          </div>

          <p className={`text-xs leading-relaxed ${isLightApp ? 'text-slate-600' : 'text-sky-100/75'}`}>
            {settings.userRating === 5
              ? tOfficial(
                  lang,
                  'settings__home__rating_feedback_5_stars',
                  'سوپاس بۆ متمانەکەت! تکایە ٥ ئەستێرە دابنێ بۆ بەرنامەکە لە گۆگڵ پلەی :)'
                )
              : settings.userRating > 0
              ? tOfficial(
                  lang,
                  'settings__home__rating_feedback_other',
                  'سوپاس بۆ هەڵسەنگاندنەکەت! ئێمە بەردەوام دەبین لە باشترکردنی بەرنامەکە!'
                )
              : ratingSummary}
          </p>

          <button
            type="button"
            onClick={() => onUpdate({ userRating: 5, ratingDismissed: true })}
            className={`w-full h-11 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 transition-colors ${
              isLightApp
                ? 'bg-white border-sky-300 text-sky-800 hover:bg-sky-100'
                : 'bg-white/[0.04] border-sky-400/25 text-white hover:bg-white/[0.08]'
            }`}
          >
            <KurdiIcon name="ic_google_play" className="w-4 h-4" />
            <span>
              {tOfficial(lang, 'settings__home__status_rating_button', 'هەڵسەنگاندن لە گۆگڵ پلەی')}
            </span>
          </button>
        </div>
      )}

      {/* 2x2 Iconic Royal Blue Category Grid with Official Vector Icons */}
      <div className="grid grid-cols-2 gap-3.5">
        {(
          [
            { route: 'languages', label: 'زمان', icon: 'ic_language' },
            { route: 'themes', label: 'ڕووکار', icon: 'ic_themes' },
            { route: 'keyboard_prefs', label: 'تەختەکلیل', icon: 'ic_keyboards' },
            { route: 'emoji_settings', label: 'خەندەکان', icon: 'ic_xanda' },
          ] as { route: SettingsRoute; label: string; icon: KurdiIconName }[]
        ).map((tile) => (
          <button
            key={tile.route}
            type="button"
            onClick={() => onNavigate(tile.route)}
            className="h-32 rounded-3xl bg-gradient-to-b from-[#084D88] to-[#063A69] hover:from-[#0A599C] hover:to-[#07447A] active:scale-[0.97] text-white p-4 flex flex-col items-center justify-center gap-3 shadow-lg shadow-sky-950/30 transition-all border border-sky-400/15"
          >
            <span className="w-13 h-13 rounded-full bg-white/15 flex items-center justify-center">
              <KurdiIcon name={tile.icon} className="w-6 h-6 text-white" />
            </span>
            <span className="text-sm font-bold">{tile.label}</span>
          </button>
        ))}
      </div>

      {/* Brand Website & Socials */}
      <div className="py-3 text-center space-y-3">
        <div className="text-xl font-black tracking-tight text-[#A5CAFF]" dir="ltr">
          www.kurdikebord.io
        </div>
        <div className="flex items-center justify-center gap-8">
          {(
            [
              {
                label: tOfficial(lang, 'faq__social_youtube', 'یوتوب'),
                icon: 'ic_youtube',
                color: 'text-red-500 bg-red-500/15',
              },
              {
                label: 'تێلیگرام',
                icon: 'ic_telegram',
                color: 'text-sky-400 bg-sky-500/15',
              },
              {
                label: tOfficial(lang, 'faq__social_facebook', 'فەیسبووک'),
                icon: 'ic_facebook',
                color: 'text-blue-500 bg-blue-500/15',
              },
            ] as { label: string; icon: KurdiIconName; color: string }[]
          ).map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => onNavigate('faq')}
              className="flex flex-col items-center gap-1.5 group"
            >
              <span
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-transform group-hover:scale-105 ${s.color}`}
              >
                <KurdiIcon name={s.icon} className="w-5 h-5" />
              </span>
              <span
                className={`text-xs font-medium ${isLightApp ? 'text-slate-600' : 'text-zinc-300'}`}
              >
                {s.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Grouped Settings List 1 */}
      <div className={`rounded-3xl border overflow-hidden divide-y divide-white/[0.04] ${cardSurface}`}>
        {(
          [
            {
              route: 'layout_editor',
              label: tOfficial(lang, 'settings__home__custom_layout_editor_title', 'ڕیزبەندی تایبەت'),
              icon: 'ic_keyboard_keys',
            },
            { route: 'clipboard_settings', label: 'لەبەرگیراوەکان', icon: 'ic_clipboards' },
            { route: 'sound_vibration', label: 'دەنگ و لەرزین', icon: 'ic_sound' },
          ] as { route: SettingsRoute; label: string; icon: KurdiIconName }[]
        ).map((item) => (
          <button
            key={item.route}
            type="button"
            onClick={() => onNavigate(item.route)}
            className={`w-full px-4 py-3.5 flex items-center justify-between transition-colors ${rowHover}`}
          >
            <div className="flex items-center gap-3.5">
              <span className={`w-10 h-10 rounded-full flex items-center justify-center ${iconCircle}`}>
                <KurdiIcon name={item.icon} className="w-5 h-5" />
              </span>
              <span className="text-sm font-bold">{item.label}</span>
            </div>
            <ChevronLeft className="w-4 h-4 text-zinc-500" />
          </button>
        ))}
      </div>

      {/* Grouped Settings List 2 */}
      <div className={`rounded-3xl border overflow-hidden divide-y divide-white/[0.04] ${cardSurface}`}>
        {(
          [
            { route: 'gestures', label: 'ئاماژەکان', icon: 'ic_swipe' },
            { route: 'predictions', label: 'پێشنیارکردن', icon: 'ic_spellcheck' },
            { route: 'more_settings', label: 'ڕێکخستنی زیاتر', icon: 'ic_ui_settings' },
          ] as { route: SettingsRoute; label: string; icon: KurdiIconName }[]
        ).map((item) => (
          <button
            key={item.route}
            type="button"
            onClick={() => onNavigate(item.route)}
            className={`w-full px-4 py-3.5 flex items-center justify-between transition-colors ${rowHover}`}
          >
            <div className="flex items-center gap-3.5">
              <span className={`w-10 h-10 rounded-full flex items-center justify-center ${iconCircle}`}>
                <KurdiIcon name={item.icon} className="w-5 h-5" />
              </span>
              <span className="text-sm font-bold">{item.label}</span>
            </div>
            <ChevronLeft className="w-4 h-4 text-zinc-500" />
          </button>
        ))}
      </div>

      {/* FAQ & About Group */}
      <div className={`rounded-3xl border overflow-hidden divide-y divide-white/[0.04] ${cardSurface}`}>
        <button
          type="button"
          onClick={() => onNavigate('faq')}
          className={`w-full px-4 py-3.5 flex items-center justify-between transition-colors ${rowHover}`}
        >
          <div className="flex items-center gap-3.5">
            <span className={`w-10 h-10 rounded-full flex items-center justify-center ${iconCircle}`}>
              <KurdiIcon name="ic_forum" className="w-5 h-5" />
            </span>
            <span className="text-sm font-bold">
              {tOfficial(lang, 'faq__screen_title', 'ڕێنمایی و پرسیارە باوەکان (FAQ)')}
            </span>
          </div>
          <ChevronLeft className="w-4 h-4 text-zinc-500" />
        </button>

        <button
          type="button"
          onClick={() => onNavigate('about')}
          className={`w-full px-4 py-3.5 flex items-center justify-between transition-colors ${rowHover}`}
        >
          <div className="flex items-center gap-3.5">
            <span className={`w-10 h-10 rounded-full flex items-center justify-center ${iconCircle}`}>
              <KurdiIcon name="ic_library" className="w-5 h-5" />
            </span>
            <span className="text-sm font-bold">
              {tOfficial(lang, 'about__title', 'دەربارە')}
            </span>
          </div>
          <ChevronLeft className="w-4 h-4 text-zinc-500" />
        </button>
      </div>
    </div>
  );
};
