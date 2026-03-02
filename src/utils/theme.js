// Apple Liquid Glass Theme
export const darkTheme = {
  bg: '#000000',
  surface: 'rgba(28,28,30,0.8)',
  glass: 'rgba(255,255,255,0.06)',
  glassHover: 'rgba(255,255,255,0.12)',
  border: 'rgba(255,255,255,0.06)',
  text: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.6)',
  textTertiary: 'rgba(255,255,255,0.4)',
  accent: '#0a84ff',
  green: '#30D158',
  red: '#FF453A',
  yellow: '#FFD60A',
  orange: '#FF9F0A',
  purple: '#BF5AF2',
  cyan: '#64D2FF',
  pink: '#FF375F',
};

export const lightTheme = {
  bg: '#ffffff',
  surface: '#FFFFFF',                   // Opaque white — no grey bleed through semi-transparent layers
  glass: 'rgba(255,255,255,0.92)',      // Slight transparency for cards on grey bg
  glassHover: '#FFFFFF',
  border: 'rgba(0,0,0,0.09)',
  text: '#111111',                       // Near-black — readout style
  textSecondary: 'rgba(60,60,67,0.6)', // Apple secondary label
  textTertiary: 'rgba(60,60,67,0.45)', // Apple tertiary — readable at small sizes
  accent: '#0a84ff',                    // Readout blue
  green: '#34C759',
  red: '#FF3B30',
  yellow: '#FFCC00',
  orange: '#FF9500',
  purple: '#AF52DE',
  cyan: '#5AC8FA',
  pink: '#FF2D55',
};

export const getTheme = (dark) => dark ? darkTheme : lightTheme;

// Probability color helper
export const getProbColor = (p, t) => {
  if (p >= 0.15) return t.green;
  if (p >= 0.02) return t.yellow;
  return t.red;
};
