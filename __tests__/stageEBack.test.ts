import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsScreen } from '../src/screens/SettingsScreen';
import { HistoryScreen } from '../src/screens/HistoryScreen';
import { ErrorScreen } from '../src/screens/ErrorScreen';
import { ProcessingScreen } from '../src/screens/ProcessingScreen';
import { usePipelineStore } from '../src/store/pipelineStore';
import { useLanguageRestartStore } from '../src/store/languageRestartStore';
import { defaultSettings } from '../src/store/settingsLogic';
import type { AppSettings } from '../src/types/media';

const state = vi.hoisted(() => ({ settings: {} as AppSettings, update: vi.fn(), sync: vi.fn(), folder: vi.fn(), discard: vi.fn(), cancel: vi.fn(), read: vi.fn(), listeners: [] as (() => boolean)[] }));
vi.mock('react-native', () => ({ View: 'View', ScrollView: 'ScrollView', FlatList: 'FlatList', Pressable: 'Pressable', StatusBar: 'StatusBar', Linking: { openURL: vi.fn() }, I18nManager: { isRTL: false },
  StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 },
  BackHandler: { addEventListener: (_name: string, listener: () => boolean) => { state.listeners.push(listener); return { remove: () => { state.listeners.splice(state.listeners.indexOf(listener), 1); } }; } },
}));
vi.mock('expo-application', () => ({ nativeApplicationVersion: '0.2.0', nativeBuildVersion: '4' }));
vi.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: 'Icon' }));
vi.mock('react-native-paper', () => ({ Text: 'Text', Snackbar: 'Snackbar', IconButton: 'IconButton', Menu: 'Menu', ProgressBar: 'ProgressBar', ActivityIndicator: 'ActivityIndicator' }));
vi.mock('../src/components/BottomSheet', () => ({ BottomSheet: 'BottomSheet', PremiumBottomSheet: 'PremiumBottomSheet' }));
vi.mock('../src/components/ConfirmDialog', () => ({ ConfirmDialog: 'ConfirmDialog' }));
vi.mock('../src/components/FolderFallbackSheet', () => ({ FolderFallbackSheet: 'FolderFallbackSheet' }));
vi.mock('expo-image', () => ({ Image: 'Image' }));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
vi.mock('../src/native/mediaPreviews', () => ({ getThumbnail: vi.fn(), invalidateThumbnail: vi.fn() }));
// Real list rows/banners; leaf controls remain inspectable hosts.
vi.mock('../src/components/AppUi', async (importOriginal) => ({ ...await importOriginal<typeof import('../src/components/AppUi')>(),
  InfoRow: 'InfoRow', OptionChoiceCard: 'OptionChoiceCard', PrimaryButton: 'PrimaryButton', SecondaryButton: 'SecondaryButton', SettingsSectionCard: 'SettingsSectionCard',
  SettingRow: 'SettingRow', ExpandableTechnicalDetails: 'ExpandableTechnicalDetails', FilePathText: 'FilePathText', PremiumCard: 'PremiumCard', StatusBadge: 'StatusBadge' }));
vi.mock('../src/screens/WizardScreen', async () => {
  const { createElement } = await import('react');
  return { FooterActions: 'FooterActions', WizardScreen: ({ children, footer, ...props }: { children?: React.ReactNode; footer?: React.ReactNode }) => createElement('WizardScreen', props, children, footer) };
});
vi.mock('../src/store/settingsStore', () => ({ useSettingsStore: (select: (value: unknown) => unknown) => select({ settings: state.settings, updateSettings: state.update, resetSaveLocation: vi.fn() }) }));
vi.mock('../src/store/historyStore', () => ({ useHistoryStore: (select: (value: unknown) => unknown) => select({ items: [], clearHistory: vi.fn(), deleteHistoryItem: vi.fn() }) }));
vi.mock('../src/store/onboardingStore', () => ({ useOnboardingStore: (select: (value: unknown) => unknown) => select({ requestReplay: vi.fn() }) }));
vi.mock('../src/i18n', () => ({ syncI18nLanguage: state.sync }));
vi.mock('../src/native/appLanguage', () => ({ openAppLanguageSettings: vi.fn() }));
vi.mock('../src/native/outputFolderPicker', () => ({ openOutputFolderPicker: state.folder }));
vi.mock('../src/native/chatStampNativeModule', () => ({ getChatStampNativeModule: () => ({ canReadSourceAsync: state.read, cleanupStaleJobsAsync: vi.fn() }) }));
vi.mock('../src/services/operationCoordinator', () => ({ discardImport: state.discard, cancelCurrentOperation: state.cancel, beginImport: vi.fn(), chooseZip: vi.fn() }));
vi.mock('../src/native/androidIntents', () => ({ openFolderBestEffort: vi.fn(), openGalleryBestEffort: vi.fn(), shouldShowOpenGallery: vi.fn() }));
vi.mock('../src/native/outputFiles', () => ({ deleteOutputFiles: vi.fn(), shareOutputFiles: vi.fn() }));
vi.mock('../src/theme/useAppTheme', () => ({ useAppTheme: () => ({ colors: new Proxy<Record<string, string>>({}, { get: () => '#123456' }) }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { resolvedLanguage: 'en' } }) }));

