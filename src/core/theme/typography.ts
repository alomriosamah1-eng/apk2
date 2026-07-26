import { TextStyle, Platform } from 'react-native';

const CAIRO = 'Cairo';

/** Typography style definitions for the design system (based on Material Design), using Cairo Arabic font. */
export const typography: Record<string, TextStyle> = {
  displayLarge: { fontSize: 57, lineHeight: 64, fontWeight: '400', letterSpacing: -0.25, fontFamily: CAIRO },
  displayMedium: { fontSize: 45, lineHeight: 52, fontWeight: '400', fontFamily: CAIRO },
  displaySmall: { fontSize: 36, lineHeight: 44, fontWeight: '400', fontFamily: CAIRO },
  headlineLarge: { fontSize: 32, lineHeight: 40, fontWeight: '700', fontFamily: CAIRO },
  headlineMedium: { fontSize: 28, lineHeight: 36, fontWeight: '700', fontFamily: CAIRO },
  headlineSmall: { fontSize: 24, lineHeight: 32, fontWeight: '600', fontFamily: CAIRO },
  titleLarge: { fontSize: 22, lineHeight: 28, fontWeight: '600', fontFamily: CAIRO },
  titleMedium: { fontSize: 16, lineHeight: 24, fontWeight: '500', letterSpacing: 0.15, fontFamily: CAIRO },
  titleSmall: { fontSize: 14, lineHeight: 20, fontWeight: '500', letterSpacing: 0.1, fontFamily: CAIRO },
  bodyLarge: { fontSize: 16, lineHeight: 24, fontWeight: '400', letterSpacing: 0.5, fontFamily: CAIRO },
  bodyMedium: { fontSize: 14, lineHeight: 20, fontWeight: '400', letterSpacing: 0.25, fontFamily: CAIRO },
  bodySmall: { fontSize: 12, lineHeight: 16, fontWeight: '400', letterSpacing: 0.4, fontFamily: CAIRO },
  labelLarge: { fontSize: 14, lineHeight: 20, fontWeight: '500', letterSpacing: 0.1, fontFamily: CAIRO },
  labelMedium: { fontSize: 12, lineHeight: 16, fontWeight: '500', letterSpacing: 0.5, fontFamily: CAIRO },
  labelSmall: { fontSize: 11, lineHeight: 16, fontWeight: '500', letterSpacing: 0.5, fontFamily: CAIRO },
  mono: { fontSize: 14, lineHeight: 20, fontWeight: '400', letterSpacing: 0, fontFamily: Platform.select({ default: CAIRO, ios: 'Menlo', android: 'monospace' }) },
};

/** Valid keys for typography styles. */
export type TypographyKey = keyof typeof typography;
