import React, { useEffect, useState } from 'react';
import { EmojiStyleMode } from '../../types/keyboard';

const FB_CDN_BASE = 'https://cdn.jsdelivr.net/npm/emoji-datasource-facebook@16.0.0/img/facebook/64';

// Exact 51 emojis where emoji-datasource-facebook@16.0.0 has_img_facebook === false.
// Pre-skipping them avoids HTTP 404 / net::ERR_BLOCKED_BY_ORB in Android WebView and falls back instantaneously.
const MISSING_FACEBOOK_BASE_CODES = [
  '0023-fe0f-20e3', '002a-fe0f-20e3', '0030-fe0f-20e3', '0031-fe0f-20e3',
  '0032-fe0f-20e3', '0033-fe0f-20e3', '0034-fe0f-20e3', '0035-fe0f-20e3',
  '0036-fe0f-20e3', '0037-fe0f-20e3', '0038-fe0f-20e3', '0039-fe0f-20e3',
  '00a9-fe0f', '00ae-fe0f', '1f1e8-1f1f6', '1f344-200d-1f7eb', '1f34b-200d-1f7e9',
  '1f3c3-200d-2640-fe0f-200d-27a1-fe0f', '1f3c3-200d-2642-fe0f-200d-27a1-fe0f',
  '1f3c3-200d-27a1-fe0f', '1f426-200d-1f525', '1f441-fe0f-200d-1f5e8-fe0f',
  '1f468-200d-1f9af-200d-27a1-fe0f', '1f468-200d-1f9bc-200d-27a1-fe0f',
  '1f468-200d-1f9bd-200d-27a1-fe0f', '1f469-200d-1f9af-200d-27a1-fe0f',
  '1f469-200d-1f9bc-200d-27a1-fe0f', '1f469-200d-1f9bd-200d-27a1-fe0f',
  '1f642-200d-2194-fe0f', '1f642-200d-2195-fe0f',
  '1f6b6-200d-2640-fe0f-200d-27a1-fe0f', '1f6b6-200d-2642-fe0f-200d-27a1-fe0f',
  '1f6b6-200d-27a1-fe0f', '1f9ce-200d-2640-fe0f-200d-27a1-fe0f',
  '1f9ce-200d-2642-fe0f-200d-27a1-fe0f', '1f9ce-200d-27a1-fe0f',
  '1f9d1-200d-1f9af-200d-27a1-fe0f', '1f9d1-200d-1f9bc-200d-27a1-fe0f',
  '1f9d1-200d-1f9bd-200d-27a1-fe0f', '1f9d1-200d-1f9d1-200d-1f9d2',
  '1f9d1-200d-1f9d1-200d-1f9d2-200d-1f9d2', '1f9d1-200d-1f9d2-200d-1f9d2',
  '1f9d1-200d-1f9d2', '1fa89', '1fa8f', '1fabe', '1fac6', '1fadc', '1fadf',
  '1fae9', '26d3-fe0f-200d-1f4a5',
];

// Cache failed image codes in memory so missing/offline glyphs fall back instantaneously with zero retries
const failedFacebookCodes = new Set<string>(
  MISSING_FACEBOOK_BASE_CODES.flatMap((code) =>
    code.includes('-fe0f') ? [code, code.replace(/-fe0f/g, '')] : [code]
  )
);

export function emojiToHexCode(emoji: string): string {
  const parts: string[] = [];
  for (const ch of Array.from(emoji)) {
    const cp = ch.codePointAt(0);
    if (cp !== undefined) {
      parts.push(cp.toString(16).toLowerCase().padStart(4, '0'));
    }
  }
  return parts.join('-');
}

function getAlternativeHexCode(code: string): string | null {
  if (code.includes('-fe0f')) {
    return code.replace(/-fe0f/g, '');
  }
  // Common single-codepoint BMP symbols (e.g. heart 2764 -> 2764-fe0f)
  if (!code.includes('-') && code.length <= 4) {
    return `${code}-fe0f`;
  }
  return null;
}

interface EmojiGlyphProps {
  emoji: string;
  styleMode?: EmojiStyleMode;
  sizePx?: number;
  className?: string;
}

export const EmojiGlyph: React.FC<EmojiGlyphProps> = React.memo(
  ({ emoji, styleMode = 'system', sizePx = 24, className = '' }) => {
    const primaryCode = emojiToHexCode(emoji);
    const [activeCode, setActiveCode] = useState<string>(primaryCode);
    const [useFallbackText, setUseFallbackText] = useState<boolean>(() => {
      if (styleMode !== 'facebook') return true;
      if (!failedFacebookCodes.has(primaryCode)) return false;
      const alt = getAlternativeHexCode(primaryCode);
      return !(alt && !failedFacebookCodes.has(alt));
    });

    useEffect(() => {
      if (styleMode !== 'facebook') {
        setUseFallbackText(true);
        return;
      }
      if (failedFacebookCodes.has(primaryCode)) {
        const alt = getAlternativeHexCode(primaryCode);
        if (alt && !failedFacebookCodes.has(alt)) {
          setActiveCode(alt);
          setUseFallbackText(false);
        } else {
          setUseFallbackText(true);
        }
        return;
      }
      setActiveCode(primaryCode);
      setUseFallbackText(false);
    }, [emoji, primaryCode, styleMode]);

    if (styleMode === 'facebook' && !useFallbackText && activeCode) {
      return (
        <img
          src={`${FB_CDN_BASE}/${activeCode}.png`}
          alt={emoji}
          width={sizePx}
          height={sizePx}
          loading="lazy"
          decoding="async"
          draggable={false}
          referrerPolicy="no-referrer"
          onError={() => {
            failedFacebookCodes.add(activeCode);
            if (activeCode === primaryCode) {
              const alt = getAlternativeHexCode(primaryCode);
              if (alt && !failedFacebookCodes.has(alt)) {
                setActiveCode(alt);
                return;
              }
            }
            setUseFallbackText(true);
          }}
          style={{ width: `${sizePx}px`, height: `${sizePx}px` }}
          className={`inline-block object-contain select-none pointer-events-none ${className}`}
        />
      );
    }

    const cssClass = `emoji-style-${styleMode || 'system'}`;
    return (
      <span
        style={{ fontSize: `${sizePx}px`, lineHeight: 1 }}
        className={`inline-flex items-center justify-center leading-none select-none ${cssClass} ${className}`}
      >
        {emoji}
      </span>
    );
  }
);

EmojiGlyph.displayName = 'EmojiGlyph';
