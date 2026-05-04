import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  Platform: { OS: 'android', Version: 30 }
}));

vi.mock('react-native-paper', () => ({
  MD3LightTheme: {
    dark: false,
    roundness: 4,
    colors: {
      primary: '#6750A4',
      background: '#FFFBFE',
      surface: '#FFFBFE'
    }
  },
  MD3DarkTheme: {
    dark: true,
    roundness: 4,
    colors: {
      primary: '#D0BCFF',
      background: '#1C1B1F',
      surface: '#1C1B1F'
    }
  }
}));

vi.mock('expo-modules-core', () => ({
  requireNativeModule: () => undefined
}));

vi.stubGlobal('__DEV__', false);

describe('dynamicColors', () => {
  it('generates a light and dark MD3 fallback theme', async () => {
    const { buildPaperTheme, createFallbackMaterial3Theme, fallbackMaterialYouSourceColor } = await import('../src/theme/dynamicColors');
    const materialTheme = createFallbackMaterial3Theme();
    const light = buildPaperTheme(materialTheme, 'light');
    const dark = buildPaperTheme(materialTheme, 'dark');

    expect(light.colors.primary).toBeTruthy();
    expect(light.colors.primary).not.toBe('#0f766e');
    expect(dark.dark).toBe(true);
    expect(light.metadata.fallbackSourceColor).toBe(fallbackMaterialYouSourceColor);
  });
});
