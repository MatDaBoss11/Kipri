/**
 * Colors used in the Kipri app with Material Design 3 inspired palette
 */

const primaryLight = '#6366F1';
const primaryDark = '#818CF8';
const tintColorLight = primaryLight;
const tintColorDark = primaryDark;

export const Colors = {
  light: {
    text: '#11181C',
    background: '#FFFFFF',
    surface: '#FFFFFF',
    card: '#F8FAFC',
    border: '#E2E8F0',
    primary: primaryLight,
    secondary: '#8B5CF6',
    tertiary: '#10B981',
    error: '#EF4444',
    warning: '#F59E0B',
    success: '#10B981',
    tint: tintColorLight,
    icon: '#64748B',
    tabIconDefault: '#64748B',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#F1F5F9',
    background: '#0F172A',
    surface: '#1E293B',
    card: '#334155',
    border: '#475569',
    primary: primaryDark,
    secondary: '#A78BFA',
    tertiary: '#34D399',
    error: '#F87171',
    warning: '#FBBF24',
    success: '#34D399',
    tint: tintColorDark,
    icon: '#94A3B8',
    tabIconDefault: '#94A3B8',
    tabIconSelected: tintColorDark,
  },
};
