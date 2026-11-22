import React, { useEffect, useState } from 'react';
import { EmojiStyleMode } from '../../types/keyboard';

const FB_CDN_BASE = 'https://cdn.jsdelivr.net/npm/emoji-datasource-facebook@15.1.2/img/facebook/64';

// Cache failed image codes in memory so offline mode falls back instantaneously with zero retries
const failedFacebookCodes = new Set<string>();

export function emojiToHexCode(emoji: string): string {
  const parts: string[] = [];
  for (const ch of Array.from(emoji)) {
    const cp = ch.codePointAt(0);
    if (cp !== undefined) {
      parts.push(cp.toString(16).toLowerCase());
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
    const [useFallbackText, setUseFallbackText] = useState<boolean>(
      () => styleMode !== 'facebook' || failedFacebookCodes.has(primaryCode)
    );

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
