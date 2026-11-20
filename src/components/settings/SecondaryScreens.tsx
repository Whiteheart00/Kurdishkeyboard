import React, { useRef, useState } from 'react';
import { Check, ChevronDown, Pencil, Plus, X } from 'lucide-react';
import {
  AppLanguageCode,
  AppThemeMode,
  KeyboardSettings,
  SwipeAction,
  TextShortcut,
} from '../../types/keyboard';
import { playKeyFeedback, preloadSoundPack, SOUND_PACKS } from '../../utils/sound';
import { getAppDirection, getFaqItems, tOfficial } from '../../data/officialData';
import {
  DELETE_LONG_PRESS_ACTIONS,
  DELETE_SWIPE_LEFT_ACTIONS,
  GENERAL_SWIPE_ACTIONS,
  getSwipeActionLabel,
  SPACEBAR_LONG_PRESS_ACTIONS,
  SPACEBAR_SWIPE_ACTIONS,
  SWIPE_DISTANCE_THRESHOLDS,
  SWIPE_VELOCITY_THRESHOLDS,
} from '../../data/gestures';
import { KurdiIcon, KurdiIconName, KurdiLogo, PremiumBadgeIcon } from '../icons/KurdiIcons';
import { AppToggle, NotificationBanner, ProBadge, SubPageHeader } from './SettingsUI';

interface BaseSubProps {
  settings: KeyboardSettings;
  onUpdate: (patch: Partial<KeyboardSettings>) => void;
  onBack: () => void;
  isLightApp: boolean;
}

