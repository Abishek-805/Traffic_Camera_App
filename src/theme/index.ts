import { MD3DarkTheme, configureFonts } from 'react-native-paper';

export const AppColors = {
  background: '#0B0F19',
  surface: '#151C2C',
  surfaceVariant: '#1E293B',
  border: '#2E3D59',

  // Brand & Status Accents
  primary: '#00E5FF',       // Neon Cyan
  primaryDark: '#00B8D4',
  secondary: '#7C4DFF',     // Electric Purple

  // Traffic Node Status Colors
  connected: '#00E676',     // Emerald Traffic Green
  waiting: '#FFAB00',       // Amber Alert
  streaming: '#00E5FF',     // Active Cyan
  disconnected: '#FF5252',  // Alert Rose
  disabled: '#64748B',

  // Text & Content
  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',

  // Overlay & Glassmorphism
  glassBackground: 'rgba(21, 28, 44, 0.85)',
  overlay: 'rgba(11, 15, 25, 0.75)',
};

export const CustomDarkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: AppColors.primary,
    secondary: AppColors.secondary,
    background: AppColors.background,
    surface: AppColors.surface,
    surfaceVariant: AppColors.surfaceVariant,
    outline: AppColors.border,
    onBackground: AppColors.textPrimary,
    onSurface: AppColors.textPrimary,
    elevation: {
      ...MD3DarkTheme.colors.elevation,
      level1: '#151C2C',
      level2: '#1E293B',
    },
  },
};
