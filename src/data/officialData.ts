import React from 'react';
import officialStringsRaw from './generated/officialStrings.json';
import { AppLanguageCode, KeyboardTheme, KeyShapeStyle } from '../types/keyboard';

const OFFICIAL_STRINGS = officialStringsRaw as Record<AppLanguageCode, Record<string, string>>;

export function tOfficial(
  lang: AppLanguageCode | string | undefined,
  key: string,
  fallback: string
): string {
  const code: AppLanguageCode = lang === 'kmr' || lang === 'en' ? lang : 'ckb';
  const val =
    OFFICIAL_STRINGS[code]?.[key] ||
    OFFICIAL_STRINGS.ckb?.[key] ||
    OFFICIAL_STRINGS.en?.[key];
  return val || fallback;
}

export function getAppDirection(lang: AppLanguageCode | string | undefined): 'rtl' | 'ltr' {
  return lang === 'en' || lang === 'kmr' ? 'ltr' : 'rtl';
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export function getFaqItems(lang: AppLanguageCode | string | undefined): FaqItem[] {
  return [1, 2, 3, 4, 5].map((n) => ({
    id: `faq_${n}`,
    question: tOfficial(lang, `faq__q${n}_question`, `پرسیاری ${n}`),
    answer: tOfficial(lang, `faq__q${n}_answer`, ''),
  }));
}

export interface KeyShapeOption {
  id: KeyShapeStyle;
  stringKey: string;
  isPro?: boolean;
}

export const KEY_SHAPE_OPTIONS: KeyShapeOption[] = [
  { id: 'default', stringKey: 'enum__key_shape_style__default' },
  { id: 'flat', stringKey: 'enum__key_shape_style__flat' },
  { id: 'three_dimensional', stringKey: 'enum__key_shape_style__three_dimensional' },
  { id: 'pill_rounded', stringKey: 'enum__key_shape_style__pill_rounded' },
  { id: 'glass_crystal', stringKey: 'enum__key_shape_style__glass_crystal', isPro: true },
  { id: 'outline_only', stringKey: 'enum__key_shape_style__outline_only' },
  { id: 'borderless', stringKey: 'enum__key_shape_style__borderless' },
  { id: 'soft_neumorphic', stringKey: 'enum__key_shape_style__soft_neumorphic', isPro: true },
  { id: 'animated_glow', stringKey: 'enum__key_shape_style__animated_glow', isPro: true },
];

export function getKeyShapeStyleProps(
  shape: KeyShapeStyle,
  theme: KeyboardTheme,
  baseBg: string,
  baseBorder: string,
  baseShadow: string | undefined,
  isEnter: boolean,
  isPressed: boolean
): { style: React.CSSProperties; className: string } {
  const isLight = Boolean(theme.isLight);
  const bg = isPressed ? theme.keyHoverBg : baseBg;
  const radius = theme.borderRadius ?? 8;

  switch (shape) {
    case 'flat':
      return {
        className: '',
        style: {
          backgroundColor: bg,
          borderRadius: `${Math.min(radius, 6)}px`,
          border: 'none',
          boxShadow: 'none',
        },
      };

    case 'three_dimensional':
      return {
        className: '',
        style: {
          backgroundColor: bg,
          borderRadius: `${Math.max(radius, 8)}px`,
          border: baseBorder !== 'none' ? baseBorder : `1px solid ${isLight ? 'rgba(15,23,42,0.14)' : 'rgba(255,255,255,0.12)'}`,
          boxShadow: isPressed
            ? `0 1px 0 ${isLight ? 'rgba(15,23,42,0.22)' : 'rgba(0,0,0,0.85)'}`
            : `0 3px 0 ${isLight ? 'rgba(15,23,42,0.2)' : 'rgba(0,0,0,0.8)'}, inset 0 1px 0 ${isLight ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.16)'}`,
          transform: isPressed ? 'translateY(2px)' : undefined,
        },
      };

    case 'pill_rounded':
      return {
        className: '',
        style: {
          backgroundColor: bg,
          borderRadius: '9999px',
          border: baseBorder,
          boxShadow: baseShadow,
        },
      };

    case 'glass_crystal':
      return {
        className: 'backdrop-blur-md',
        style: {
          backgroundColor: isEnter
            ? bg
            : isLight
            ? 'rgba(255,255,255,0.58)'
            : 'rgba(255,255,255,0.09)',
          borderRadius: `${Math.max(radius, 10)}px`,
          border: `1px solid ${isLight ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.22)'}`,
          boxShadow: `inset 0 1px 1px ${isLight ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.25)'}, 0 2px 6px rgba(0,0,0,0.18)`,
        },
      };

    case 'outline_only':
      return {
        className: '',
        style: {
          backgroundColor: isEnter ? bg : isPressed ? `${theme.accent}22` : 'transparent',
          borderRadius: `${radius}px`,
          border: isEnter
            ? baseBorder
            : `1.5px solid ${theme.hasKeyBorder ? theme.keyBorder : `${theme.accent}88`}`,
          boxShadow: 'none',
        },
      };

    case 'borderless':
      return {
        className: '',
        style: {
          backgroundColor: isEnter ? bg : isPressed ? theme.keyHoverBg : 'transparent',
          borderRadius: `${radius}px`,
          border: 'none',
          boxShadow: 'none',
        },
      };

    case 'soft_neumorphic':
      return {
        className: '',
        style: {
          backgroundColor: bg,
          borderRadius: `${Math.max(radius, 11)}px`,
          border: 'none',
          boxShadow: isPressed
            ? isLight
              ? 'inset 2px 2px 4px rgba(15,23,42,0.14), inset -2px -2px 4px rgba(255,255,255,0.8)'
              : 'inset 2px 2px 5px rgba(0,0,0,0.75), inset -1px -1px 3px rgba(255,255,255,0.06)'
            : isLight
            ? '2px 2px 5px rgba(15,23,42,0.12), -2px -2px 5px rgba(255,255,255,0.85)'
            : '2px 2px 6px rgba(0,0,0,0.65), -1px -1px 4px rgba(255,255,255,0.07)',
        },
      };

    case 'animated_glow':
      return {
        className: 'kb-key-glow',
        style: {
          backgroundColor: bg,
          borderRadius: `${Math.max(radius, 9)}px`,
          border: `1px solid ${theme.accent}99`,
          boxShadow: `0 0 10px ${theme.accent}44`,
          ['--kb-glow' as string]: theme.accent,
        },
      };

    case 'default':
    default:
      return {
        className: '',
        style: {
          backgroundColor: bg,
          borderRadius: `${radius}px`,
          border: baseBorder,
          boxShadow: baseShadow,
        },
      };
  }
}
