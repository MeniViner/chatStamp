import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Material3Theme } from '@pchmn/expo-material3-theme';
import { buildPaperTheme, createFallbackMaterial3Theme, fallbackMaterialYouSourceColor } from '../src/theme/dynamicColors';
import { AppThemeProvider } from '../src/theme/theme';
import { useAppTheme } from '../src/theme/useAppTheme';
import { appColorTokens } from '../src/theme/designTokens';

const fixture = vi.hoisted(() => ({ material: {} as Material3Theme, fallback: {} as Material3Theme,
  settings: { appearance: 'system', useDynamicColors: true }, system: 'light', background: vi.fn() }));
vi.mock('@pchmn/expo-material3-theme', async (importOriginal) => ({ ...await importOriginal<typeof import('@pchmn/expo-material3-theme')>(),
  isDynamicThemeSupported: true, useMaterial3Theme: () => ({ theme: fixture.material }) }));
vi.mock('react-native', () => ({ Platform: { OS: 'android', Version: 30 }, useColorScheme: () => fixture.system }));
vi.mock('expo-modules-core', () => ({ requireNativeModule: () => undefined }));
vi.mock('expo-system-ui', () => ({ setBackgroundColorAsync: fixture.background }));
vi.mock('../src/store/settingsStore', () => ({ useSettingsStore: (select: (value: unknown) => unknown) => select({ settings: fixture.settings }) }));
vi.mock('react-native-paper', async () => {
  const { createContext, createElement, useContext } = await import('react');
  const Context = createContext<unknown>(null);
  return { MD3LightTheme: { dark: false, colors: {} }, MD3DarkTheme: { dark: true, colors: {} },
    PaperProvider: ({ theme, children }: { theme: unknown; children: React.ReactNode }) => createElement(Context.Provider, { value: theme }, children),
    useTheme: () => useContext(Context) };
});

function palette(light: string, dark: string): Material3Theme {
  const scheme = (value: string) => ({ ...Object.fromEntries([
    'primary', 'onPrimary', 'primaryContainer', 'onPrimaryContainer', 'secondary', 'onSecondary', 'secondaryContainer', 'onSecondaryContainer',
    'tertiary', 'onTertiary', 'tertiaryContainer', 'onTertiaryContainer', 'background', 'onBackground', 'surface', 'onSurface', 'surfaceVariant',
    'onSurfaceVariant', 'outline', 'outlineVariant', 'inverseSurface', 'inverseOnSurface', 'inversePrimary', 'error', 'onError', 'errorContainer',
    'onErrorContainer', 'shadow', 'scrim', 'surfaceDisabled', 'onSurfaceDisabled', 'backdrop', 'surfaceContainer', 'surfaceContainerLow',
    'surfaceContainerLowest', 'surfaceContainerHigh', 'surfaceContainerHighest', 'surfaceBright', 'surfaceDim', 'surfaceTint',
  ].map((name) => [name, value])), elevation: { level0: value, level1: value, level2: value, level3: value, level4: value, level5: value } }) as Material3Theme['light'];
  return { light: scheme(light), dark: scheme(dark) };
}

const env = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
const previous = env.IS_REACT_ACT_ENVIRONMENT;
const renderers: ReactTestRenderer[] = [];
beforeAll(() => { env.IS_REACT_ACT_ENVIRONMENT = true; });
afterAll(() => { if (previous === undefined) delete env.IS_REACT_ACT_ENVIRONMENT; else env.IS_REACT_ACT_ENVIRONMENT = previous; });
beforeEach(() => { fixture.material = palette('#159951', '#aeefbe'); fixture.fallback = palette('#9a6342', '#f0b990'); fixture.settings = { appearance: 'system', useDynamicColors: true }; fixture.system = 'light'; fixture.background.mockReset().mockResolvedValue(undefined); });
afterEach(async () => { await act(async () => renderers.splice(0).forEach((renderer) => renderer.unmount())); });

describe('actual Material palette consumption', () => {
  it('retains real fallback Material generation for both light and dark schemes', () => {
    const generated = createFallbackMaterial3Theme();
    expect(generated.light.primary).toMatch(/^#[\da-f]{6}$/i);
    expect(generated.dark.primary).toMatch(/^#[\da-f]{6}$/i);
    expect(generated.light.primary).not.toBe(generated.dark.primary);
    const light = buildPaperTheme(generated, 'light', { dynamicColorsAvailable: false, fallbackSourceColor: fallbackMaterialYouSourceColor });
    const dark = buildPaperTheme(generated, 'dark', { dynamicColorsAvailable: false, fallbackSourceColor: fallbackMaterialYouSourceColor });
    expect(light.colors.primary).toBeTruthy(); expect(dark.dark).toBe(true);
    expect(light.metadata.fallbackSourceColor).toBe(fallbackMaterialYouSourceColor);
  });
  it.each(['light', 'dark'] as const)('preserves all supplied dynamic roles for %s instead of replacing them with fixed tokens', (scheme) => {
    const first = buildPaperTheme(fixture.material, scheme, { dynamicColorsAvailable: true, dynamicColorsEnabled: true, fallbackSourceColor: '#9a6342' });
    const different = palette('#2244ee', '#bbccff');
    const second = buildPaperTheme(different, scheme, { dynamicColorsAvailable: true, dynamicColorsEnabled: true, fallbackSourceColor: '#9a6342' });
    for (const role of ['primary', 'onPrimary', 'primaryContainer', 'onPrimaryContainer', 'surface', 'background', 'onSurface', 'surfaceVariant'] as const) {
      expect(first.colors[role]).toBe(fixture.material[scheme][role]);
      expect(second.colors[role]).toBe(different[scheme][role]);
      expect(first.colors[role]).not.toBe(second.colors[role]);
    }
  });

  it.each([{ available: true, enabled: false }, { available: false, enabled: true }])('uses the honest fallback when dynamic state is %o', ({ available, enabled }) => {
    const result = buildPaperTheme(fixture.material, 'light', { dynamicColorsAvailable: available, dynamicColorsEnabled: enabled, fallbackSourceColor: '#9a6342' });
    expect(result.colors.primary).toBe(appColorTokens.light.primary);
    expect(result.colors.background).toBe(appColorTokens.light.background);
    expect(result.colors.onPrimary).toBe(appColorTokens.light.onPrimary);
  });

  it('changes the real provider consumer and system background when ON/OFF and appearance change', async () => {
    function Consumer() { const theme = useAppTheme(); return React.createElement('ThemeConsumer', { primary: theme.colors.primary, background: theme.colors.background, dark: theme.dark }); }
    const tree = () => React.createElement(AppThemeProvider, null, React.createElement(Consumer));
    let renderer!: ReactTestRenderer;
    await act(async () => { renderer = TestRenderer.create(tree()); renderers.push(renderer); });
    const current = () => renderer.root.findByType('ThemeConsumer' as React.ElementType).props;
    expect(current()).toMatchObject({ primary: fixture.material.light.primary, background: fixture.material.light.background, dark: false });
    expect(fixture.background).toHaveBeenLastCalledWith(fixture.material.light.background);
    await act(async () => { fixture.settings = { appearance: 'dark', useDynamicColors: true }; renderer.update(tree()); });
    expect(current()).toMatchObject({ primary: fixture.material.dark.primary, dark: true });
    await act(async () => { fixture.settings = { appearance: 'dark', useDynamicColors: false }; renderer.update(tree()); });
    expect(current()).toMatchObject({ primary: appColorTokens.dark.primary, background: appColorTokens.dark.background, dark: true });
    expect(fixture.background).toHaveBeenLastCalledWith(appColorTokens.dark.background);
  });
});
