import React from 'react';
import TestRenderer, { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsScreen } from '../src/screens/SettingsScreen';
import { usePipelineStore } from '../src/store/pipelineStore';
import { useSettingsStore, awaitSettingsPersistence } from '../src/store/settingsStore';
import { useLanguageRestartStore } from '../src/store/languageRestartStore';
import { defaultSettings } from '../src/store/settingsLogic';
import type { AppSettings, PipelineStage } from '../src/types/media';

const control = vi.hoisted(() => ({
  rtl: false, persisted: null as string | null, listeners: [] as (() => boolean)[], events: [] as string[],
  write: vi.fn(), read: vi.fn(), folder: vi.fn(), sync: vi.fn(), openURL: vi.fn(), appLanguage: vi.fn(),
  replay: vi.fn(), clearHistory: vi.fn(), discard: vi.fn(), cleanup: vi.fn(),
}));
vi.mock('react-native', () => ({
  View: 'View', ScrollView: 'ScrollView', Pressable: 'Pressable', StatusBar: 'StatusBar', Linking: { openURL: control.openURL },
  I18nManager: { get isRTL() { return control.rtl; } },
  StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 },
  BackHandler: { addEventListener: (_name: string, callback: () => boolean) => {
    control.listeners.push(callback); return { remove: () => { control.listeners.splice(control.listeners.indexOf(callback), 1); } };
  } },
}));
vi.mock('expo-application', () => ({ nativeApplicationVersion: '0.2.0', nativeBuildVersion: '14' }));
vi.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: 'Icon' }));
vi.mock('react-native-paper', () => ({ Text: 'Text', Snackbar: 'Snackbar' }));
vi.mock('../src/components/BottomSheet', async () => {
  const { createElement } = await import('react');
  return { BottomSheet: ({ children, footer, ...props }: { visible: boolean; children?: React.ReactNode; footer?: React.ReactNode }) =>
    createElement('BottomSheet', props, props.visible ? children : null, props.visible ? footer : null) };
});
vi.mock('../src/components/ConfirmDialog', () => ({ ConfirmDialog: 'ConfirmDialog' }));
vi.mock('expo-image', () => ({ Image: 'Image' }));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
vi.mock('../src/native/mediaPreviews', () => ({ getThumbnail: vi.fn(), invalidateThumbnail: vi.fn() }));
// Real list rows (ListGroup/ListItem/NavigationItem/AppLogo) prove targets, labels and chevrons; leaf controls stay inspectable hosts.
vi.mock('../src/components/AppUi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../src/components/AppUi')>(),
  InfoRow: 'InfoRow', OptionChoiceCard: 'OptionChoiceCard', PrimaryButton: 'PrimaryButton', SecondaryButton: 'SecondaryButton',
  SettingsSectionCard: 'SettingsSectionCard', SettingRow: 'SettingRow',
}));
vi.mock('../src/screens/WizardScreen', async () => {
  const { createElement } = await import('react');
  return { WizardScreen: ({ children, ...props }: { children?: React.ReactNode }) => createElement('WizardScreen', props, children) };
});
vi.mock('../src/store/jsonFileStorage', () => ({ atomicStore: { read: control.read }, writeJsonFile: control.write }));
vi.mock('../src/lib/logger', () => ({ logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../src/store/historyStore', () => ({ useHistoryStore: (selector: (value: unknown) => unknown) => selector({ clearHistory: control.clearHistory }) }));
vi.mock('../src/store/onboardingStore', () => ({ useOnboardingStore: (selector: (value: unknown) => unknown) => selector({ requestReplay: control.replay }) }));
vi.mock('../src/i18n', () => ({ syncI18nLanguage: control.sync }));
vi.mock('../src/native/appLanguage', () => ({ openAppLanguageSettings: control.appLanguage }));
vi.mock('../src/native/outputFolderPicker', () => ({ openOutputFolderPicker: control.folder }));
vi.mock('../src/services/operationCoordinator', () => ({ discardImport: control.discard }));
vi.mock('../src/native/chatStampNativeModule', () => ({ getChatStampNativeModule: () => ({ cleanupStaleJobsAsync: control.cleanup }) }));
vi.mock('../src/theme/useAppTheme', () => ({ useAppTheme: () => ({ colors: new Proxy<Record<string, string>>({}, { get: () => '#123456' }) }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const host = (name: string) => name as React.ElementType;
const renderers: ReactTestRenderer[] = [];
const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
const previousActEnvironment = environment.IS_REACT_ACT_ENVIRONMENT;
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
beforeAll(() => { environment.IS_REACT_ACT_ENVIRONMENT = true; });
afterAll(() => {
  if (previousActEnvironment === undefined) delete environment.IS_REACT_ACT_ENVIRONMENT;
  else environment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
});
beforeEach(async () => {
  await awaitSettingsPersistence().catch(() => undefined);
  vi.clearAllMocks(); control.listeners.length = 0; control.events.length = 0; control.rtl = false; control.persisted = null;
  control.read.mockImplementation(async () => control.persisted);
  control.write.mockReset().mockImplementation(async (_key: string, value: AppSettings) => { control.persisted = JSON.stringify(value); });
  control.folder.mockReset().mockResolvedValue(null); control.sync.mockReset().mockResolvedValue(false);
  control.openURL.mockReset().mockResolvedValue(undefined); control.appLanguage.mockReset().mockResolvedValue('opened-system-settings');
  control.clearHistory.mockReset().mockResolvedValue(undefined);
  control.discard.mockReset().mockImplementation(async () => { control.events.push('discard'); usePipelineStore.getState().reset(); });
  control.cleanup.mockReset().mockImplementation(async () => { control.events.push('cleanup'); });
  usePipelineStore.getState().reset();
  useLanguageRestartStore.setState({ required: false, promptOpen: false });
  useSettingsStore.setState({ settings: structuredClone(defaultSettings), loaded: false, loadError: null });
  await useSettingsStore.getState().loadSettings();
});
afterEach(async () => {
  await act(async () => renderers.splice(0).forEach((renderer) => renderer.unmount()));
  await awaitSettingsPersistence().catch(() => undefined);
});
async function mount(prior: PipelineStage = 'selectFiles') {
  usePipelineStore.setState({ stage: prior, workingDirectory: 'file:///cache/chatstamp/retained/', selectedFileIds: new Set(['visible', 'hidden']) });
  usePipelineStore.getState().openOverlayStage('settings');
  let renderer!: ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(SettingsScreen)); renderers.push(renderer); });
  return renderer;
}
const find = (renderer: ReactTestRenderer, name: string, matches: (node: ReactTestInstance) => boolean = () => true) => renderer.root.findAllByType(host(name)).find(matches)!;
const button = (renderer: ReactTestRenderer, text: string) => find(renderer, 'SecondaryButton', (node) => node.props.children === text);
async function press(node: ReactTestInstance) { await act(async () => { node.props.onPress(); await flush(); }); }
/** A real ListItem row is a Pressable labelled "title" or "title, description". */
const labelled = (title: string) => (node: ReactTestInstance) => node.props.accessibilityLabel === title || String(node.props.accessibilityLabel).startsWith(`${title}, `);
const row = (renderer: ReactTestRenderer, title: string) => find(renderer, 'Pressable', labelled(title));
async function enter(renderer: ReactTestRenderer, title: string) { await press(row(renderer, title)); }
const flatten = (style: unknown): Record<string, unknown> => Array.isArray(style) ? Object.assign({}, ...style.map(flatten)) : (style && typeof style === 'object' ? style as Record<string, unknown> : {});
async function hardwareBack() { await act(async () => { expect([...control.listeners].reverse().some((callback) => callback())).toBe(true); await flush(); }); }
async function toolbarBack(renderer: ReactTestRenderer) { await act(async () => find(renderer, 'WizardScreen').props.onBack()); }
async function change(renderer: ReactTestRenderer, title: string, value: boolean) {
  await act(async () => { find(renderer, 'SettingRow', (node) => node.props.title === title).props.onValueChange(value); await flush(); });
}
// The version is shown as an LTR-isolated run so "0.2.0 (14)" keeps its order inside RTL rows.
const version = '\u200e0.2.0 (14)';
const categoryTitles = ['settings.categories.saving.title', 'settings.language', 'settings.appearance', 'settings.categories.storage.title', 'settings.categories.help.title', 'settings.categories.advanced.title'];
const categorySummaries = ['saving', 'language', 'appearance', 'storage', 'help', 'advanced'].map((id) => `settings.categories.${id}.summary`);

describe('owner UX14 actual Settings category navigation', () => {
  it('opens exactly the category menu and leaves its controls and destructive actions closed', async () => {
    const renderer = await mount();
    const entries = renderer.root.findAllByType(host('Pressable')).filter((node) => node.props.accessibilityRole === 'button');
    expect(entries.map((node) => node.props.accessibilityLabel)).toEqual([
      ...categoryTitles.map((title, index) => `${title}, ${categorySummaries[index]}`), `onboarding.appName, ${version}`]);
    expect(renderer.root.findAllByType(host('SettingRow'))).toHaveLength(0);
    expect(renderer.root.findAllByType(host('OptionChoiceCard'))).toHaveLength(0);
    expect(renderer.root.findAllByType(host('ConfirmDialog')).every((node) => !node.props.visible)).toBe(true);
    expect(control.write).not.toHaveBeenCalled(); expect(control.cleanup).not.toHaveBeenCalled(); expect(control.clearHistory).not.toHaveBeenCalled();
  });

  it.each([
    ['settings.categories.saving.title', 'SettingRow', 'settings.alwaysUseMessageDate'],
    ['settings.language', 'OptionChoiceCard', 'settings.languageOptions.he'],
    ['settings.appearance', 'SettingRow', 'settings.dynamicColors'],
    ['settings.categories.storage.title', 'Pressable', 'settings.clearHistory'],
    ['settings.categories.help.title', 'Pressable', 'settings.privacyPolicy'],
    ['settings.categories.advanced.title', 'SettingRow', 'settings.developerModeToggle'],
  ])('opens %s controls and returns to menu before the retained Select session', async (title, kind, label) => {
    const renderer = await mount();
    await enter(renderer, title);
    expect(find(renderer, 'WizardScreen').props.title).toBe(title);
    expect(find(renderer, kind, (node) => node.props.title === label || labelled(label)(node))).toBeDefined();
    await hardwareBack();
    expect(find(renderer, 'WizardScreen').props.title).toBe('settings.title');
    expect(usePipelineStore.getState().stage).toBe('settings');
    await toolbarBack(renderer);
    expect(usePipelineStore.getState()).toMatchObject({ stage: 'selectFiles', workingDirectory: 'file:///cache/chatstamp/retained/' });
    expect(usePipelineStore.getState().selectedFileIds).toEqual(new Set(['visible', 'hidden']));
    expect(control.discard).not.toHaveBeenCalled();
  });

  it('opens Help from the About row with the app logo and version', async () => {
    const renderer = await mount();
    const about = row(renderer, 'onboarding.appName');
    expect(about.findAllByType(host('Image'))).toHaveLength(1);
    await press(about);
    expect(find(renderer, 'WizardScreen').props.title).toBe('settings.categories.help.title');
    expect(find(renderer, 'InfoRow', (node) => node.props.label === 'settings.versionBuild').props.value).toBe(version);
    await hardwareBack(); expect(find(renderer, 'WizardScreen').props.title).toBe('settings.title');
  });

  it.each(['welcome', 'results'] as const)('returns the menu to its actual %s caller', async (prior) => {
    const renderer = await mount(prior);
    await toolbarBack(renderer);
    expect(usePipelineStore.getState().stage).toBe(prior);
    expect(control.discard).not.toHaveBeenCalled();
  });

  it.each([false, true])('keeps category entry labels,48dp targets and native RTL=%s chevrons accessible', async (rtl) => {
    control.rtl = rtl;
    const renderer = await mount();
    const entry = row(renderer, 'settings.language');
    // RN Pressable is accessible unless told otherwise: the row is one element exposing role and label.
    expect(entry.props.accessible).not.toBe(false);
    expect(entry.props).toMatchObject({ accessibilityRole: 'button', accessibilityLabel: 'settings.language, settings.categories.language.summary' });
    expect(entry.findAll((node) => node !== entry && (node.props.accessible === true || typeof node.props.accessibilityRole === 'string'))).toHaveLength(0);
    expect(flatten(entry.props.style({ pressed: false })).minHeight).toBeGreaterThanOrEqual(48);
    expect(flatten(entry.props.style({ pressed: true })).minHeight).toBeGreaterThanOrEqual(48);
    expect(entry.findAllByType(host('Icon')).at(-1)?.props.name).toBe(rtl ? 'chevron-left' : 'chevron-right');
  });

  it('dismisses the organization sheet before returning saving→menu→caller', async () => {
    const renderer = await mount();
    await enter(renderer, 'settings.categories.saving.title');
    await press(find(renderer, 'Pressable', (node) => node.findAllByType(host('Text')).some((text) => text.props.children === 'settings.change')));
    expect(find(renderer, 'BottomSheet').props.visible).toBe(true);
    await hardwareBack();
    expect(find(renderer, 'BottomSheet').props.visible).toBe(false);
    expect(find(renderer, 'WizardScreen').props.title).toBe('settings.categories.saving.title');
    await hardwareBack(); expect(usePipelineStore.getState().stage).toBe('settings');
    await hardwareBack(); expect(usePipelineStore.getState().stage).toBe('selectFiles');
  });

  it.each(['settings.clearAppCache', 'settings.clearHistory'])('Back dismisses %s confirmation before its category', async (action) => {
    const renderer = await mount(); await enter(renderer, 'settings.categories.storage.title'); await press(row(renderer, action));
    expect(renderer.root.findAllByType(host('ConfirmDialog')).some((node) => node.props.visible)).toBe(true);
    await toolbarBack(renderer);
    expect(renderer.root.findAllByType(host('ConfirmDialog')).every((node) => !node.props.visible)).toBe(true);
    expect(find(renderer, 'WizardScreen').props.title).toBe('settings.categories.storage.title');
    expect(control.discard).not.toHaveBeenCalled(); expect(control.clearHistory).not.toHaveBeenCalled();
    await hardwareBack(); expect(find(renderer, 'WizardScreen').props.title).toBe('settings.title');
  });
});

describe('owner UX14 category controls preserve actual persisted settings/actions', () => {
  it('persists save policy and appearance changes across category navigation and a real storage reload', async () => {
    const renderer = await mount(); await enter(renderer, 'settings.categories.saving.title');
    await change(renderer, 'settings.alwaysUseMessageDate', false);
    await change(renderer, 'settings.createExportTimestampFolder', true);
    await press(find(renderer, 'OptionChoiceCard', (node) => node.props.title === 'settings.duplicateModes.keep-both'));
    await toolbarBack(renderer); await enter(renderer, 'settings.appearance');
    const dark = () => find(renderer, 'Pressable', (node) => node.props.accessibilityRole === 'radio' && node.props.accessibilityLabel === 'settings.dark');
    expect(renderer.root.findAllByType(host('Pressable')).filter((node) => node.props.accessibilityRole === 'radio').map((node) => node.props.accessibilityLabel))
      .toEqual(['settings.systemDefault', 'settings.light', 'settings.dark']);
    expect(dark().props.accessibilityState).toEqual({ checked: false });
    await press(dark());
    expect(dark().props.accessibilityState).toEqual({ checked: true });
    await change(renderer, 'settings.dynamicColors', false);
    await act(async () => useSettingsStore.getState().loadSettings());
    expect(useSettingsStore.getState().settings).toMatchObject({ alwaysUseMessageDate: false, appearance: 'dark', useDynamicColors: false,
      outputOrganization: { createExportTimestampFolder: true, duplicateHandling: 'keep-both' } });
    await toolbarBack(renderer); await enter(renderer, 'settings.categories.saving.title');
    expect(find(renderer, 'SettingRow', (node) => node.props.title === 'settings.alwaysUseMessageDate').props.value).toBe(false);
    expect(usePipelineStore.getState().selectedFileIds).toEqual(new Set(['visible', 'hidden']));
  });

  it('retains the last committed policy and exposes a failed write inside its category', async () => {
    control.write.mockRejectedValueOnce(new Error('NO_SPACE'));
    const renderer = await mount(); await enter(renderer, 'settings.categories.saving.title');
    await change(renderer, 'settings.alwaysUseMessageDate', false);
    expect(useSettingsStore.getState().settings.alwaysUseMessageDate).toBe(true);
    expect(find(renderer, 'Snackbar').props).toMatchObject({ visible: true, children: 'settings.saveFailed' });
    await toolbarBack(renderer); await enter(renderer, 'settings.categories.saving.title');
    expect(find(renderer, 'SettingRow', (node) => node.props.title === 'settings.alwaysUseMessageDate').props.value).toBe(true);
  });

  it('commits a language preference before applying direction and keeps restart available after Later', async () => {
    let complete!: () => void;
    control.write.mockImplementationOnce(async (_key: string, settings: AppSettings) => {
      await new Promise<void>((resolve) => { complete = resolve; }); control.persisted = JSON.stringify(settings);
    });
    control.sync.mockResolvedValueOnce(true);
    const renderer = await mount(); await enter(renderer, 'settings.language');
    await press(find(renderer, 'OptionChoiceCard', (node) => node.props.title === 'settings.languageOptions.he'));
    expect(control.sync).not.toHaveBeenCalled();
    expect(useSettingsStore.getState().settings.languagePreference).toBe('system');
    await act(async () => { complete(); await flush(); });
    expect(control.sync).toHaveBeenCalledExactlyOnceWith('he');
    expect(useLanguageRestartStore.getState()).toMatchObject({ required: true, promptOpen: true });
    await act(async () => useLanguageRestartStore.getState().dismiss());
    await toolbarBack(renderer); await enter(renderer, 'settings.language'); await press(button(renderer, 'languageRestart.now'));
    expect(useLanguageRestartStore.getState().promptOpen).toBe(true);
    await press(row(renderer, 'settings.openAppLanguageSettings'));
    expect(control.appLanguage).toHaveBeenCalledOnce();
  });

  it('retains custom-folder selection, picker cancellation and persisted reset from the saving category', async () => {
    control.folder.mockResolvedValueOnce({ treeUri: 'content://synthetic/treeA', displayName: 'QA destination', persistedPermission: true });
    const renderer = await mount(); await enter(renderer, 'settings.categories.saving.title');
    await press(row(renderer, 'settings.chooseFolder'));
    expect(useSettingsStore.getState().settings).toMatchObject({ saveDestinationMode: 'custom-folder', customFolder: { treeUri: 'content://synthetic/treeA' } });
    await press(row(renderer, 'settings.chooseFolder'));
    expect(useSettingsStore.getState().settings.customFolder?.treeUri).toBe('content://synthetic/treeA');
    await press(row(renderer, 'settings.resetToDefault'));
    await act(async () => useSettingsStore.getState().loadSettings());
    expect(useSettingsStore.getState().settings).toMatchObject({ saveDestinationMode: 'default-accurate-folder', customFolder: null, useDefaultFolder: true });
  });

  it('keeps privacy/support, welcome replay and version information reachable from Help', async () => {
    const renderer = await mount(); await enter(renderer, 'settings.categories.help.title');
    await press(row(renderer, 'settings.privacyPolicy')); await press(row(renderer, 'settings.contactSupport'));
    expect(control.openURL.mock.calls).toEqual([['https://meniviner.github.io/chatStamp/privacy-policy.html'], ['mailto:menis10tec@gmail.com']]);
    expect(row(renderer, 'settings.showWelcomeTourAgain').props.accessibilityLabel).toBe('settings.showWelcomeTourAgain, settings.welcomeTourBody');
    await press(row(renderer, 'settings.showWelcomeTourAgain')); expect(control.replay).toHaveBeenCalledOnce();
    expect(find(renderer, 'InfoRow', (node) => node.props.label === 'settings.versionBuild').props.value).toBe(version);
  });

  it('keeps clear-history/cache confirmation and original cleanup ordering reachable from Storage', async () => {
    const renderer = await mount(); await enter(renderer, 'settings.categories.storage.title');
    await press(row(renderer, 'settings.clearHistory'));
    expect(control.clearHistory).not.toHaveBeenCalled();
    await act(async () => { find(renderer, 'ConfirmDialog', (node) => node.props.title === 'settings.clearHistoryTitle').props.onConfirm(); await flush(); });
    expect(control.clearHistory).toHaveBeenCalledOnce();
    await press(row(renderer, 'settings.clearAppCache'));
    expect(control.discard).not.toHaveBeenCalled();
    await act(async () => { find(renderer, 'ConfirmDialog', (node) => node.props.title === 'settings.clearCacheTitle').props.onConfirm(); await flush(); });
    expect(control.events).toEqual(['discard', 'cleanup']);
    expect(find(renderer, 'Snackbar').props).toMatchObject({ visible: true, children: 'settings.cacheClearedBody' });
  });

  it('preserves developer controls and turns technical logs off with developer mode', async () => {
    const renderer = await mount(); await enter(renderer, 'settings.categories.advanced.title');
    expect(find(renderer, 'SettingRow', (node) => node.props.title === 'settings.showTechnicalLogs')).toBeUndefined();
    await change(renderer, 'settings.developerModeToggle', true);
    await change(renderer, 'settings.showTechnicalLogs', true);
    await change(renderer, 'settings.keepCache', true);
    await change(renderer, 'settings.developerModeToggle', false);
    await act(async () => useSettingsStore.getState().loadSettings());
    expect(useSettingsStore.getState().settings).toMatchObject({ developerMode: false, showTechnicalLogs: false, keepCacheAfterFailedRun: true });
  });
});
