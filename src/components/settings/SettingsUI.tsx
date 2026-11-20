import React from 'react';
import { ArrowRight, BellOff, Check } from 'lucide-react';
import { KeyboardTheme } from '../../types/keyboard';
import { KurdiIcon } from '../icons/KurdiIcons';

interface AppToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label?: string;
}

export const AppToggle: React.FC<AppToggleProps> = ({
  checked,
  onChange,
  disabled = false,
  label,
}) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative w-[52px] h-[30px] rounded-full transition-colors shrink-0 flex items-center px-[3px] focus-visible:outline-2 focus-visible:outline-sky-400 ${
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
      } ${
        checked
          ? 'bg-[#9AC5FF]'
          : 'bg-[#1D1F24] border-2 border-[#6C707A] dark:bg-[#1D1F24]'
      }`}
      dir="ltr"
    >
      <span
        className={`block rounded-full transition-all duration-200 ${
          checked
            ? 'w-[22px] h-[22px] translate-x-[22px] bg-[#0B3263]'
            : 'w-[16px] h-[16px] translate-x-[2px] bg-[#8E939E]'
        }`}
      />
    </button>
  );
};

interface NotificationBannerProps {
  enabled: boolean;
  onEnable: () => void;
}

export const NotificationBanner: React.FC<NotificationBannerProps> = ({
  enabled,
  onEnable,
}) => {
  if (enabled) return null;
  return (
    <div
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#D32F2F] via-[#B71C1C] to-[#8E1515] p-5 text-center text-white shadow-lg border border-red-400/20"
      dir="rtl"
    >
      <BellOff className="w-28 h-28 text-white/10 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="relative z-10 space-y-2.5">
        <h3 className="text-lg font-extrabold tracking-tight">ئاگادارکردنەوە کوژاوەتەوە</h3>
        <p className="text-xs leading-relaxed text-red-50/90 max-w-xs mx-auto">
          ئاگادارکردنەوەکان کارا بکە بۆ وەرگرتنی زانیاری لەکاتی بڵاوکردنەوەی ڕووکار، فۆنت و وەشانی
          نوێی بەرنامەکە!
        </p>
        <button
          type="button"
          onClick={onEnable}
          className="w-full h-11 mt-1 rounded-xl bg-white/20 hover:bg-white/30 active:scale-[0.98] border border-white/25 text-sm font-bold text-white transition-all"
        >
          کاراکردن
        </button>
      </div>
    </div>
  );
};

export const ProBadge: React.FC<{ unlocked?: boolean }> = ({ unlocked }) => {
  if (unlocked) return null;
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-gradient-to-r from-[#2D45A8] to-[#5674E8] text-[9.5px] font-extrabold text-white tracking-wider uppercase leading-none">
      PRO
    </span>
  );
};

interface SubPageHeaderProps {
  title: string;
  onBack: () => void;
  leftAction?: React.ReactNode;
  isLightApp?: boolean;
}

export const SubPageHeader: React.FC<SubPageHeaderProps> = ({
  title,
  onBack,
  leftAction,
  isLightApp,
}) => {
  return (
    <div
      className={`sticky top-0 z-20 flex items-center justify-between px-4 h-14 backdrop-blur-md border-b ${
        isLightApp
          ? 'bg-slate-50/90 border-slate-200 text-slate-900'
          : 'bg-black/90 border-white/5 text-white'
      }`}
      dir="rtl"
    >
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onBack}
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors ${
            isLightApp ? 'hover:bg-slate-200' : 'hover:bg-white/10'
          }`}
          aria-label="گەڕانەوە"
        >
          <ArrowRight className="w-5 h-5" />
        </button>
        <h2 className="text-base font-bold truncate">{title}</h2>
      </div>
      {leftAction && <div className="shrink-0">{leftAction}</div>}
    </div>
  );
};

interface MiniKeyboardPreviewProps {
  theme: KeyboardTheme;
  selected?: boolean;
  detailed?: boolean;
  showProCorner?: boolean;
  proUnlocked?: boolean;
  showLabel?: boolean;
}

const PREVIEW_ROW_NUM = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
const PREVIEW_ROW_1 = ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'];
const PREVIEW_ROW_2 = ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'];
const PREVIEW_ROW_3 = ['Z', 'X', 'C', 'V', 'B', 'N', 'M'];

