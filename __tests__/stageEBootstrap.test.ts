import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { useLanguageRestartStore } from '../src/store/languageRestartStore';

const state = vi.hoisted(() => ({ loaded: false, completed: true, preference: 'he', replay: false, t: (key: string) => key,
  load: vi.fn(), font: vi.fn(), history: vi.fn(), sync: vi.fn(), restart: vi.fn(), navMount: vi.fn(), navUnmount: vi.fn(), appListeners: [] as ((value: string) => void)[] }));
vi.mock('react-native', () => ({ ActivityIndicator: 'ActivityIndicator', Pressable: 'Pressable', Text: 'Text', View: 'View',
  StyleSheet: { create: <T,>(styles: T) => styles },
  AppState: { addEventListener: (_name: string, listener: (value: string) => void) => { state.appListeners.push(listener); return { remove: () => { state.appListeners.splice(state.appListeners.indexOf(listener), 1); } }; } },
}));
vi.mock('expo-font', () => ({ loadAsync: state.font }));
vi.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: { font: {} }, MaterialIcons: { font: {} } }));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaProvider: 'SafeAreaProvider' }));
vi.mock('../src/theme/theme', async () => { const { createElement, Fragment } = await import('react'); return { AppThemeProvider: ({ children }: { children?: React.ReactNode }) => createElement(Fragment, null, children) }; });
vi.mock('../src/screens/AppNavigator', async () => {
  const { createElement, useEffect } = await import('react');
  return { AppNavigator: () => { useEffect(() => { state.navMount(); return () => state.navUnmount(); }, []); return createElement('AppNavigator'); } };
});
vi.mock('../src/screens/onboarding/OnboardingFlow', () => ({ OnboardingFlow: 'OnboardingFlow' }));
vi.mock('../src/components/LanguageRestartPrompt', () => ({ LanguageRestartPrompt: 'LanguageRestartPrompt' }));
vi.mock('../src/store/settingsStore', () => {
  const snapshot = () => ({ loaded: state.loaded, settings: { onboardingCompleted: state.completed, developerMode: false, languagePreference: state.preference }, loadSettings: state.load });
  return { useSettingsStore: Object.assign((select: (value: unknown) => unknown) => select(snapshot()), { getState: snapshot }) };
});
vi.mock('../src/store/historyStore', () => ({ useHistoryStore: (select: (value: unknown) => unknown) => select({ loadHistory: state.history }) }));
vi.mock('../src/store/onboardingStore', () => ({ useOnboardingStore: (select: (value: unknown) => unknown) => select({ replayRequested: state.replay }) }));
vi.mock('../src/i18n', () => ({ syncI18nLanguage: state.sync }));
vi.mock('../src/native/appReload', () => ({ restartAppForLanguage: state.restart }));
vi.mock('../src/lib/logger', () => ({ logger: { debug: vi.fn(), error: vi.fn(), warn: vi.fn(), setDebugEnabled: vi.fn() } }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: state.t }) }));

const env = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
const previous = env.IS_REACT_ACT_ENVIRONMENT;
const renderers: ReactTestRenderer[] = [];
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
beforeAll(() => { env.IS_REACT_ACT_ENVIRONMENT = true; vi.stubGlobal('__DEV__', false); });
afterAll(() => { if (previous === undefined) delete env.IS_REACT_ACT_ENVIRONMENT; else env.IS_REACT_ACT_ENVIRONMENT = previous; vi.unstubAllGlobals(); });
beforeEach(() => {
  state.loaded = false; state.completed = true; state.preference = 'he'; state.replay = false; state.t = (key) => key; state.appListeners.length = 0;
  state.load.mockReset().mockImplementation(async () => { state.loaded = true; }); state.font.mockReset().mockResolvedValue(undefined); state.history.mockReset().mockResolvedValue(undefined);
  state.sync.mockReset().mockResolvedValue(true); state.restart.mockReset(); state.navMount.mockReset(); state.navUnmount.mockReset();
  useLanguageRestartStore.setState({ required: false, promptOpen: false });
});
afterEach(async () => { await act(async () => renderers.splice(0).forEach((renderer) => renderer.unmount())); });
async function mount() { let renderer!: ReactTestRenderer; await act(async () => { renderer = TestRenderer.create(React.createElement(App)); renderers.push(renderer); await flush(); }); return renderer; }

describe('actual App persisted-language bootstrap', () => {
  it('waits for settings before any native direction sync, including an early foreground event', async () => {
    let commit!: () => void;
    state.load.mockImplementationOnce(async () => { await new Promise<void>((accept) => { commit = accept; }); state.loaded = true; });
    const renderer = await mount();
    await act(async () => { state.appListeners.forEach((listener) => listener('active')); await flush(); });
    expect(state.sync).not.toHaveBeenCalled(); expect(state.navMount).not.toHaveBeenCalled();
    await act(async () => { commit(); await flush(); });
    expect(state.sync).toHaveBeenCalledExactlyOnceWith('he');
    expect(useLanguageRestartStore.getState()).toMatchObject({ required: true, promptOpen: true });
    expect(renderer.root.findAllByType('AppNavigator' as React.ElementType)).toHaveLength(1);
  });

  it('does not apply default language after a load error and permits an explicit bootstrap retry', async () => {
    state.load.mockRejectedValueOnce(new Error('settings IO_ERROR'));
    const renderer = await mount();
    expect(state.sync).not.toHaveBeenCalled(); expect(state.navMount).not.toHaveBeenCalled();
    expect(renderer.root.findAllByType('Text' as React.ElementType).some((node) => node.props.children === 'bootstrap.assetLoadFailed')).toBe(true);
    await act(async () => { renderer.root.findByType('Pressable' as React.ElementType).props.onPress(); await flush(); });
    expect(state.load).toHaveBeenCalledTimes(2); expect(state.sync).toHaveBeenCalledExactlyOnceWith('he');
  });

  it('does not bootstrap/reload/remount the navigator when translation identity or foreground state changes', async () => {
    const renderer = await mount();
    await act(async () => { useLanguageRestartStore.getState().dismiss(); state.t = (key) => `translated:${key}`; renderer.update(React.createElement(App)); await flush(); });
    await act(async () => { for (let i = 0; i < 3; i++) state.appListeners.forEach((listener) => listener('active')); await flush(); });
    expect(state.load).toHaveBeenCalledOnce(); expect(state.font).toHaveBeenCalledOnce(); expect(state.history).toHaveBeenCalledOnce();
    expect(state.restart).not.toHaveBeenCalled(); expect(state.navMount).toHaveBeenCalledOnce(); expect(state.navUnmount).not.toHaveBeenCalled();
    expect(useLanguageRestartStore.getState()).toMatchObject({ required: true, promptOpen: false });
  });

  it('keeps the existing navigator mounted while onboarding is replayed and dismissed', async () => {
    const renderer = await mount();
    await act(async () => { state.replay = true; renderer.update(React.createElement(App)); });
    expect(renderer.root.findAllByType('OnboardingFlow' as React.ElementType)).toHaveLength(1);
    expect(state.navMount).toHaveBeenCalledOnce(); expect(state.navUnmount).not.toHaveBeenCalled();
    await act(async () => { state.replay = false; renderer.update(React.createElement(App)); });
    expect(renderer.root.findAllByType('OnboardingFlow' as React.ElementType)).toHaveLength(0);
    expect(state.navMount).toHaveBeenCalledOnce(); expect(state.navUnmount).not.toHaveBeenCalled();
  });
});
