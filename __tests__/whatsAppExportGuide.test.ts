import React from 'react';
import TestRenderer, { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppNavigator } from '../src/screens/AppNavigator';
import { usePipelineStore } from '../src/store/pipelineStore';
import en from '../src/i18n/locales/en.json';
import he from '../src/i18n/locales/he.json';
import type { NativeSharedZipResult } from '../src/native/chatStampNativeModule';

const control = vi.hoisted(() => ({
  language: 'en', back: [] as (() => boolean)[], picker: vi.fn(), attach: vi.fn(),
  reset: vi.fn(), permission: vi.fn(), allowRTL: vi.fn(), forceRTL: vi.fn(), openURL: vi.fn(),
  pending: null as NativeSharedZipResult | null, shareSubscribers: new Set<() => void>(), accept: vi.fn(), dismiss: vi.fn(),
}));
vi.mock('react-native', () => ({
  View: 'View', ScrollView: 'ScrollView', Pressable: 'Pressable', StatusBar: 'StatusBar',
  StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 },
  I18nManager: { get isRTL() { return control.language === 'he'; }, allowRTL: control.allowRTL, forceRTL: control.forceRTL },
  PermissionsAndroid: { request: control.permission }, Linking: { openURL: control.openURL },
  BackHandler: { addEventListener: (_event: string, callback: () => boolean) => {
    control.back.push(callback); return { remove: () => { control.back.splice(control.back.indexOf(callback), 1); } };
  } },
}));
vi.mock('react-native-paper', async () => {
  const { createElement } = await import('react');
  return {
    Appbar: { Header: 'AppbarHeader', BackAction: 'AppbarBackAction', Action: 'AppbarAction' },
    Button: 'Button', Text: 'Text', Surface: 'Surface', Chip: 'Chip', ProgressBar: 'ProgressBar', RadioButton: 'RadioButton', Switch: 'Switch', IconButton: 'IconButton',
    Portal: ({ children }: { children: React.ReactNode }) => children,
    Dialog: Object.assign(({ children, ...props }: { children: React.ReactNode }) => createElement('Dialog', props, children),
      { Title: 'DialogTitle', Content: 'DialogContent', Actions: 'DialogActions' }),
  };
});
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
vi.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: 'Icon' }));
vi.mock('expo-image', () => ({ Image: 'Image' }));
vi.mock('../src/native/mediaPreviews', () => ({ getThumbnail: vi.fn(), invalidateThumbnail: vi.fn() }));
vi.mock('../src/services/operationCoordinator', () => ({
  chooseZip: control.picker, discardImport: control.reset, attachPipelineRuntime: control.attach,
  observePendingShare: (callback: () => void) => { control.shareSubscribers.add(callback); return () => control.shareSubscribers.delete(callback); },
  pendingSharedZip: () => control.pending, acceptSharedZip: control.accept, dismissSharedZip: control.dismiss,
}));
vi.mock('../src/components/ConfirmDialog', () => ({ ConfirmDialog: 'ConfirmDialog' }));
vi.mock('../src/screens/FileSelectionScreen', () => ({ FileSelectionScreen: 'FileSelectionScreen' }));
vi.mock('../src/screens/ProcessingScreen', () => ({ ProcessingScreen: 'ProcessingScreen' }));
vi.mock('../src/screens/DoneScreen', () => ({ DoneScreen: 'DoneScreen' }));
vi.mock('../src/screens/ErrorScreen', () => ({ ErrorScreen: 'ErrorScreen' }));
vi.mock('../src/screens/SettingsScreen', () => ({ SettingsScreen: 'SettingsScreen' }));
vi.mock('../src/screens/HistoryScreen', () => ({ HistoryScreen: 'HistoryScreen' }));
vi.mock('../src/theme/useAppTheme', () => ({ useAppTheme: () => ({ dark: false, colors: new Proxy<Record<string, string>>({}, { get: () => '#123456' }) }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({
  t: translate, i18n: { get resolvedLanguage() { return control.language; } },
}) }));

function translate(key: string, values: Record<string, unknown> = {}): string {
  let value: unknown = control.language === 'he' ? he : en;
  for (const part of key.split('.')) value = value && typeof value === 'object' ? (value as Record<string, unknown>)[part] : undefined;
  return typeof value === 'string' ? value.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, name: string) => String(values[name] ?? '')) : key;
}
const pages = ['openChat', 'menu', 'exportChat', 'includeMedia', 'shareToApp', 'automaticImport'] as const;
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
beforeEach(() => {
  control.language = 'en'; control.back.length = 0; vi.clearAllMocks();
  control.pending = null; control.shareSubscribers.clear();
  control.dismiss.mockImplementation(() => { control.pending = null; control.shareSubscribers.forEach((callback) => callback()); });
  control.attach.mockReturnValue(() => undefined);
  usePipelineStore.getState().reset();
});
afterEach(async () => { await act(async () => renderers.splice(0).forEach((renderer) => renderer.unmount())); });
async function mount() {
  let renderer!: ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(AppNavigator)); renderers.push(renderer); });
  return renderer;
}
const textValues = (renderer: ReactTestRenderer) => renderer.root.findAllByType(host('Text')).map((node) => node.props.children);
const button = (renderer: ReactTestRenderer, key: string) => renderer.root.findAllByType(host('Button')).find((node) => node.props.children === translate(key))!;
/** A real home list row or banner: a Pressable labelled "title" or "title, description". */
const entry = (renderer: ReactTestRenderer, key: string) => renderer.root.findAllByType(host('Pressable'))
  .find((node) => node.props.accessibilityRole === 'button' && (node.props.accessibilityLabel === translate(key) || String(node.props.accessibilityLabel).startsWith(`${translate(key)}, `)))!;