export const MiniKeyboardPreview: React.FC<MiniKeyboardPreviewProps> = ({
  theme,
  selected = false,
  detailed = false,
  showProCorner = false,
  proUnlocked = false,
  showLabel = false,
}) => {
  const bw = theme.keyBorderWidth ?? (theme.hasKeyBorder ? 1 : 0);
  const keyBorder = bw > 0 ? `${Math.min(bw, 1.5)}px solid ${theme.keyBorder}` : 'none';
  const radius = detailed ? `${Math.min(theme.borderRadius, 8)}px` : '5px';

  return (
    <div
      className="relative w-full overflow-hidden select-none"
      style={{
        backgroundColor: theme.bg,
        borderRadius: detailed ? '16px' : '14px',
        padding: detailed ? '10px 8px' : '10px 6px',
      }}
      dir="ltr"
    >
      {selected && (
        <div className="absolute top-2 left-2 z-10 w-5 h-5 rounded-full bg-[#9AC5FF] text-[#051B3A] flex items-center justify-center shadow">
          <Check className="w-3.5 h-3.5 stroke-[3]" />
        </div>
      )}

      {showProCorner && !proUnlocked && (
        <div className="absolute top-0 right-0 z-10 bg-[#9AC5FF] text-[#051B3A] text-[9px] font-black px-2 py-0.5 rounded-bl-lg">
          PRO
        </div>
      )}

      <div className={`flex flex-col ${detailed ? 'gap-1.5' : 'gap-1'}`}>
        {detailed && (
          <div className="flex gap-1">
            {PREVIEW_ROW_NUM.map((n) => (
              <span
                key={n}
                className="flex-1 h-7 flex items-center justify-center text-[11px] font-bold"
                style={{
                  backgroundColor: theme.keyBg,
                  color: theme.keyText,
                  border: keyBorder,
                  borderRadius: radius,
                  boxShadow: theme.keyShadow,
                }}
              >
                {n}
              </span>
            ))}
          </div>
        )}

        <div className="flex gap-1">
          {PREVIEW_ROW_1.map((k) => (
            <span
              key={k}
              className={`flex-1 flex items-center justify-center font-bold ${
                detailed ? 'h-8 text-xs' : 'h-4 text-[7px]'
              }`}
              style={{
                backgroundColor: theme.keyBg,
                color: theme.keyText,
                border: keyBorder,
                borderRadius: radius,
                boxShadow: theme.keyShadow,
              }}
            >
              {k}
            </span>
          ))}
        </div>

        <div className={`flex gap-1 ${detailed ? 'px-3' : 'px-1.5'}`}>
          {PREVIEW_ROW_2.map((k) => (
            <span
              key={k}
              className={`flex-1 flex items-center justify-center font-bold ${
                detailed ? 'h-8 text-xs' : 'h-4 text-[7px]'
              }`}
              style={{
                backgroundColor: theme.keyBg,
                color: theme.keyText,
                border: keyBorder,
                borderRadius: radius,
                boxShadow: theme.keyShadow,
              }}
            >
              {k}
            </span>
          ))}
        </div>

        <div className="flex gap-1">
          <span
            className={`flex items-center justify-center font-bold ${
              detailed ? 'h-8 w-10 text-xs' : 'h-4 w-5 text-[7px]'
            }`}
            style={{
              backgroundColor: theme.shiftBg || theme.specialKeyBg,
              color: theme.shiftText || theme.specialKeyText,
              border: keyBorder,
              borderRadius: radius,
            }}
          >
            ↑
          </span>
          {PREVIEW_ROW_3.map((k) => (
            <span
              key={k}
              className={`flex-1 flex items-center justify-center font-bold ${
                detailed ? 'h-8 text-xs' : 'h-4 text-[7px]'
              }`}
              style={{
                backgroundColor: theme.keyBg,
                color: theme.keyText,
                border: keyBorder,
                borderRadius: radius,
                boxShadow: theme.keyShadow,
              }}
            >
              {k}
            </span>
          ))}
          <span
            className={`flex items-center justify-center font-bold ${
              detailed ? 'h-8 w-10 text-xs' : 'h-4 w-5 text-[7px]'
            }`}
            style={{
              backgroundColor: theme.backspaceBg || theme.specialKeyBg,
              color: theme.backspaceText || theme.specialKeyText,
              border: keyBorder,
              borderRadius: radius,
            }}
          >
            ⌫
          </span>
        </div>

        <div className="flex gap-1">
          <span
            className={`flex items-center justify-center font-bold ${
              detailed ? 'h-8 w-12 text-[10px]' : 'h-4 w-7 text-[6px]'
            }`}
            style={{
              backgroundColor: theme.symbolsBg || theme.specialKeyBg,
              color: theme.symbolsText || theme.specialKeyText,
              border: keyBorder,
              borderRadius: radius,
            }}
          >
            !#1
          </span>
          <span
            className={`flex-1 flex items-center justify-center font-medium ${
              detailed ? 'h-8 text-[10px]' : 'h-4 text-[6px]'
            }`}
            style={{
              backgroundColor: theme.spaceBg,
              color: theme.spaceText || theme.secondaryText,
              border: keyBorder,
              borderRadius: radius,
            }}
          >
            {detailed ? '‹ کوردی ›' : showLabel ? theme.nameKu : ''}
          </span>
          <span
            className={`flex items-center justify-center font-bold ${
              detailed ? 'h-8 w-12 text-xs' : 'h-4 w-7 text-[7px]'
            }`}
            style={{
              backgroundColor: theme.enterBg,
              color: theme.enterText,
              border: theme.enterBorder ? `1px solid ${theme.enterBorder}` : 'none',
              borderRadius: radius,
            }}
          >
            ↵
          </span>
        </div>
      </div>
    </div>
  );
};

export const FloatingKeyboardFAB: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-13 h-13 rounded-2xl bg-[#A4C9FF] hover:bg-[#B8D5FF] text-[#051B3A] shadow-xl shadow-sky-500/20 flex items-center justify-center active:scale-95 transition-transform"
    title="تاقیکردنەوەی تەختەکلیل"
  >
    <KurdiIcon name="ic_keyboards" className="w-6 h-6" />
  </button>
);