// 1. Clipboard Settings Screen matching Screenshot 22
export const ClipboardSettingsScreen: React.FC<BaseSubProps> = ({
  settings,
  onUpdate,
  onBack,
  isLightApp,
}) => {
  return (
    <div className="min-h-full flex flex-col pb-24" dir="rtl">
      <SubPageHeader title="لەبەرگیراوەکان" onBack={onBack} isLightApp={isLightApp} />
      <div className="px-4 pt-3 space-y-5">
        <NotificationBanner
          enabled={settings.notificationsEnabled}
          onEnable={() => onUpdate({ notificationsEnabled: true })}
        />

        {(
          [
            {
              title: 'بەشی لەبەرگیراوەکان',
              sub: 'بەکارهێنانی بەشی لەبەرگیراوەکان بۆ هەڵگرتنی شتەکان',
              val: settings.clipboardEnabled,
              set: (v: boolean) => onUpdate({ clipboardEnabled: v }),
              icon: 'ic_clipboards' as KurdiIconName,
            },
            {
              title: 'مێژووی لەبەرگیراوەکان',
              sub: 'هێشتنەوە و ڕێکخستنی لەبەرگیراوەکان',
              val: settings.clipboardHistoryEnabled,
              set: (v: boolean) => onUpdate({ clipboardHistoryEnabled: v }),
              icon: 'ic_history1' as KurdiIconName,
            },
            {
              title: 'پێشنیارکردنی دوایین لەبەرگیراوەکان',
              sub: 'پێشنیارکردنی ئەو دەق یان وێنانەی پێشتر کۆپی کراون',
              val: settings.clipboardSuggestLatest,
              set: (v: boolean) => onUpdate({ clipboardSuggestLatest: v }),
              icon: 'ic_smart' as KurdiIconName,
            },
            {
              title: 'سنووردارکردنی پێشنیارەکان',
              sub: 'ئەو شتانەی لە 60 چرکەی ڕابردوودا کۆپی کراون',
              pro: true,
              val: settings.clipboardSuggestLimit60s,
              set: (v: boolean) => onUpdate({ clipboardSuggestLimit60s: v }),
              icon: 'ic_history1' as KurdiIconName,
            },
            {
              title: 'سڕینەوەی لەبەرگیراوە کۆنەکان',
              sub: 'سڕینەوەی خۆکاری دوای ٢٠ خولەک',
              pro: true,
              val: settings.clipboardAutoDeleteOld,
              set: (v: boolean) => onUpdate({ clipboardAutoDeleteOld: v }),
              icon: 'ic_trash' as KurdiIconName,
            },
          ] as const
        ).map((row) => (
          <div key={row.title} className="flex items-center justify-between gap-3">
            <div className="flex items-start gap-3 flex-1">
              <KurdiIcon name={row.icon} className="w-5 h-5 text-zinc-400 mt-0.5 shrink-0" />
              <div>
                <div className="text-sm font-bold flex items-center gap-2">
                  <span>{row.title}</span>
                  {'pro' in row && row.pro && <ProBadge unlocked={settings.proUnlocked} />}
                </div>
                <div className="text-xs text-zinc-400 mt-0.5">{row.sub}</div>
              </div>
            </div>
            <AppToggle checked={row.val} onChange={row.set} label={row.title} />
          </div>
        ))}

        <div className="pt-2 border-t border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <KurdiIcon name="ic_number" className="w-5 h-5 text-zinc-400" />
            <div>
              <div className="text-sm font-bold">زۆرترین ڕێژەی هەڵگرتن</div>
              <div className="text-xs text-zinc-400">{settings.clipboardMaxItems} دانە</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {[10, 20, 40].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onUpdate({ clipboardMaxItems: n })}
                className={`h-8 px-3 rounded-lg text-xs font-bold tabular-nums ${
                  settings.clipboardMaxItems === n
                    ? 'bg-[#A4C9FF] text-[#051B3A]'
                    : 'bg-zinc-900 text-zinc-400'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// 2. Sound & Vibration Screen matching Screenshot 17 + Real Audio Packs
export const SoundVibrationScreen: React.FC<BaseSubProps> = ({
  settings,
  onUpdate,
  onBack,
  isLightApp,
}) => {
  const volumePct = Math.round((settings.soundVolume ?? 0.75) * 100);

  return (
    <div className="min-h-full flex flex-col pb-24" dir="rtl">
      <SubPageHeader title="دەنگ و لەرزین" onBack={onBack} isLightApp={isLightApp} />
      <div className="px-4 pt-3 space-y-6">
        <NotificationBanner
          enabled={settings.notificationsEnabled}
          onEnable={() => onUpdate({ notificationsEnabled: true })}
        />

        <div className="space-y-4">
          <div className="text-xs font-bold text-[#9AC5FF]">کاریگەری دەنگ / دەستلێدان</div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold">چالاککردنی کاریگەری دەنگی</span>
            <AppToggle
              checked={settings.soundEnabled}
              onChange={(v) => {
                onUpdate({ soundEnabled: v });
                if (v) {
                  preloadSoundPack(settings.soundPack);
                  playKeyFeedback('char', true, false, settings.soundPack, settings.soundVolume);
                }
              }}
              label="چالاککردنی کاریگەری دەنگی"
            />
          </div>

          {/* Real Audio Sound Packs */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-zinc-300">جۆری دەنگی کلیلەکان</span>
              <span className="text-zinc-500">
                {SOUND_PACKS.find((p) => p.id === settings.soundPack)?.labelKu}
              </span>
            </div>
            <div className="space-y-2">
              {SOUND_PACKS.map((pack) => {
                const selected = settings.soundPack === pack.id;
                return (
                  <button
                    key={pack.id}
                    type="button"
                    onClick={() => {
                      onUpdate({ soundPack: pack.id, soundEnabled: true });
                      preloadSoundPack(pack.id);
                      playKeyFeedback('char', true, false, pack.id, settings.soundVolume);
                    }}
                    className={`w-full rounded-2xl px-3.5 py-3 border flex items-center justify-between transition-all text-right ${
                      selected
                        ? 'bg-[#132238] border-[#7FB5FF] text-white'
                        : isLightApp
                        ? 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
                        : 'bg-[#12151C] border-white/[0.08] text-zinc-200 hover:bg-[#191D26]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          selected
                            ? 'bg-[#A4C9FF] text-[#051B3A]'
                            : 'bg-white/[0.06] text-zinc-400'
                        }`}
                      >
                        <KurdiIcon name="ic_sound" className="w-4 h-4" />
                      </span>
                      <div>
                        <div className="text-sm font-bold">{pack.labelKu}</div>
                        <div className="text-[11px] text-zinc-400 mt-0.5">{pack.subtitle}</div>
                      </div>
                    </div>
                    {selected && (
                      <span className="w-6 h-6 rounded-full bg-[#A4C9FF] text-[#051B3A] flex items-center justify-center shrink-0">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Volume Slider */}
          <div
            className={`rounded-2xl p-3.5 border space-y-2.5 ${
              isLightApp
                ? 'bg-white border-slate-200'
                : 'bg-[#12151C] border-white/[0.08]'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-bold">
              <span>ئاستی دەنگ</span>
              <span className="text-[#9AC5FF] tabular-nums">{volumePct}%</span>
            </div>
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={settings.soundVolume ?? 0.75}
              onChange={(e) => {
                const nextVol = Number(e.target.value);
                onUpdate({ soundVolume: nextVol });
              }}
              onPointerUp={() =>
                playKeyFeedback('char', true, false, settings.soundPack, settings.soundVolume)
              }
              className="w-full accent-[#A4C9FF] cursor-pointer"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="text-xs font-bold text-[#9AC5FF]">کاریگەری لەرزین / دەستلێدان</div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold">چالاککردنی کاریگەری لەرزین</span>
            <AppToggle
              checked={settings.vibrationEnabled}
              onChange={(v) => {
                onUpdate({ vibrationEnabled: v });
                if (v) playKeyFeedback('char', false, true, settings.soundPack, settings.soundVolume);
              }}
              label="چالاککردنی کاریگەری لەرزین"
            />
          </div>
        </div>

        {/* Multi-Key Live Audio Tester */}
        <div className="space-y-2">
          <div className="text-xs font-bold text-zinc-400">تاقیکردنەوەی دەنگ و لەرزین</div>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { type: 'char', label: 'پیت' },
                { type: 'space', label: 'بۆشایی' },
                { type: 'backspace', label: 'سڕینەوە' },
              ] as const
            ).map((btn) => (
              <button
                key={btn.type}
                type="button"
                onClick={() =>
                  playKeyFeedback(
                    btn.type,
                    settings.soundEnabled,
                    settings.vibrationEnabled,
                    settings.soundPack,
                    settings.soundVolume
                  )
                }
                className="h-11 rounded-2xl bg-[#151820] border border-white/10 text-xs font-bold text-[#9AC5FF] hover:bg-[#1D222D] active:scale-95 transition-all"
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// 3. Official Full 12-Preference Gestures Screen (from KurdiKebord SwipeAction & strings.xml)
interface GesturePickerState {
  title: string;
  current: SwipeAction;
  options: SwipeAction[];
  onSelect: (action: SwipeAction) => void;
}

export const GesturesScreen: React.FC<BaseSubProps> = ({
  settings,
  onUpdate,
  onBack,
  isLightApp,
}) => {
  const lang = settings.appLanguage || 'ckb';
  const dir = getAppDirection(lang);
  const [picker, setPicker] = useState<GesturePickerState | null>(null);

  const isSpaceCursorMode =
    settings.spaceBarSwipeLeftAction === 'move_cursor_left' &&
    settings.spaceBarSwipeRightAction === 'move_cursor_right';

  const applySpacebarPreset = (mode: 'lang' | 'cursor') => {
    if (mode === 'cursor') {
      onUpdate({
        spaceBarSwipeLeftAction: 'move_cursor_left',
        spaceBarSwipeRightAction: 'move_cursor_right',
        spacebarSwipeAction: 'move_cursor',
      });
    } else {
      onUpdate({
        spaceBarSwipeLeftAction: 'switch_to_next_subtype',
        spaceBarSwipeRightAction: 'switch_to_prev_subtype',
        spacebarSwipeAction: 'switch_lang',
      });
    }
  };

  const renderGestureRow = (
    keyId: string,
    title: string,
    currentAction: SwipeAction,
    options: SwipeAction[],
    onSelect: (action: SwipeAction) => void,
    isPro?: boolean
  ) => (
    <button
      key={keyId}
      type="button"
      onClick={() => setPicker({ title, current: currentAction, options, onSelect })}
      className={`w-full py-2.5 text-start border-b border-white/5 rounded-xl px-2 -mx-2 flex items-center justify-between gap-2 transition-colors ${
        isLightApp ? 'hover:bg-slate-100 border-slate-200/80' : 'hover:bg-white/[0.04]'
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold flex items-center gap-2">
          <span className="truncate">{title}</span>
          {isPro && <ProBadge unlocked={settings.proUnlocked} />}
        </div>
        <div className="text-xs text-[#9AC5FF] mt-0.5 truncate">
          {getSwipeActionLabel(currentAction, lang)}
        </div>
      </div>
      <ChevronDown className="w-4 h-4 text-zinc-500 shrink-0" />
    </button>
  );

  return (
    <div className="min-h-full flex flex-col pb-24" dir={dir}>
      <SubPageHeader
        title={tOfficial(lang, 'settings__gestures__title', 'ئاماژەکان')}
        onBack={onBack}
        isLightApp={isLightApp}
      />
      <div className="px-4 pt-3 space-y-5">
        <NotificationBanner
          enabled={settings.notificationsEnabled}
          onEnable={() => onUpdate({ notificationsEnabled: true })}
        />

        {/* Quick 1-Tap Spacebar Mode Presets */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => applySpacebarPreset('lang')}
            className={`h-10 px-3 rounded-2xl text-xs font-bold border transition-all ${
              !isSpaceCursorMode
                ? 'bg-[#A4C9FF] text-[#051B3A] border-[#A4C9FF]'
                : isLightApp
                ? 'bg-white border-slate-200 text-slate-700'
                : 'bg-[#14171D] border-white/10 text-zinc-300'
            }`}
          >
            بۆشایی ← گۆڕینی زمان
          </button>
          <button
            type="button"
            onClick={() => applySpacebarPreset('cursor')}
            className={`h-10 px-3 rounded-2xl text-xs font-bold border transition-all ${
              isSpaceCursorMode
                ? 'bg-[#A4C9FF] text-[#051B3A] border-[#A4C9FF]'
                : isLightApp
                ? 'bg-white border-slate-200 text-slate-700'
                : 'bg-[#14171D] border-white/10 text-zinc-300'
            }`}
          >
            بۆشایی ← جووڵاندنی کێرسەر
          </button>
        </div>

        {/* Section 1: General Gestures (4-way) */}
        <div className="space-y-1.5">
          <div className="text-xs font-bold text-[#9AC5FF]">
            {tOfficial(lang, 'pref__gestures__general_title', 'ئاماژە گشتییەکان')}
          </div>
          {renderGestureRow(
            'swipe_up',
            tOfficial(lang, 'pref__gestures__swipe_up__label', 'ڕاکێشان بۆ سەرەوە'),
            settings.swipeUpAction,
            GENERAL_SWIPE_ACTIONS,
            (a) => onUpdate({ swipeUpAction: a })
          )}
          {renderGestureRow(
            'swipe_down',
            tOfficial(lang, 'pref__gestures__swipe_down__label', 'ڕاکێشان بۆ خوارەوە'),
            settings.swipeDownAction,
            GENERAL_SWIPE_ACTIONS,
            (a) => onUpdate({ swipeDownAction: a })
          )}
          {renderGestureRow(
            'swipe_left',
            tOfficial(lang, 'pref__gestures__swipe_left__label', 'ڕاکێشان بۆ لای چەپ'),
            settings.swipeLeftAction,
            GENERAL_SWIPE_ACTIONS,
            (a) => onUpdate({ swipeLeftAction: a })
          )}
          {renderGestureRow(
            'swipe_right',
            tOfficial(lang, 'pref__gestures__swipe_right__label', 'ڕاکێشان بۆ لای ڕاست'),
            settings.swipeRightAction,
            GENERAL_SWIPE_ACTIONS,
            (a) => onUpdate({ swipeRightAction: a })
          )}
        </div>

        {/* Section 2: Space Bar Gestures (Up, Left, Right, Long Press) */}
        <div className="space-y-1.5">
          <div className="text-xs font-bold text-[#9AC5FF]">
            {tOfficial(lang, 'pref__gestures__space_bar_title', 'ئاماژەی دوگمەی بۆشایی')}
          </div>
          {renderGestureRow(
            'space_up',
            tOfficial(lang, 'pref__gestures__space_bar_swipe_up__label', 'دوگمەی بۆشایی بۆ سەرەوە'),
            settings.spaceBarSwipeUpAction,
            SPACEBAR_SWIPE_ACTIONS,
            (a) => onUpdate({ spaceBarSwipeUpAction: a })
          )}
          {renderGestureRow(
            'space_left',
            tOfficial(lang, 'pref__gestures__space_bar_swipe_left__label', 'دوگمەی بۆشایی بۆ لای چەپ'),
            settings.spaceBarSwipeLeftAction,
            SPACEBAR_SWIPE_ACTIONS,
            (a) =>
              onUpdate({
                spaceBarSwipeLeftAction: a,
                spacebarSwipeAction:
                  a === 'move_cursor_left'
                    ? 'move_cursor'
                    : a === 'no_action'
                    ? 'none'
                    : 'switch_lang',
              }),
            true
          )}
          {renderGestureRow(
            'space_right',
            tOfficial(lang, 'pref__gestures__space_bar_swipe_right__label', 'دوگمەی بۆشایی بۆ لای ڕاست'),
            settings.spaceBarSwipeRightAction,
            SPACEBAR_SWIPE_ACTIONS,
            (a) =>
              onUpdate({
                spaceBarSwipeRightAction: a,
                spacebarSwipeAction:
                  a === 'move_cursor_right'
                    ? 'move_cursor'
                    : a === 'no_action'
                    ? 'none'
                    : 'switch_lang',
              }),
            true
          )}
          {renderGestureRow(
            'space_long_press',
            tOfficial(lang, 'pref__gestures__space_bar_long_press__label', 'دوگمەی بۆشایی لەکاتی دەستڕاگرتن'),
            settings.spaceBarLongPressAction,
            SPACEBAR_LONG_PRESS_ACTIONS,
            (a) => onUpdate({ spaceBarLongPressAction: a })
          )}
        </div>

        {/* Section 3: Other Gestures & Thresholds */}
        <div className="space-y-2.5">
          <div className="text-xs font-bold text-[#9AC5FF]">
            {tOfficial(lang, 'pref__gestures__other_title', 'فرمانەکانی تر')}
          </div>
          {renderGestureRow(
            'delete_swipe_left',
            tOfficial(lang, 'pref__gestures__delete_key_swipe_left__label', 'دوگمەی سڕینەوە بۆ لای چەپ'),
            settings.deleteKeySwipeLeftAction,
            DELETE_SWIPE_LEFT_ACTIONS,
            (a) =>
              onUpdate({
                deleteKeySwipeLeftAction: a,
                backspaceSwipeDeleteWord: a !== 'no_action',
              }),
            true
          )}
          {renderGestureRow(
            'delete_long_press',
            tOfficial(lang, 'pref__gestures__delete_key_long_press__label', 'دوگمەی سڕینەوە لەکاتی دەست ڕاگرتن'),
            settings.deleteKeyLongPressAction,
            DELETE_LONG_PRESS_ACTIONS,
            (a) => onUpdate({ deleteKeyLongPressAction: a })
          )}

          {/* Swipe Distance Threshold */}
          <div
            className={`rounded-2xl p-3.5 border space-y-2.5 ${
              isLightApp ? 'bg-white border-slate-200' : 'bg-[#12151C] border-white/[0.08]'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-bold">
              <span>{tOfficial(lang, 'pref__gestures__swipe_distance_threshold__label', 'ماوەی ڕاکێشان')}</span>
              <span className="text-[#9AC5FF] tabular-nums">{settings.swipeDistanceThreshold} dp</span>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {SWIPE_DISTANCE_THRESHOLDS.map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => onUpdate({ swipeDistanceThreshold: val })}
                  className={`h-8 rounded-xl text-xs font-bold tabular-nums transition-colors ${
                    settings.swipeDistanceThreshold === val
                      ? 'bg-[#A4C9FF] text-[#051B3A]'
                      : isLightApp
                      ? 'bg-slate-100 text-slate-700'
                      : 'bg-white/[0.06] text-zinc-300'
                  }`}
                >
                  {val}
                </button>
              ))}
            </div>
          </div>

          {/* Swipe Velocity Threshold */}
          <div
            className={`rounded-2xl p-3.5 border space-y-2.5 ${
              isLightApp ? 'bg-white border-slate-200' : 'bg-[#12151C] border-white/[0.08]'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-bold">
              <span>{tOfficial(lang, 'pref__gestures__swipe_velocity_threshold__label', 'ئاستی خێرایی ڕاکێشان')}</span>
              <span className="text-[#9AC5FF] tabular-nums">{settings.swipeVelocityThreshold} dp/s</span>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {SWIPE_VELOCITY_THRESHOLDS.map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => onUpdate({ swipeVelocityThreshold: val })}
                  className={`h-8 rounded-xl text-xs font-bold tabular-nums transition-colors ${
                    settings.swipeVelocityThreshold === val
                      ? 'bg-[#A4C9FF] text-[#051B3A]'
                      : isLightApp
                      ? 'bg-slate-100 text-slate-700'
                      : 'bg-white/[0.06] text-zinc-300'
                  }`}
                >
                  {val}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Action Picker Modal */}
      {picker && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-3"
          onClick={() => setPicker(null)}
        >
          <div
            className={`w-full max-w-md max-h-[75vh] rounded-3xl border shadow-2xl flex flex-col overflow-hidden ${
              isLightApp
                ? 'bg-white border-slate-200 text-slate-900'
                : 'bg-[#12151D] border-white/10 text-white'
            }`}
            onClick={(e) => e.stopPropagation()}
            dir={dir}
          >
            <div className="px-4 py-3.5 border-b border-white/10 flex items-center justify-between gap-2 shrink-0">
              <span className="text-sm font-extrabold truncate">{picker.title}</span>
              <button
                type="button"
                onClick={() => setPicker(null)}
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  isLightApp ? 'bg-slate-100 text-slate-800' : 'bg-white/10 text-white'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-y-auto custom-scroll p-2 space-y-1">
              {picker.options.map((act) => {
                const active = picker.current === act;
                return (
                  <button
                    key={act}
                    type="button"
                    onClick={() => {
                      picker.onSelect(act);
                      setPicker(null);
                    }}
                    className={`w-full px-3.5 py-2.5 rounded-2xl text-xs font-bold flex items-center justify-between gap-2 text-start transition-colors ${
                      active
                        ? 'bg-[#0B5FA8] text-white'
                        : isLightApp
                        ? 'hover:bg-slate-100 text-slate-800'
                        : 'hover:bg-white/[0.06] text-zinc-200'
                    }`}
                  >
                    <span className="truncate">{getSwipeActionLabel(act, lang)}</span>
                    {active && <Check className="w-4 h-4 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// 4. Predictions, Personal Dictionary & Custom Text Shortcuts Screen
export const PredictionsScreen: React.FC<BaseSubProps> = ({
  settings,
  onUpdate,
  onBack,
  isLightApp,
}) => {
  const [newWord, setNewWord] = useState('');
  const [showDict, setShowDict] = useState(false);

  const [showShortcuts, setShowShortcuts] = useState(true);
  const [shortcutTrigger, setShortcutTrigger] = useState('');
  const [shortcutExpansion, setShortcutExpansion] = useState('');
  const [editingShortcutId, setEditingShortcutId] = useState<string | null>(null);
  const [shortcutError, setShortcutError] = useState<string | null>(null);

  const shortcuts = settings.textShortcuts || [];

  const addDictWord = () => {
    const clean = newWord.trim();
    if (!clean || settings.personalDictionary.includes(clean)) return;
    onUpdate({ personalDictionary: [clean, ...settings.personalDictionary] });
    setNewWord('');
  };

  const handleSaveShortcut = () => {
    let trigger = shortcutTrigger.trim();
    let expansion = shortcutExpansion.trim();

    // Support quick "س:السَّلَاْمُ عَلَیْکُم براکەم" entry in the first field
    if (!expansion && trigger.includes(':')) {
      const colonIdx = trigger.indexOf(':');
      const left = trigger.slice(0, colonIdx).trim();
      const right = trigger.slice(colonIdx + 1).trim();
      if (left && right) {
        trigger = left;
        expansion = right;
      }
    }

    if (!trigger) {
      setShortcutError('تکایە کورتکراوەکە بنووسە (نموونە: س)');
      return;
    }
    if (/\s/.test(trigger)) {
      setShortcutError('کورتکراوە نابێت بۆشایی تێدابێت');
      return;
    }
    if (!expansion) {
      setShortcutError('تکایە دەقە تەواوەکە بنووسە (نموونە: السَّلَاْمُ عَلَیْکُم براکەم)');
      return;
    }

    const normalized = trigger.toLowerCase();
    const duplicate = shortcuts.find(
      (item) => item.shortcut.trim().toLowerCase() === normalized && item.id !== editingShortcutId
    );

    if (editingShortcutId) {
      const updated = shortcuts.map((item) =>
        item.id === editingShortcutId ? { ...item, shortcut: trigger, expansion } : item
      );
      onUpdate({ textShortcuts: updated });
      setEditingShortcutId(null);
    } else if (duplicate) {
      // Replace existing shortcut with same trigger cleanly
      const updated = shortcuts.map((item) =>
        item.id === duplicate.id ? { ...item, shortcut: trigger, expansion } : item
      );
      onUpdate({ textShortcuts: updated });
    } else {
      const nextItem: TextShortcut = {
        id: `sc_${Date.now()}`,
        shortcut: trigger,
        expansion,
      };
      onUpdate({ textShortcuts: [nextItem, ...shortcuts] });
    }

    setShortcutTrigger('');
    setShortcutExpansion('');
    setShortcutError(null);
  };

  const handleEditShortcut = (item: TextShortcut) => {
    setEditingShortcutId(item.id);
    setShortcutTrigger(item.shortcut);
    setShortcutExpansion(item.expansion);
    setShortcutError(null);
    setShowShortcuts(true);
  };

  const handleDeleteShortcut = (id: string) => {
    onUpdate({ textShortcuts: shortcuts.filter((s) => s.id !== id) });
    if (editingShortcutId === id) {
      setEditingShortcutId(null);
      setShortcutTrigger('');
      setShortcutExpansion('');
    }
  };

  const cardBg = isLightApp
    ? 'bg-white border-slate-200 text-slate-900'
    : 'bg-[#14171D] border-white/10 text-white';
  const panelBg = isLightApp
    ? 'bg-slate-50 border-slate-200'
    : 'bg-[#101216] border-white/10';
  const inputBg = isLightApp
    ? 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
    : 'bg-black/50 border-white/10 text-white placeholder:text-zinc-500';

  return (
    <div className="min-h-full flex flex-col pb-24" dir="rtl">
      <SubPageHeader title="پێشنیارکردن" onBack={onBack} isLightApp={isLightApp} />
      <div className="px-4 pt-3 space-y-5">
        <NotificationBanner
          enabled={settings.notificationsEnabled}
          onEnable={() => onUpdate({ notificationsEnabled: true })}
        />

        {[
          {
            title: 'پێشنیارکردنی ووشە',
            sub: 'پیشاندانی ووشە پێشنیارکراوەکان لەکاتی نووسیندا',
            val: settings.wordSuggestions,
            set: (v: boolean) => onUpdate({ wordSuggestions: v }),
          },
          {
            title: 'کورتکراوەکانی نووسین',
            sub: 'کاتێک کورتکراوەیەک دەنووسیت (نموونە: س)، ڕستە تەواوەکەی لە شریتی پێشنیارەکان پیشان دەدات',
            val: settings.textShortcutsEnabled ?? true,
            set: (v: boolean) => onUpdate({ textShortcutsEnabled: v }),
          },
          {
            title: 'تەواوکەری خۆکاری سیستەم',
            sub: 'پیشاندانی پێشنیاری تەواوکەری خۆکاری سیستەم',
            val: settings.autoComplete,
            set: (v: boolean) => onUpdate({ autoComplete: v }),
          },
          {
            title: 'خاڵبەندی بە دوگمەی بۆشایی',
            sub: 'بە دووجار دەستدان لە دوگمەی بۆشایی خاڵ یان هێمای کۆتایی ڕستە زیادەبێت',
            val: settings.doubleSpacePeriod,
            set: (v: boolean) => onUpdate({ doubleSpacePeriod: v }),
          },
          {
            title: 'فەرهەنگی ناوخۆیی بەرنامەکە',
            sub: 'پێشنیارکردنی ئەو ووشانەی لە فەرهەنگی ناوخۆیی بەرنامەکەدا پاشەکەوتکراون',
            val: settings.personalDictionaryEnabled,
            set: (v: boolean) => onUpdate({ personalDictionaryEnabled: v }),
          },
        ].map((row) => (
          <div key={row.title} className="flex items-center justify-between gap-3">
            <div className="flex-1">
              <div className="text-sm font-bold">{row.title}</div>
              <div className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{row.sub}</div>
            </div>
            <AppToggle checked={row.val} onChange={row.set} label={row.title} />
          </div>
        ))}

        {/* Custom Text Shortcuts Manager */}
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={() => setShowShortcuts((v) => !v)}
            className={`w-full rounded-2xl p-4 border text-right flex items-center justify-between transition-colors ${cardBg}`}
          >
            <div className="flex items-center gap-3">
              <KurdiIcon name="ic_text" className="w-5 h-5 text-[#9AC5FF] shrink-0" />
              <div>
                <div className="text-sm font-bold">کورتکراوە تایبەتەکان ({shortcuts.length})</div>
                <div className="text-xs text-zinc-400 mt-0.5">
                  دانان، دەستکاریکردن و سڕینەوەی کورتکراوەی تایبەتی خۆت (نموونە: س : السَّلَاْمُ عَلَیْکُم براکەم)
                </div>
              </div>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-zinc-400 shrink-0 transition-transform duration-200 ${
                showShortcuts ? 'rotate-180 text-[#9AC5FF]' : ''
              }`}
            />
          </button>

          {showShortcuts && (
            <div className={`rounded-2xl border p-4 space-y-3.5 ${panelBg}`}>
              <div className="space-y-2">
                <div className="grid grid-cols-12 gap-2">
                  <input
                    type="text"
                    value={shortcutTrigger}
                    onChange={(e) => {
                      setShortcutTrigger(e.target.value);
                      if (shortcutError) setShortcutError(null);
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveShortcut()}
                    placeholder="کورتکراوە (نموونە: س)"
                    className={`col-span-4 h-10 rounded-xl px-3 text-xs font-bold border outline-none focus:border-sky-400 ${inputBg}`}
                  />
                  <input
                    type="text"
                    value={shortcutExpansion}
                    onChange={(e) => {
                      setShortcutExpansion(e.target.value);
                      if (shortcutError) setShortcutError(null);
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveShortcut()}
                    placeholder="دەقی تەواو (نموونە: السَّلَاْمُ عَلَیْکُم براکەم)"
                    className={`col-span-8 h-10 rounded-xl px-3 text-xs border outline-none focus:border-sky-400 ${inputBg}`}
                  />
                </div>

                {shortcutError && (
                  <div className="text-[11px] font-semibold text-rose-400">{shortcutError}</div>
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveShortcut}
                    className="flex-1 h-10 px-4 rounded-xl bg-[#A4C9FF] hover:bg-[#90BDFF] text-[#051B3A] text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    {editingShortcutId ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>پاشەکەوتکردنی گۆڕانکاری</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        <span>زیادکردنی کورتکراوە</span>
                      </>
                    )}
                  </button>
                  {editingShortcutId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingShortcutId(null);
                        setShortcutTrigger('');
                        setShortcutExpansion('');
                        setShortcutError(null);
                      }}
                      className="h-10 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 text-xs font-bold"
                    >
                      پاشگەزبوونەوە
                    </button>
                  )}
                </div>
              </div>

              {/* Saved Shortcuts List */}
              {shortcuts.length === 0 ? (
                <div className="text-center py-4 text-xs text-zinc-500">
                  هیچ کورتکراوەیەک نییە، لە سەرەوە کورتکراوەی تایبەتی خۆت زیاد بکە
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto custom-scroll">
                  {shortcuts.map((item) => {
                    const isEditing = editingShortcutId === item.id;
                    return (
                      <div
                        key={item.id}
                        className={`flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl border transition-colors ${
                          isEditing
                            ? 'bg-sky-500/15 border-sky-400/50'
                            : isLightApp
                            ? 'bg-white border-slate-200'
                            : 'bg-white/[0.04] border-white/[0.08]'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="px-2.5 py-1 rounded-lg bg-[#0A5FA8]/25 text-[#9AC5FF] text-xs font-extrabold shrink-0">
                            {item.shortcut}
                          </span>
                          <span className="text-zinc-500 text-xs shrink-0">:</span>
                          <span className="text-xs font-medium truncate" title={item.expansion}>
                            {item.expansion}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleEditShortcut(item)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-sky-400 hover:bg-sky-500/10 transition-colors"
                            title="دەستکاریکردن"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteShortcut(item.id)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            title="سڕینەوە"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Personal Dictionary Manager */}
        <button
          type="button"
          onClick={() => setShowDict((v) => !v)}
          className={`w-full rounded-2xl p-4 border text-right flex items-center justify-between ${cardBg}`}
        >
          <div className="flex items-center gap-3">
            <KurdiIcon name="ic_dict" className="w-5 h-5 text-[#9AC5FF] shrink-0" />
            <div>
              <div className="text-sm font-bold">ڕێکخستنی فەرهەنگی ناوخۆیی</div>
              <div className="text-xs text-zinc-400">
                زیادکردن، بینین، یان سڕینەوەی ووشەکانی ناو فەرهەنگی ناوخۆیی ({settings.personalDictionary.length})
              </div>
            </div>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-zinc-400 shrink-0 transition-transform duration-200 ${
              showDict ? 'rotate-180 text-[#9AC5FF]' : ''
            }`}
          />
        </button>

        {showDict && (
          <div className={`rounded-2xl border p-4 space-y-3 ${panelBg}`}>
            <div className="flex gap-2">
              <input
                type="text"
                value={newWord}
                onChange={(e) => setNewWord(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addDictWord()}
                placeholder="ووشەیەکی نوێ بنووسە..."
                className={`flex-1 h-10 rounded-xl px-3 text-xs border outline-none focus:border-sky-400 ${inputBg}`}
              />
              <button
                type="button"
                onClick={addDictWord}
                className="h-10 px-4 rounded-xl bg-[#A4C9FF] text-[#051B3A] text-xs font-extrabold flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                زیادکردن
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {settings.personalDictionary.map((w) => (
                <div
                  key={w}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs ${
                    isLightApp
                      ? 'bg-white border-slate-200 text-slate-800'
                      : 'bg-white/5 border-white/10 text-white'
                  }`}
                >
                  <span>{w}</span>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdate({
                        personalDictionary: settings.personalDictionary.filter((x) => x !== w),
                      })
                    }
                    className="text-zinc-400 hover:text-rose-400"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// 5. More Settings Screen matching Screenshot 23
interface MoreSettingsProps extends BaseSubProps {
  onImportSettings: (data: Partial<KeyboardSettings>) => void;
  onResetAll: () => void;
}

export const MoreSettingsScreen: React.FC<MoreSettingsProps> = ({
  settings,
  onUpdate,
  onBack,
  isLightApp,
  onImportSettings,
  onResetAll,
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const cycleAppTheme = () => {
    const order: AppThemeMode[] = ['amoled', 'dark', 'light'];
    const next = order[(order.indexOf(settings.appTheme) + 1) % order.length];
    onUpdate({ appTheme: next });
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kurdikeyboard-backup.json';
    a.click();
    URL.revokeObjectURL(url);
    setStatusMsg('فایلی پاشەکەوتکردن بە سەرکەوتوویی دابەزێنرا.');
    window.setTimeout(() => setStatusMsg(null), 3000);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        onImportSettings(parsed);
        setStatusMsg('ڕێکخستنەکان بە سەرکەوتوویی گەڕێنرانەوە.');
      } catch {
        setStatusMsg('فایلەکە دروست نییە.');
      }
      window.setTimeout(() => setStatusMsg(null), 3000);
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-full flex flex-col pb-24" dir="rtl">
      <SubPageHeader title="ڕێکخستنی زیاتر" onBack={onBack} isLightApp={isLightApp} />
      <div className="px-4 pt-3 space-y-5">
        <NotificationBanner
          enabled={settings.notificationsEnabled}
          onEnable={() => onUpdate({ notificationsEnabled: true })}
        />

        {statusMsg && (
          <div className="rounded-2xl bg-emerald-500/15 border border-emerald-500/30 p-3 text-xs font-bold text-emerald-300 text-center">
            {statusMsg}
          </div>
        )}

        {/* Official 5-Language App UI Selector (Sorani / Kurmanji / English / Arabic / Persian) */}
        <div className="py-2.5 border-b border-white/5 space-y-3">
          <div className="flex items-center gap-3">
            <KurdiIcon name="ic_language" className="w-5 h-5 text-zinc-400 shrink-0" />
            <div className="text-right">
              <div className="text-sm font-bold">زمانی ڕووکاری بەرنامە</div>
              <div className="text-xs text-zinc-400 mt-0.5">
                کوردی سۆرانی · Kurmancî · English · العربية · فارسی
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { code: 'ckb', label: 'کوردی سۆرانی' },
                { code: 'kmr', label: 'Kurmancî' },
                { code: 'en', label: 'English' },
                { code: 'ar', label: 'العربية' },
                { code: 'fa', label: 'فارسی' },
              ] as { code: AppLanguageCode; label: string }[]
            ).map((opt) => {
              const active = settings.appLanguage === opt.code;
              return (
                <button
                  key={opt.code}
                  type="button"
                  onClick={() => onUpdate({ appLanguage: opt.code })}
                  className={`h-9 px-2 rounded-xl text-xs font-bold transition-all border ${
                    active
                      ? 'bg-[#A4C9FF] text-[#051B3A] border-[#A4C9FF]'
                      : isLightApp
                      ? 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      : 'bg-[#14171D] text-zinc-300 border-white/10 hover:bg-white/[0.07]'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={cycleAppTheme}
          className="w-full py-2.5 flex items-center justify-between border-b border-white/5"
        >
          <div className="flex items-center gap-3">
            <KurdiIcon name="ic_themes" className="w-5 h-5 text-zinc-400" />
            <div className="text-right">
              <div className="text-sm font-bold">ڕووکاری ڕێکخستنەکان</div>
              <div className="text-xs text-zinc-400 mt-0.5">
                {settings.appTheme === 'amoled'
                  ? 'تاریکی تەواو (AMOLED)'
                  : settings.appTheme === 'dark'
                  ? 'تاریک'
                  : 'ڕووناک'}
              </div>
            </div>
          </div>
        </button>

        <div className="flex items-center justify-between py-2 border-b border-white/5">
          <div>
            <div className="text-sm font-bold">بەشی سەرەوە (شریتی ئامرازەکان)</div>
            <div className="text-xs text-zinc-400 mt-0.5">
              پیشاندانی شریتی کۆپی، بڕین، لکاندن و لەبەرگیراوەکان
            </div>
          </div>
          <AppToggle
            checked={settings.showTopToolbar}
            onChange={(v) => onUpdate({ showTopToolbar: v })}
            label="بەشی سەرەوە"
          />
        </div>

        <button
          type="button"
          onClick={handleExport}
          className="w-full py-2.5 flex items-center justify-between border-b border-white/5 text-right"
        >
          <div className="flex items-center gap-3">
            <KurdiIcon name="ic_backup" className="w-5 h-5 text-zinc-400" />
            <div>
              <div className="text-sm font-bold flex items-center gap-2">
                <span>پاشەکەوتکردنی داتاکان</span>
                <ProBadge unlocked={settings.proUnlocked} />
              </div>
              <div className="text-xs text-zinc-400 mt-0.5">
                هەڵگرتنی ڕێکخستن و دەستکاریکردنەکانی تەختەکلیل
              </div>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="w-full py-2.5 flex items-center justify-between border-b border-white/5 text-right"
        >
          <div className="flex items-center gap-3">
            <KurdiIcon name="ic_download" className="w-5 h-5 text-zinc-400" />
            <div>
              <div className="text-sm font-bold flex items-center gap-2">
                <span>گێڕانەوەی داتاکان</span>
                <ProBadge unlocked={settings.proUnlocked} />
              </div>
              <div className="text-xs text-zinc-400 mt-0.5">
                گێڕانەوەی ڕێکخستن و زیادکراوە هەڵگیراوەکان لە ڕێی فایلی پاشەکەوتکراوەوە
              </div>
            </div>
          </div>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          onChange={handleImportFile}
          className="hidden"
        />

        <div className="flex items-center justify-between py-2 border-b border-white/5">
          <div className="flex items-center gap-3">
            <KurdiIcon name="ic_keyboards" className="w-5 h-5 text-zinc-400" />
            <div>
              <div className="text-sm font-bold">تەختەکلیلی دەرەکی</div>
              <div className="text-xs text-zinc-400 mt-0.5">
                هاوتاکردنی نووسین لەگەڵ تەختەکلیلی کۆمپیوتەر
              </div>
            </div>
          </div>
          <AppToggle
            checked={settings.physicalKeyboardSync}
            onChange={(v) => onUpdate({ physicalKeyboardSync: v })}
            label="تەختەکلیلی دەرەکی"
          />
        </div>

        <button
          type="button"
          onClick={onResetAll}
          className="w-full h-11 rounded-2xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/25 text-xs font-bold flex items-center justify-center gap-2"
        >
          <KurdiIcon name="ic_restart_alt" className="w-4 h-4" />
          <span>گەڕاندنەوەی هەموو ڕێکخستنەکان بۆ بنەڕەتی</span>
        </button>
      </div>
    </div>
  );
};

// 6. Official FAQ & Guide Screen (from strings_50fa2e0a / strings_f4eb91d2 / strings_350ef3fc)
export const FaqScreen: React.FC<{
  settings: KeyboardSettings;
  onBack: () => void;
  isLightApp: boolean;
}> = ({ settings, onBack, isLightApp }) => {
  const lang = settings.appLanguage || 'ckb';
  const dir = getAppDirection(lang);
  const items = getFaqItems(lang);
  const [openId, setOpenId] = useState<string>(items[0]?.id || 'faq_1');

  return (
    <div className="min-h-full flex flex-col pb-24" dir={dir}>
      <SubPageHeader
        title={tOfficial(lang, 'faq__screen_title', 'ڕێنمایی و پرسیارە باوەکان (FAQ)')}
        onBack={onBack}
        isLightApp={isLightApp}
      />
      <div className="px-4 pt-3 space-y-4">
        {/* Banner Card */}
        <div
          className={`rounded-3xl p-4 border flex items-center gap-3.5 ${
            isLightApp
              ? 'bg-sky-50 border-sky-200 text-slate-900'
              : 'bg-gradient-to-br from-[#0E243D] to-[#0A1320] border-sky-400/20 text-white'
          }`}
        >
          <KurdiLogo className="w-12 h-12 shrink-0 drop-shadow-md" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-extrabold">
              {tOfficial(lang, 'faq__banner_title', 'زانیاری گشتی و بەکارهێنان')}
            </div>
            <div className="text-xs text-zinc-400 mt-0.5">
              {tOfficial(lang, 'settings__home__display_name', 'تەختەکلیلی کوردی')}
            </div>
          </div>
        </div>

        {/* Accordion Q&As */}
        <div className="space-y-2.5">
          {items.map((item, index) => {
            const isOpen = openId === item.id;
            return (
              <div
                key={item.id}
                className={`rounded-2xl border overflow-hidden transition-colors ${
                  isLightApp
                    ? 'bg-white border-slate-200'
                    : 'bg-[#12151C] border-white/[0.08]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setOpenId(isOpen ? '' : item.id)}
                  className="w-full px-4 py-3.5 flex items-center justify-between gap-3 text-start"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-[#0A5FA8]/25 text-[#9AC5FF] text-xs font-extrabold flex items-center justify-center shrink-0 tabular-nums">
                      {index + 1}
                    </span>
                    <span className="text-sm font-bold leading-snug">{item.question}</span>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-zinc-400 shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-[#9AC5FF]' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 pt-0.5 text-xs text-zinc-400 leading-relaxed border-t border-white/5">
                    {item.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Official Social Tutorial Buttons */}
        <div className="pt-2 space-y-2">
          <a
            href="https://www.youtube.com"
            target="_blank"
            rel="noreferrer"
            className="w-full h-11 rounded-2xl bg-[#FF0000]/15 hover:bg-[#FF0000]/25 border border-red-500/25 text-red-400 text-xs font-extrabold flex items-center justify-center gap-2 transition-colors"
          >
            <KurdiIcon name="ic_youtube" className="w-5 h-5" />
            <span>{tOfficial(lang, 'faq__button_watch_youtube', 'بینینی فێرکاری لە یوتوب')}</span>
          </a>
          <div className="grid grid-cols-2 gap-2">
            <a
              href="https://www.facebook.com"
              target="_blank"
              rel="noreferrer"
              className={`h-10 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 transition-colors ${
                isLightApp
                  ? 'bg-white border-slate-200 text-blue-600 hover:bg-slate-50'
                  : 'bg-[#12151C] border-white/10 text-blue-400 hover:bg-white/[0.06]'
              }`}
            >
              <KurdiIcon name="ic_facebook" className="w-4 h-4" />
              <span>{tOfficial(lang, 'faq__social_facebook', 'فەیسبووک')}</span>
            </a>
            <a
              href="https://t.me"
              target="_blank"
              rel="noreferrer"
              className={`h-10 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 transition-colors ${
                isLightApp
                  ? 'bg-white border-slate-200 text-sky-600 hover:bg-slate-50'
                  : 'bg-[#12151C] border-white/10 text-sky-400 hover:bg-white/[0.06]'
              }`}
            >
              <KurdiIcon name="ic_telegram" className="w-4 h-4" />
              <span>تێلیگرام</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

// 7. About Screen
export const AboutScreen: React.FC<{ onBack: () => void; isLightApp: boolean }> = ({
  onBack,
  isLightApp,
}) => (
  <div className="min-h-full flex flex-col pb-24" dir="rtl">
    <SubPageHeader title="دەربارە" onBack={onBack} isLightApp={isLightApp} />
    <div className="px-4 pt-6 space-y-5 text-center">
      <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-[#0A599C]/30 to-[#05294A]/40 mx-auto flex items-center justify-center shadow-xl border border-sky-400/20 p-2">
        <KurdiLogo className="w-20 h-20 drop-shadow-xl" />
      </div>
      <div>
        <h3 className="text-xl font-extrabold">تەختەکلیلی کوردی</h3>
        <p className="text-xs text-zinc-400 mt-1" dir="ltr">
          www.kurdikebord.io
        </p>
      </div>
      <p className="text-xs text-zinc-400 leading-relaxed max-w-sm mx-auto">
        تەختەکلیلێکی پێشکەوتووی کوردی سۆرانی و فرەزمان کە پشتگیری تەواوی ڕووکارەکان، زیکر و دوعا
        قورئانییەکان، کاومۆجی، جوانکاری نووسین، لەبەرگیراوەکان، ڕیزبەندی تایبەت، وەرگێڕانی خێرا و
        وەڵامدەرەوەی زیرەکی (AI) دەکات.
      </p>
    </div>
  </div>
);

// 8. Pro Features Modal
export const ProModal: React.FC<{
  open: boolean;
  unlocked: boolean;
  onToggleUnlock: () => void;
  onClose: () => void;
}> = ({ open, unlocked, onToggleUnlock, onClose }) => {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
      dir="rtl"
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-[#10131A] border border-amber-400/25 p-6 space-y-5 text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <PremiumBadgeIcon className="w-11 h-11 shrink-0 drop-shadow-md" />
            <div>
              <h3 className="text-base font-extrabold">وەشانی پێشکەوتوو (PRO)</h3>
              <p className="text-xs text-zinc-400">هەموو تایبەتمەندییەکان بەردەست بکە</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <ul className="space-y-2.5 text-xs text-zinc-200">
          {[
            'کردنەوەی هەموو ڕووکارە نیۆن و کلاسیکەکانی فرۆشگا',
            'کردنەوەی هەر ٩ شێوازی دوگمە (شوشەیی، نەرم، گەشاوەی نیۆن)',
            'دروستکەری ڕووکاری تایبەت بە ڕەنگی دڵخوازی خۆت',
            'ئاماژەکانی دوگمەی بۆشایی و سڕینەوەی خێرای ووشە',
            'پاشەکەوتکردن و گێڕانەوەی تەواوی داتاکان',
          ].map((feat) => (
            <li key={feat} className="flex items-center gap-2.5">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <Check className="w-3 h-3" />
              </span>
              <span>{feat}</span>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => {
            onToggleUnlock();
            onClose();
          }}
          className={`w-full h-12 rounded-2xl font-extrabold text-sm transition-all active:scale-95 ${
            unlocked
              ? 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
              : 'bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
          }`}
        >
          {unlocked ? 'گەڕانەوە بۆ دۆخی ئاسایی' : 'چالاککردنی وەشانی پێشکەوتوو (تاقیکاری)'}
        </button>
      </div>
    </div>
  );
};
