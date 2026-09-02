import React from 'react';
import {
  AFYA_SALVADOR_LOGO_MAGENTA_BASE64,
  AFYA_SALVADOR_LOGO_JPG_BASE64,
} from './afyaLogoBase64';

export { AFYA_SALVADOR_LOGO_MAGENTA_BASE64, AFYA_SALVADOR_LOGO_JPG_BASE64 };

export const AFYA_MAGENTA = '#C20054';
export const AFYA_MAGENTA_RGB = [194, 0, 84] as const;
export const AFYA_DARK_MAGENTA = '#980041';
export const AFYA_DARK_MAGENTA_RGB = [152, 0, 65] as const;
export const AFYA_LIGHT_PINK = '#FFF0F5';

/**
 * Returns the Data URL of the official Afya Centro Universitário Salvador · BA logo.
 */
export function getAfyaSalvadorLogoDataUrl(): string {
  return AFYA_SALVADOR_LOGO_JPG_BASE64 || AFYA_SALVADOR_LOGO_MAGENTA_BASE64;
}

/**
 * React Component for the official Afya Centro Universitário Salvador Logo
 */
export const AfyaSalvadorLogo: React.FC<{
  className?: string;
  variant?: 'color' | 'white';
  height?: number | string;
}> = ({ className = 'h-8 w-auto', variant = 'color', height }) => {
  const logoSrc = AFYA_SALVADOR_LOGO_MAGENTA_BASE64 || AFYA_SALVADOR_LOGO_JPG_BASE64 || '/afya_logo_salvador_magenta.png';

  return (
    <img
      src={logoSrc}
      alt="Afya Centro Universitário Salvador"
      className={`object-contain select-none ${variant === 'white' ? 'brightness-0 invert' : ''} ${className}`}
      style={height ? { height } : undefined}
      loading="eager"
      onError={(e) => {
        const target = e.currentTarget;
        if (target.src !== AFYA_SALVADOR_LOGO_JPG_BASE64 && AFYA_SALVADOR_LOGO_JPG_BASE64) {
          target.src = AFYA_SALVADOR_LOGO_JPG_BASE64;
        }
      }}
    />
  );
};