const host = (name: string) => name as React.ElementType;
const renderers: ReactTestRenderer[] = [];
const env = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
const previous = env.IS_REACT_ACT_ENVIRONMENT;
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
beforeAll(() => { env.IS_REACT_ACT_ENVIRONMENT = true; });
afterAll(() => { if (previous === undefined) delete env.IS_REACT_ACT_ENVIRONMENT; else env.IS_REACT_ACT_ENVIRONMENT = previous; });
beforeEach(() => {
  usePipelineStore.getState().reset(); useLanguageRestartStore.setState({ required: false, promptOpen: false }); state.listeners.length = 0;
  state.settings = structuredClone(defaultSettings);
  state.update.mockReset().mockImplementation(async (patch: Partial<AppSettings>) => { state.settings = { ...state.settings, ...patch }; });
  state.sync.mockReset().mockResolvedValue(false); state.folder.mockReset().mockResolvedValue(null); state.read.mockReset().mockResolvedValue(false); state.cancel.mockReset().mockResolvedValue(undefined);
  state.discard.mockReset().mockImplementation(async () => usePipelineStore.getState().reset());
});
afterEach(async () => { await act(async () => renderers.splice(0).forEach((renderer) => renderer.unmount())); });
async function mount(screen: React.ComponentType) { let renderer!: ReactTestRenderer; await act(async () => { renderer = TestRenderer.create(React.createElement(screen)); renderers.push(renderer); await flush(); }); return renderer; }
async function back() { await act(async () => { expect([...state.listeners].reverse().some((listener) => listener())).toBe(true); await flush(); }); }
async function choose(renderer: ReactTestRenderer, title: string) { await act(async () => { renderer.root.findAllByType(host('OptionChoiceCard')).find((node) => node.props.title === title)!.props.onPress(); await flush(); }); }
/** Real ListItem rows are Pressables labelled "title" or "title, description". */
const row = (renderer: ReactTestRenderer, title: string) => renderer.root.findAllByType(host('Pressable'))
  .find((node) => node.props.accessibilityLabel === title || String(node.props.accessibilityLabel).startsWith(`${title}, `))!;
async function enterCategory(renderer: ReactTestRenderer, title: string) { await act(async () => { row(renderer, title).props.onPress(); }); }

