/**
 * WAV Neon Noir Color Palette
 * Unified theme configuration for the entire application
 */

export const colors = {
  // Backgrounds and Surfaces
  background: '#080808',
  surface: '#111111',
  surfaceElevated: '#1A1A1A',
  border: '#1F1F1F',

  // Primary Accent - Cyan
  primary: '#06B6D4',
  primaryDeep: '#0891B2',

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#6B7280',

  // Status Colors
  success: '#10B981',
  error: '#EF4444',

  // Waveform
  waveformActive: '#06B6D4',
  waveformInactive: '#374151',
} as const;

export type Colors = typeof colors;
export type ColorKey = keyof Colors;

/**
 * Helper to get color with alpha/opacity
 * Usage: withAlpha(colors.primary, 0.2)
 */
export const withAlpha = (color: string, alpha: number): string => {
  // Convert hex to rgba
  const hex = color.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/**
 * Alpha color variants for common UI elements
 * Derived from base colors with specific opacity levels
 */
export const alpha = {
  // Navigation
  navBackground: withAlpha(colors.surface, 0.8),
  navBackgroundStrong: withAlpha(colors.surface, 0.95),
  navBorder: withAlpha(colors.textPrimary, 0.05),
  navBorderStrong: withAlpha(colors.textPrimary, 0.1),
  navIconMuted: withAlpha(colors.textSecondary, 0.6),
  navLabelMuted: withAlpha(colors.textSecondary, 0.5),
  navActiveBg: withAlpha(colors.primary, 0.12),
  
  // Headers and Borders
  headerBorder: withAlpha(colors.textPrimary, 0.03),
  
  // Overlays
  screenOverlay: withAlpha(colors.background, 0.72),
  lightOverlay: withAlpha(colors.background, 0.56),
  darkOverlay: withAlpha(colors.background, 0.88),
  
  // Gesture overlays
  primaryOverlay: withAlpha(colors.primary, 0.2),
  errorOverlay: withAlpha(colors.error, 0.2),
  
  // Text variants
  textMuted: withAlpha(colors.textSecondary, 0.5),
  textVeryMuted: withAlpha(colors.textSecondary, 0.4),
  
  // Borders and dividers
  subtleBorder: withAlpha(colors.textPrimary, 0.05),
  mediumBorder: withAlpha(colors.textPrimary, 0.1),
} as const;

export default colors;
