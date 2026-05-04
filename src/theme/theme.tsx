import React from 'react';
import { useColorScheme } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { useMaterial3Theme, isDynamicThemeSupported } from '@pchmn/expo-material3-theme';
import * as SystemUI from 'expo-system-ui';
import { buildPaperTheme, createFallbackMaterial3Theme, fallbackMaterialYouSourceColor } from './dynamicColors';
import { useSettingsStore } from '../store/settingsStore';

type AppThemeProviderProps = {
  children: React.ReactNode;
};

export function AppThemeProvider({ children }: AppThemeProviderProps) {
  const systemScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const settings = useSettingsStore((state) => state.settings);
  const colorScheme = settings.appearance === 'system' ? systemScheme : settings.appearance;
  const { theme: materialTheme } = useMaterial3Theme({
    fallbackSourceColor: fallbackMaterialYouSourceColor,
    colorFidelity: true
  });

  const paperTheme = React.useMemo(() => {
    const colors = settings.useDynamicColors ? materialTheme : createFallbackMaterial3Theme(fallbackMaterialYouSourceColor);
    return buildPaperTheme(colors, colorScheme, {
        dynamicColorsAvailable: isDynamicThemeSupported,
        fallbackSourceColor: fallbackMaterialYouSourceColor,
        dynamicColorsEnabled: settings.useDynamicColors
      });
  }, [colorScheme, materialTheme, settings.useDynamicColors]);

  React.useEffect(() => {
    void SystemUI.setBackgroundColorAsync(paperTheme.colors.background);
  }, [paperTheme.colors.background]);

  return <PaperProvider theme={paperTheme}>{children}</PaperProvider>;
}
