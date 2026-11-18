import { createMaterial3Theme, isDynamicThemeSupported, type Material3Theme } from '@pchmn/expo-material3-theme';
import { MD3DarkTheme, MD3LightTheme, type MD3Theme } from 'react-native-paper';
import { appColorTokens } from './designTokens';

export const fallbackMaterialYouSourceColor = '#9a6342';

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
  const appColors = appColorTokens[colorScheme];
  const dynamic = metadata.dynamicColorsAvailable && metadata.dynamicColorsEnabled !== false;

  return {
    ...baseTheme,
    dark: colorScheme === 'dark',
    roundness: 4,
    colors: {
      ...baseTheme.colors,
      ...colors,
      ...(dynamic ? {} : {
      background: appColors.background,
      surface: appColors.surface,
      surfaceVariant: appColors.elevatedSurface,
      surfaceDisabled: appColors.disabled,
      primary: appColors.primary,
      onPrimary: appColors.onPrimary,
      primaryContainer: appColors.primaryContainer,
      onPrimaryContainer: appColors.onPrimaryContainer,
      secondary: appColors.secondary,
      secondaryContainer: appColors.secondaryContainer,
      error: appColors.error,
      errorContainer: appColors.errorContainer,
      onSurface: appColors.textPrimary,
      onSurfaceVariant: appColors.textSecondary,
      outline: appColors.textMuted,
      outlineVariant: appColors.border,
      onBackground: appColors.textPrimary,
      surfaceContainer: appColors.surface,
      surfaceContainerLow: appColors.surface,
      surfaceContainerHigh: appColors.elevatedSurface,
      surfaceContainerHighest: appColors.elevatedSurface
      })
    },
    metadata
  };
}