describe('actual Settings language/folder UI commit ordering', () => {
  it('does not apply native flags or a restart prompt when preference persistence fails', async () => {
    state.settings.languagePreference = 'en'; state.update.mockRejectedValueOnce(new Error('NO_SPACE'));
    const renderer = await mount(SettingsScreen); await enterCategory(renderer, 'settings.language'); await choose(renderer, 'settings.languageOptions.he');
    expect(state.sync).not.toHaveBeenCalled();
    expect(state.settings.languagePreference).toBe('en');
    expect(useLanguageRestartStore.getState()).toMatchObject({ required: false, promptOpen: false });
    expect(renderer.root.findByType(host('Snackbar')).props.children).toBe('settings.saveFailed');
    expect(renderer.root.findByType(host('Snackbar')).props.visible).toBe(true);
  });

  it('waits for committed preference before sync and exposes pending/Later/reopen state honestly', async () => {
    let resolve!: () => void;
    state.settings.languagePreference = 'en';
    state.update.mockImplementationOnce(async (patch: Partial<AppSettings>) => { await new Promise<void>((accept) => { resolve = accept; }); state.settings = { ...state.settings, ...patch }; });
    state.sync.mockResolvedValueOnce(true);
    const renderer = await mount(SettingsScreen); await enterCategory(renderer, 'settings.language'); await choose(renderer, 'settings.languageOptions.he');
    expect(state.sync).not.toHaveBeenCalled(); expect(state.settings.languagePreference).toBe('en');
    await act(async () => { resolve(); await flush(); });
    expect(state.sync).toHaveBeenCalledExactlyOnceWith('he');
    expect(useLanguageRestartStore.getState()).toMatchObject({ required: true, promptOpen: true });
    await act(async () => useLanguageRestartStore.getState().dismiss());
    const restart = renderer.root.findAllByType(host('SecondaryButton')).find((node) => node.props.children === 'languageRestart.now')!;
    await act(async () => restart.props.onPress());
    expect(useLanguageRestartStore.getState().promptOpen).toBe(true);
    await choose(renderer, 'settings.languageOptions.en');
    expect(useLanguageRestartStore.getState()).toMatchObject({ required: false, promptOpen: false });
  });

  it('keeps the committed custom folder when Android picker is cancelled', async () => {
    state.settings.saveDestinationMode = 'custom-folder';
    state.settings.customFolder = { treeUri: 'content://tree/synthetic', displayName: 'Synthetic', persistedPermission: true };
    const renderer = await mount(SettingsScreen);
    await enterCategory(renderer, 'settings.categories.saving.title');
    const pick = row(renderer, 'settings.chooseFolder');
    await act(async () => { pick.props.onPress(); await flush(); });
    expect(state.folder).toHaveBeenCalledOnce(); expect(state.update).not.toHaveBeenCalled();
    expect(state.settings.customFolder.treeUri).toBe('content://tree/synthetic');
  });

  it('actual organization callbacks send only changed fields while an earlier write is still pending', async () => {
    let finish!: () => void;
    state.update.mockReturnValueOnce(new Promise<void>((accept) => { finish = accept; })).mockResolvedValue(undefined);
    const renderer = await mount(SettingsScreen);
    await enterCategory(renderer, 'settings.categories.saving.title');
    await choose(renderer, 'settings.duplicateModes.keep-both');
    const timestamp = renderer.root.findAllByType(host('SettingRow')).find((node) => node.props.title === 'settings.createExportTimestampFolder')!;
    await act(async () => timestamp.props.onValueChange(true));
    const mode = renderer.root.findAllByType(host('OptionChoiceCard')).find((node) => node.props.title === 'settings.organizationModes.by-sender.title')!;
    await act(async () => mode.props.onPress());
    expect(state.update.mock.calls.map(([patch]) => patch)).toEqual([
      { outputOrganization: { duplicateHandling: 'keep-both' } },
      { outputOrganization: { createExportTimestampFolder: true } },
      { outputOrganization: { mode: 'by-sender' } },
    ]);
    await act(async () => finish());
  });
});

describe('actual secondary-screen Back handlers', () => {
  it.each([['settings', SettingsScreen], ['history', HistoryScreen]] as const)('returns %s to the recorded Select caller without discarding its import', async (stage, Screen) => {
    usePipelineStore.setState({ stage: 'selectFiles', workingDirectory: 'file:///cache/chatstamp/retained/', selectedFileIds: new Set(['hidden']) });
    usePipelineStore.getState().openOverlayStage(stage);
    await mount(Screen); await back();
    expect(usePipelineStore.getState()).toMatchObject({ stage: 'selectFiles', workingDirectory: 'file:///cache/chatstamp/retained/' });
    expect(usePipelineStore.getState().selectedFileIds).toEqual(new Set(['hidden'])); expect(state.discard).not.toHaveBeenCalled();
  });

  it.each(['analyzing', 'saving'] as const)('consumes Back during %s and leaves explicit Cancel available', async (stage) => {
    usePipelineStore.getState().setStage(stage); const renderer = await mount(ProcessingScreen); await back();
    expect(usePipelineStore.getState().stage).toBe(stage); expect(state.cancel).not.toHaveBeenCalled();
    const cancel = renderer.root.findByType(host('SecondaryButton'));
    expect(cancel.props.disabled).toBe(false);
    await act(async () => { cancel.props.onPress(); await flush(); }); expect(state.cancel).toHaveBeenCalledOnce();
  });

  it('retains error/import state when durable save recovery rejects Back, then permits a successful retry', async () => {
    usePipelineStore.setState({ stage: 'error', zipUri: 'content://synthetic/source.zip', workingDirectory: 'file:///cache/chatstamp/retained/' });
    state.discard.mockRejectedValueOnce(new Error('history IO_ERROR'));
    const renderer = await mount(ErrorScreen); await back();
    expect(usePipelineStore.getState()).toMatchObject({ stage: 'error', workingDirectory: 'file:///cache/chatstamp/retained/' });
    expect(renderer.root.findAllByType(host('Text')).some((node) => node.props.children === 'error.recoveryFailed')).toBe(true);
    await back(); expect(usePipelineStore.getState().stage).toBe('welcome');
  });
});
