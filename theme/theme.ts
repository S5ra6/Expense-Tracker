import { MD3DarkTheme, MD3LightTheme, type MD3Theme } from 'react-native-paper';

const poppinsMap: Record<'regular' | 'medium' | 'light', string> = {
  regular: 'Poppins-Regular',
  medium: 'Poppins-Medium',
  light: 'Poppins-Light',
};

type ThemeFonts = typeof MD3DarkTheme.fonts;
type VariantKey = keyof ThemeFonts;

const mediumVariants = new Set<string>([
  'displayLarge',
  'displayMedium',
  'headlineLarge',
  'titleLarge',
  'titleMedium',
  'labelLarge',
]);

const lightVariants = new Set<string>(['displaySmall', 'bodySmall']);

const buildFonts = (baseTheme: MD3Theme): ThemeFonts => {
  const fonts = JSON.parse(JSON.stringify(baseTheme.fonts)) as ThemeFonts;

  (Object.keys(fonts) as VariantKey[]).forEach((variant) => {
    const style = fonts[variant];

    if (!style) return;

    if (mediumVariants.has(variant as string)) {
      style.fontFamily = poppinsMap.medium;
      style.fontWeight = 'normal';
      return;
    }

    if (lightVariants.has(variant as string)) {
      style.fontFamily = poppinsMap.light;
      style.fontWeight = 'normal';
      return;
    }

    style.fontFamily = poppinsMap.regular;
    style.fontWeight = 'normal';
  });

  return fonts;
};

const darkFonts = buildFonts(MD3DarkTheme);
const lightFonts = buildFonts(MD3LightTheme);

type CustomTheme = {
  gradientBackground: string[];
  cardGradient: string[];
  glow: string;
  success: string;
  warning: string;
};

const createAppTheme = (mode: 'dark' | 'light') => {
  const isDark = mode === 'dark';
  const baseTheme = isDark ? MD3DarkTheme : MD3LightTheme;
  const fonts = isDark ? darkFonts : lightFonts;

  const colors = isDark
    ? {
        ...baseTheme.colors,
        primary: '#0CF5E8',
        onPrimary: '#00151F',
        primaryContainer: '#0A2C3F',
        onPrimaryContainer: '#94FFF4',
        secondary: '#7C5CFF',
        onSecondary: '#150B33',
        secondaryContainer: '#2E2260',
        onSecondaryContainer: '#DED6FF',
        tertiary: '#F72585',
        onTertiary: '#3A001D',
        tertiaryContainer: '#5A0031',
        onTertiaryContainer: '#FFD7E5',
        background: '#020817',
        onBackground: '#E6F1FF',
        surface: '#081326',
        onSurface: '#E6F1FF',
        surfaceVariant: '#13213F',
        onSurfaceVariant: '#9AA6D5',
        outline: '#30466D',
        outlineVariant: '#1C2D4A',
        inverseSurface: '#E6F1FF',
        inverseOnSurface: '#051123',
        error: '#FF5C8A',
        onError: '#2C0015',
      }
    : {
        ...baseTheme.colors,
        primary: '#007FAD',
        onPrimary: '#FFFFFF',
        primaryContainer: '#B2F6FF',
        onPrimaryContainer: '#00323E',
        secondary: '#675CFF',
        onSecondary: '#FFFFFF',
        secondaryContainer: '#DFE0FF',
        onSecondaryContainer: '#1A1A5C',
        tertiary: '#FF4FA3',
        onTertiary: '#FFFFFF',
        tertiaryContainer: '#FFD9ED',
        onTertiaryContainer: '#3F001F',
        background: '#F5FAFF',
        onBackground: '#051123',
        surface: '#FFFFFF',
        onSurface: '#051123',
        surfaceVariant: '#E0EDFF',
        onSurfaceVariant: '#465872',
        outline: '#8CA1C3',
        outlineVariant: '#C7D5EB',
        inverseSurface: '#09142A',
        inverseOnSurface: '#E6F1FF',
        error: '#D61F69',
        onError: '#FFFFFF',
      };

  const custom: CustomTheme = isDark
    ? {
        gradientBackground: ['#031022', '#020817'],
        cardGradient: ['#112240', '#09142A'],
        glow: '#0CF5E8',
        success: '#5CFAC7',
        warning: '#FFC857',
      }
    : {
        gradientBackground: ['#F1F8FF', '#FDFEFF'],
        cardGradient: ['#FFFFFF', '#EEF6FF'],
        glow: '#00C4F5',
        success: '#00B894',
        warning: '#FFAA33',
      };

  return {
    ...baseTheme,
    dark: isDark,
    mode: 'adaptive',
    fonts,
    colors,
    custom,
  } as MD3Theme & { custom: CustomTheme };
};

export const neonDarkTheme = createAppTheme('dark');
export const neonLightTheme = createAppTheme('light');

export type AppTheme = typeof neonDarkTheme;

export const getAppTheme = (mode: 'dark' | 'light') => (mode === 'dark' ? neonDarkTheme : neonLightTheme);
