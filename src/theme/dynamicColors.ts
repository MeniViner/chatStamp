import { createMaterial3Theme, isDynamicThemeSupported, type Material3Theme } from '@pchmn/expo-material3-theme';
import { MD3DarkTheme, MD3LightTheme, type MD3Theme } from 'react-native-paper';

export const fallbackMaterialYouSourceColor = '#8a4f2a';

export type AppColorScheme = 'light' | 'dark';

export type AppThemeMetadata = {
  dynamicColorsAvailable: boolean;
  dynamicColorsEnabled?: boolean;
  fallbackSourceColor: string;
};

export function createFallbackMaterial3Theme(sourceColor = fallbackMaterialYouSourceColor): Material3Theme {
  return createMaterial3Theme(sourceColor, { colorFidelity: true });
}

export function buildPaperTheme(
  materialTheme: Material3Theme,
  colorScheme: AppColorScheme,
  metadata: AppThemeMetadata = {
    dynamicColorsAvailable: isDynamicThemeSupported,
    fallbackSourceColor: fallbackMaterialYouSourceColor
  }
): MD3Theme & { metadata: AppThemeMetadata } {
  const baseTheme = colorScheme === 'dark' ? MD3DarkTheme : MD3LightTheme;
  const colors = colorScheme === 'dark' ? materialTheme.dark : materialTheme.light;

  return {
    ...baseTheme,
    dark: colorScheme === 'dark',
    roundness: 16,
    colors: {
      ...baseTheme.colors,
      ...colors
    },
    metadata
  };
}
