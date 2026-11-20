import React from 'react';
import vectorIconsRaw from '../../data/generated/vectorIcons.json';

interface VectorPathSpec {
  d: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  fillRule?: 'evenodd' | 'nonzero';
  strokeLinecap?: 'butt' | 'round' | 'square';
  strokeLinejoin?: 'miter' | 'round' | 'bevel';
  fillOpacity?: number;
}

interface VectorIconDef {
  viewBox: string;
  paths: VectorPathSpec[];
  multicolor?: boolean;
}

const VECTOR_ICONS = vectorIconsRaw as Record<string, VectorIconDef>;

export type KurdiIconName = keyof typeof vectorIconsRaw | string;

interface KurdiIconProps extends React.SVGProps<SVGSVGElement> {
  name: KurdiIconName;
  size?: number;
  preserveColors?: boolean;
}

export const KurdiIcon: React.FC<KurdiIconProps> = ({
  name,
  size,
  className = 'w-5 h-5',
  style,
  preserveColors,
  ...rest
}) => {
  const def = VECTOR_ICONS[name];
  if (!def) {
    return null;
  }

  const keepNativeColors = preserveColors ?? Boolean(def.multicolor);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={def.viewBox}
      width={size}
      height={size}
      className={className}
      style={style}
      fill="none"
      aria-hidden="true"
      {...rest}
    >
      {def.paths.map((p, idx) => {
        const hasStroke = Boolean(p.stroke && p.stroke !== 'none');
        const hasFill = Boolean(p.fill && p.fill !== 'none');

        const computedFill = hasFill
          ? keepNativeColors
            ? p.fill
            : 'currentColor'
          : hasStroke
          ? 'none'
          : 'currentColor';

        const computedStroke = hasStroke
          ? keepNativeColors
            ? p.stroke
            : 'currentColor'
          : undefined;

        return (
          <path
            key={idx}
            d={p.d}
            fill={computedFill}
            stroke={computedStroke}
            strokeWidth={p.strokeWidth}
            fillRule={p.fillRule}
            strokeLinecap={p.strokeLinecap}
            strokeLinejoin={p.strokeLinejoin}
            fillOpacity={p.fillOpacity}
          />
        );
      })}
    </svg>
  );
};

export const KurdiLogo: React.FC<{ className?: string }> = ({ className = 'w-9 h-9' }) => (
  <img
    src="/kurdikebord-logo.svg"
    alt="تەختەکلیلی کوردی"
    className={`object-contain select-none ${className}`}
    draggable={false}
  />
);

export const PremiumBadgeIcon: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="kurdiProOuter" x1="4" y1="3" x2="20" y2="21" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#FFE98A" />
        <stop offset="50%" stopColor="#F5B82E" />
        <stop offset="100%" stopColor="#C87E0A" />
      </linearGradient>
      <linearGradient id="kurdiProInner" x1="6" y1="6" x2="18" y2="18" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#FFF5BE" />
        <stop offset="55%" stopColor="#F7C948" />
        <stop offset="100%" stopColor="#D69116" />
      </linearGradient>
      <linearGradient id="kurdiProRing" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#FFF3B0" stopOpacity="0.9" />
        <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.4" />
      </linearGradient>
    </defs>
    <path d="M12,2L21,7V17L12,22L3,17V7L12,2Z" fill="rgba(0,0,0,0.16)" />
    <path d="M12,3L20,7.5V16.5L12,21L4,16.5V7.5L12,3Z" fill="url(#kurdiProOuter)" />
    <path d="M12,6L18,9.5V14.5L12,18L6,14.5V9.5L12,6Z" fill="url(#kurdiProInner)" />
    <path d="M12,3L20,7.5L12,6L4,7.5L12,3Z" fill="rgba(255,255,255,0.65)" />
    <path d="M10,2L19,5.5L22,14L15,22L5,19L2,10L10,2Z" stroke="url(#kurdiProRing)" strokeWidth="0.8" />
    <path
      d="M8.5,10.5V13.5M8.5,10.5H10C10.6,10.5 11,10.9 11,11.5C11,12.1 10.6,12.5 10,12.5H8.5"
      stroke="#1d2230"
      strokeWidth="0.95"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M12,10.5V13.5M12,10.5H13.5C14.1,10.5 14.5,10.9 14.5,11.5C14.5,12.1 14.1,12.5 13.5,12.5H12M13.5,12.5L14.5,13.5"
      stroke="#1d2230"
      strokeWidth="0.95"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M15.5,11.2V12.8C15.5,13.2 15.9,13.5 16.3,13.5H17.2C17.6,13.5 18,13.2 18,12.8V11.2C18,10.8 17.6,10.5 17.2,10.5H16.3C15.9,10.5 15.5,10.8 15.5,11.2Z"
      stroke="#1d2230"
      strokeWidth="0.95"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