async function press(node: ReactTestInstance) { await act(async () => { node.props.onPress(); await flush(); }); }
async function open(renderer: ReactTestRenderer, page = 0) {
  await press(entry(renderer, 'import.openGuide'));
  for (let index = 0; index < page; index++) await press(button(renderer, 'common.next'));
}
function assertNoIntakeSideEffects() {
  expect(control.picker).not.toHaveBeenCalled(); expect(control.reset).not.toHaveBeenCalled(); expect(control.permission).not.toHaveBeenCalled();
  expect(control.allowRTL).not.toHaveBeenCalled(); expect(control.forceRTL).not.toHaveBeenCalled();
}

describe('actual bilingual WhatsApp home guidance and guide flow', () => {
  it.each(['en', 'he'])('prominently exposes direct-share guidance in %s without removing the manual picker fallback', async (language) => {
    control.language = language;
    const renderer = await mount();
    expect(textValues(renderer)).toContain(translate('import.shareTitle'));
    expect(textValues(renderer)).toContain(translate('import.shareBody'));
    expect(translate('import.shareBody')).toMatch(/WhatsApp/);
    // The share guidance is the first, prominent banner and itself opens the guide; a list row offers the same guide.
    const banner = entry(renderer, 'import.shareTitle');
    expect(banner.props.accessibilityLabel).toBe(`${translate('import.shareTitle')}, ${translate('import.shareBody')}`);
    expect(entry(renderer, 'import.openGuide')).toBeDefined();
    // "Choose ZIP" is the footer primary action only; no list row duplicates it.
    const choose = renderer.root.findAllByType(host('Button')).filter((node) => node.props.children === translate('import.chooseZip'));
    expect(choose).toHaveLength(1);
    expect(choose[0].props.mode).toBe('contained');
    expect(entry(renderer, 'import.chooseZip')).toBeUndefined();
    expect(renderer.root.findAllByType(host('Pressable')).some((node) => String(node.props.accessibilityLabel ?? '').includes(translate('import.chooseZip')))).toBe(false);
    expect(entry(renderer, 'history.title').props.accessibilityLabel).toBe(`${translate('history.title')}, ${translate('history.subtitle')}`);
    expect(translate('import.subtitle')).toBe('import.subtitle');
    assertNoIntakeSideEffects();
    await press(choose[0]);
    expect(control.picker).toHaveBeenCalledOnce();
    expect(control.reset).not.toHaveBeenCalled();
    await press(banner);
    expect(textValues(renderer)).toContain(translate('whatsAppGuide.steps.openChat.title'));
    expect(control.picker).toHaveBeenCalledOnce();
  });

  it.each(['en', 'he'])('renders all six translated instruction pages in %s with bounded Previous/Next and explicit finish', async (language) => {
    control.language = language;
    const renderer = await mount(); await open(renderer);
    expect(button(renderer, 'whatsAppGuide.previous').props.disabled).toBe(true);
    await press(button(renderer, 'whatsAppGuide.previous'));
    for (let index = 0; index < pages.length; index++) {
      const title = translate(`whatsAppGuide.steps.${pages[index]}.title`);
      const body = translate(`whatsAppGuide.steps.${pages[index]}.body`);
      expect(title).not.toMatch(/^whatsAppGuide\./); expect(body).not.toMatch(/^whatsAppGuide\./);
      expect(textValues(renderer)).toContain(title); expect(textValues(renderer)).toContain(body);
      expect(textValues(renderer)).toContain(translate('common.stepOf', { current: index + 1, total: 6 }));
      if (index === 1) {
        expect(body).toMatch(language === 'he' ? /עוד|נוספ/ : /more/i);
        expect(body).toMatch(language === 'he' ? /אם|עשוי|לעתים|בחלק/ : /if|may|sometimes|depending/i);
        await press(button(renderer, 'whatsAppGuide.previous'));
        expect(textValues(renderer)).toContain(translate('whatsAppGuide.steps.openChat.title'));
        await press(button(renderer, 'common.next'));
      }
      if (index < pages.length - 1) await press(button(renderer, 'common.next'));
    }
    expect(button(renderer, 'common.next')).toBeUndefined();
    expect(translate('whatsAppGuide.steps.includeMedia.body')).toMatch(language === 'he' ? /מדיה/ : /media/i);
    expect(translate('whatsAppGuide.steps.shareToApp.body')).toMatch(/chatStamp/);
    await press(button(renderer, 'whatsAppGuide.finish'));
    expect(entry(renderer, 'import.openGuide')).toBeDefined(); assertNoIntakeSideEffects();
    expect(usePipelineStore.getState().stage).toBe('welcome');
  });

  it.each([
    { page: 0, action: 'hardware' }, { page: 3, action: 'hardware' }, { page: 5, action: 'hardware' },
    { page: 2, action: 'back' }, { page: 4, action: 'close' },
  ])('$action from guide page $page returns home without resetting or launching a picker', async ({ page, action }) => {
    const renderer = await mount(); await open(renderer, page);
    if (action === 'hardware') {
      await act(async () => { expect([...control.back].reverse().some((callback) => callback())).toBe(true); });
    } else {
      const label = translate(action === 'close' ? 'common.close' : 'common.back');
      const target = renderer.root.findAll((node) => typeof node.type === 'string' && node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
      expect(target).toBeDefined(); await press(target);
    }
    expect(entry(renderer, 'import.openGuide')).toBeDefined();
    expect(usePipelineStore.getState().stage).toBe('welcome'); assertNoIntakeSideEffects();
  });

  it('yields an open guide immediately to an incoming import and preserves its source/selection', async () => {
    const renderer = await mount(); await open(renderer, 4);
    await act(async () => usePipelineStore.setState({ stage: 'analyzing', zipUri: 'content://com.whatsapp.provider.media/synthetic',
      workingDirectory: 'file:///cache/chatstamp/incoming/', selectedFileIds: new Set(['retained-selection']) }));
    expect(renderer.root.findAllByType(host('ProcessingScreen'))).toHaveLength(1);
    expect(textValues(renderer)).not.toContain(translate('whatsAppGuide.steps.shareToApp.title'));
    await act(async () => usePipelineStore.getState().setStage('selectFiles'));
    expect(renderer.root.findAllByType(host('FileSelectionScreen'))).toHaveLength(1);
    expect(usePipelineStore.getState()).toMatchObject({ zipUri: 'content://com.whatsapp.provider.media/synthetic', workingDirectory: 'file:///cache/chatstamp/incoming/' });
    expect(usePipelineStore.getState().selectedFileIds).toEqual(new Set(['retained-selection']));
    await act(async () => usePipelineStore.getState().setStage('welcome'));
    expect(entry(renderer, 'import.openGuide')).toBeDefined(); assertNoIntakeSideEffects();
  });

  it.each(['history', 'settings'] as const)('retains the existing %s action from home', async (stage) => {
    const renderer = await mount();
    await press(renderer.root.findAllByType(host('AppbarAction')).find((node) => node.props.accessibilityLabel === translate(`${stage}.title`))!);
    expect(usePipelineStore.getState()).toMatchObject({ stage, overlayReturnStage: 'welcome' });
    expect(renderer.root.findAllByType(host(stage === 'history' ? 'HistoryScreen' : 'SettingsScreen'))).toHaveLength(1);
    assertNoIntakeSideEffects();
  });

  it('opens History from the home list row as well as the toolbar', async () => {
    const renderer = await mount();
    await press(entry(renderer, 'history.title'));
    expect(usePipelineStore.getState()).toMatchObject({ stage: 'history', overlayReturnStage: 'welcome' });
    expect(renderer.root.findAllByType(host('HistoryScreen'))).toHaveLength(1);
    assertNoIntakeSideEffects();
  });

  it.each(['en', 'he'] as const)('removed import.subtitle from the %s locale', (language) => {
    const locale: Record<string, unknown> = (language === 'he' ? he : en).import;
    expect(locale).not.toHaveProperty('subtitle');
  });

  it.each(['close-button', 'dialog-dismiss'] as const)('shows a busy unsupported share as dismiss-only information via %s', async (action) => {
    control.language = 'he';
    usePipelineStore.setState({ stage: 'selectFiles', zipUri: 'chatstamp-share://existing-valid',
      workingDirectory: 'file:///cache/chatstamp/active/', selectedFileIds: new Set(['first', 'hidden']) });
    const renderer = await mount();
    await act(async () => {
      control.pending = { received: true, id: 'unsupported-share', errorCode: 'SHARE_INVALID' };
      control.shareSubscribers.forEach((callback) => callback());
    });
    expect(renderer.root.findByType(host('Dialog')).props.visible).toBe(true);
    expect(renderer.root.findAllByType(host('ConfirmDialog'))).toHaveLength(0);
    expect(textValues(renderer)).toContain(translate('error.codes.SHARE_INVALID'));
    expect(translate('error.codes.SHARE_INVALID')).toMatch(/[א-ת]/);
    expect(renderer.root.findAllByType(host('Button'))).toHaveLength(1);
    if (action === 'close-button') await press(button(renderer, 'common.close'));
    else await act(async () => renderer.root.findByType(host('Dialog')).props.onDismiss());
    expect(control.dismiss).toHaveBeenCalledOnce(); expect(control.accept).not.toHaveBeenCalled();
    expect(usePipelineStore.getState()).toMatchObject({ stage: 'selectFiles', zipUri: 'chatstamp-share://existing-valid', workingDirectory: 'file:///cache/chatstamp/active/' });
    expect(usePipelineStore.getState().selectedFileIds).toEqual(new Set(['first', 'hidden']));
    assertNoIntakeSideEffects();
  });

  it.each([false, true])('holds the %s invalid-share prompt behind an active save and restores it afterward', async (invalid) => {
    control.pending = invalid ? { received: true, id: 'pending-invalid', errorCode: 'SHARE_INVALID' }
      : { received: true, id: 'pending-valid', sourceUri: 'chatstamp-share://next-export', filename: 'next.zip' };
    usePipelineStore.setState({ stage: 'saving', workingDirectory: 'file:///cache/chatstamp/saving/' });
    const renderer = await mount();
    expect(renderer.root.findAllByType(host('Dialog'))).toHaveLength(0);
    expect(renderer.root.findAllByType(host('ConfirmDialog'))).toHaveLength(0);
    expect(control.pending?.id).toBe(invalid ? 'pending-invalid' : 'pending-valid');
    await act(async () => usePipelineStore.getState().setStage('results'));
    expect(renderer.root.findByType(host(invalid ? 'Dialog' : 'ConfirmDialog')).props.visible).toBe(true);
    expect(control.accept).not.toHaveBeenCalled(); expect(control.dismiss).not.toHaveBeenCalled();
    expect(usePipelineStore.getState().workingDirectory).toBe('file:///cache/chatstamp/saving/');
    assertNoIntakeSideEffects();
  });
});
