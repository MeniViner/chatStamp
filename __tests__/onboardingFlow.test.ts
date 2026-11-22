import React from 'react';
import TestRenderer, { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { OnboardingFlow } from '../src/screens/onboarding/OnboardingFlow';
import en from '../src/i18n/locales/en.json';
import he from '../src/i18n/locales/he.json';

const state = vi.hoisted(() => ({
  completed: false, update: vi.fn(), clearReplay: vi.fn(), check: vi.fn(), request: vi.fn(), openSettings: vi.fn(),
  platform: { OS: 'android', Version: 34 as number | string },
  listeners: [] as (() => boolean)[], appStateListeners: [] as ((value: string) => void)[]
}));
vi.mock('../src/store/settingsStore', () => ({ useSettingsStore: (select: (value: unknown) => unknown) => select({ settings: { onboardingCompleted: state.completed }, updateSettings: state.update }) }));
vi.mock('../src/store/onboardingStore', () => ({ useOnboardingStore: (select: (value: unknown) => unknown) => select({ clearReplayRequest: state.clearReplay }) }));
vi.mock('react-native', () => ({
  ScrollView: 'ScrollView', View: 'View', StyleSheet: { create: <T,>(styles: T) => styles },
  Platform: state.platform,
  Linking: { openSettings: state.openSettings },
  PermissionsAndroid: {
    check: state.check, request: state.request,
    PERMISSIONS: { POST_NOTIFICATIONS: 'android.permission.POST_NOTIFICATIONS' },
    RESULTS: { GRANTED: 'granted', DENIED: 'denied', NEVER_ASK_AGAIN: 'never_ask_again' }
  },
  AppState: { addEventListener: (_name: string, listener: (value: string) => void) => {
    state.appStateListeners.push(listener);
    return { remove: () => { state.appStateListeners.splice(state.appStateListeners.indexOf(listener), 1); } };
  } },
  BackHandler: { addEventListener: (_name: string, listener: () => boolean) => {
    state.listeners.push(listener); return { remove: () => { state.listeners.splice(state.listeners.indexOf(listener), 1); } };
  } },
}));
vi.mock('react-native-paper', () => ({ Text: 'Text', Button: 'Button' }));
vi.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: 'Icon' }));
vi.mock('../src/theme/useAppTheme', () => ({ useAppTheme: () => ({ colors: {
  primary: '#123', onPrimary: '#fff', onSurfaceVariant: '#456', error: '#900', outlineVariant: '#789',
  secondaryContainer: '#abc', onSecondaryContainer: '#def'
} }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, values?: Record<string, unknown>) => values ? `${key}|${JSON.stringify(values)}` : key }) }));
vi.mock('../src/components/ConfirmDialog', () => ({ ConfirmDialog: 'ConfirmDialog' }));
vi.mock('../src/components/AppUi', async () => {
  const { createElement } = await import('react');
  type Slots = { children?: React.ReactNode; footer?: React.ReactNode; leading?: React.ReactNode; trailing?: React.ReactNode };
  return { textStyles: { start: {} }, PrimaryButton: 'PrimaryButton', ListGroup: 'ListGroup', AppLogo: 'AppLogo', forwardArrow: () => 'arrow-right',
    ListItem: ({ leading, trailing, children, ...props }: Slots) => createElement('ListItem', props, leading, children, trailing),
    AppScreenScaffold: ({ children, footer, ...props }: Slots) => createElement('AppScreenScaffold', props, children, footer) };
});

const host = (name: string) => name as React.ElementType;
const renderers: ReactTestRenderer[] = [];
const env = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
const previous = env.IS_REACT_ACT_ENVIRONMENT;
beforeAll(() => { env.IS_REACT_ACT_ENVIRONMENT = true; });
afterAll(() => { if (previous === undefined) delete env.IS_REACT_ACT_ENVIRONMENT; else env.IS_REACT_ACT_ENVIRONMENT = previous; });
beforeEach(() => {
  state.completed = false; state.update.mockReset().mockResolvedValue(undefined); state.clearReplay.mockReset();
  state.check.mockReset().mockResolvedValue(false); state.request.mockReset().mockResolvedValue('granted');
  state.openSettings.mockReset().mockResolvedValue(undefined); state.platform.Version = 34;
  state.listeners.length = 0; state.appStateListeners.length = 0;
});
afterEach(async () => { await act(async () => renderers.splice(0).forEach((renderer) => renderer.unmount())); });

async function mount() {
  const finish = vi.fn(); let renderer!: ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(OnboardingFlow, { onFinish: finish })); renderers.push(renderer); });
  const primary = () => renderer.root.findByType(host('PrimaryButton'));
  const buttons = (label: string) => renderer.root.findAllByType(host('Button')).filter((button: ReactTestInstance) => button.props.children === label);
  const dialogs = () => renderer.root.findAllByType(host('ConfirmDialog'));
  return { renderer, finish, primary, buttons, dialogs, text: () => JSON.stringify(renderer.toJSON()),
    step: () => renderer.root.find((node) => node.type === host('View') && String(node.props.accessibilityLabel).startsWith('common.stepOf')).props.accessibilityLabel,
    granted: () => renderer.root.findAll((node) => node.type === host('View') && node.props.accessibilityLabel === 'onboarding.permissions.granted').length > 0,
    // A disabled native button never delivers a press, so the helper refuses to fake one.
    next: async () => { expect(primary().props.disabled).not.toBe(true); await act(async () => primary().props.onPress()); },
    press: async (label: string) => { const [button] = buttons(label); expect(button).toBeDefined(); await act(async () => button.props.onPress()); },
    resume: async () => { await act(async () => [...state.appStateListeners].forEach((listener) => listener('active'))); },
    back: async () => { let consumed = false; await act(async () => { consumed = [...state.listeners].reverse().some((listener) => listener()); }); return consumed; } };
}

async function toExport(ui: Awaited<ReturnType<typeof mount>>) {
  await ui.next(); await ui.press('onboarding.permissions.grant'); await ui.next();
  expect(ui.text()).toContain('onboarding.export.title');
}

describe('actual three-page onboarding with a notifications permission page', () => {
  it('shows exactly intro → permissions → export and completes only after the final action', async () => {
    const ui = await mount();
    expect(ui.text()).toContain('onboarding.intro.title');
    expect(ui.step()).toBe('common.stepOf|{"current":1,"total":3}');
    expect(state.check).not.toHaveBeenCalled(); expect(state.request).not.toHaveBeenCalled();
    await ui.next();
    expect(ui.text()).toContain('onboarding.permissions.title');
    expect(ui.step()).toBe('common.stepOf|{"current":2,"total":3}');
    expect(state.check).toHaveBeenCalledWith('android.permission.POST_NOTIFICATIONS');
    expect(state.request).not.toHaveBeenCalled();
    expect(ui.granted()).toBe(false);
    expect(ui.buttons('onboarding.permissions.grant')).toHaveLength(1);
    expect(ui.primary().props.disabled).not.toBe(true);
    await ui.press('onboarding.permissions.grant');
    expect(state.request).toHaveBeenCalledExactlyOnceWith('android.permission.POST_NOTIFICATIONS');
    expect(ui.granted()).toBe(true);
    expect(ui.buttons('onboarding.permissions.grant')).toHaveLength(0);
    expect(ui.buttons('onboarding.permissions.skip')).toHaveLength(0);
    expect(ui.primary().props.disabled).toBe(false);
    await ui.next();
    expect(ui.text()).toContain('onboarding.export.title');
    expect(ui.step()).toBe('common.stepOf|{"current":3,"total":3}');
    expect(state.update).not.toHaveBeenCalled(); expect(ui.finish).not.toHaveBeenCalled();
    await ui.next();
    expect(state.update).toHaveBeenCalledExactlyOnceWith({ onboardingCompleted: true });
    expect(state.clearReplay).toHaveBeenCalledOnce();
    expect(ui.finish).toHaveBeenCalledOnce();
    expect(state.request).toHaveBeenCalledOnce();
  });

  it('shows the granted mark without prompting when notifications are already allowed', async () => {
    state.check.mockResolvedValue(true);
    const ui = await mount(); await ui.next();
    expect(ui.granted()).toBe(true);
    expect(ui.buttons('onboarding.permissions.grant')).toHaveLength(0);
    expect(ui.primary().props.disabled).toBe(false);
    expect(state.request).not.toHaveBeenCalled();
  });

  it('has only intro → export on Android below 13 and never checks or requests the permission', async () => {
    state.platform.Version = 32;
    const ui = await mount();
    expect(ui.text()).toContain('onboarding.intro.title');
    expect(ui.step()).toBe('common.stepOf|{"current":1,"total":2}');
    await ui.next();
    expect(ui.text()).toContain('onboarding.export.title');
    expect(ui.text()).not.toContain('onboarding.permissions.title');
    expect(ui.step()).toBe('common.stepOf|{"current":2,"total":2}');
    expect(ui.buttons('onboarding.permissions.grant')).toHaveLength(0);
    await ui.resume();
    await ui.next();
    expect(state.update).toHaveBeenCalledExactlyOnceWith({ onboardingCompleted: true });
    expect(ui.finish).toHaveBeenCalledOnce();
    expect(state.check).not.toHaveBeenCalled(); expect(state.request).not.toHaveBeenCalled();
    expect(state.openSettings).not.toHaveBeenCalled();
  });

  it('lets Next advance from the permission page without granting; there is no Skip action or skip dialog', async () => {
    const ui = await mount(); await ui.next();
    expect(ui.text()).toContain('onboarding.permissions.title');
    expect(ui.granted()).toBe(false);
    expect(ui.buttons('onboarding.permissions.skip')).toHaveLength(0);
    expect(ui.text()).not.toContain('onboarding.permissions.skip');
    expect(ui.dialogs()).toHaveLength(0);
    await ui.next();
    expect(ui.text()).toContain('onboarding.export.title');
    expect(state.request).not.toHaveBeenCalled();
    expect(state.update).not.toHaveBeenCalled(); expect(ui.finish).not.toHaveBeenCalled();
  });

  it('removed the skip strings from both locales', () => {
    for (const locale of [en, he]) {
      const permissions: Record<string, unknown> = locale.onboarding.permissions;
      for (const key of ['skip', 'skipTitle', 'skipAnyway']) expect(permissions).not.toHaveProperty(key);
      expect(typeof permissions.granted).toBe('string');
    }
  });

  it('switches to the settings action after a permanent denial and re-checks when the app returns', async () => {
    state.request.mockResolvedValue('never_ask_again');
    const ui = await mount(); await ui.next();
    await ui.press('onboarding.permissions.grant');
    expect(ui.buttons('onboarding.permissions.grant')).toHaveLength(0);
    expect(ui.buttons('onboarding.permissions.openSettings')).toHaveLength(1);
    expect(ui.primary().props.disabled).not.toBe(true);
    await ui.press('onboarding.permissions.openSettings');
    expect(state.openSettings).toHaveBeenCalledOnce();
    expect(state.request).toHaveBeenCalledOnce();
    await ui.resume();
    expect(ui.buttons('onboarding.permissions.openSettings')).toHaveLength(1);
    state.check.mockResolvedValue(true);
    await ui.resume();
    expect(ui.granted()).toBe(true);
    expect(ui.primary().props.disabled).toBe(false);
  });

  it('keeps Allow after an ordinary denial so the prompt can be retried', async () => {
    state.request.mockResolvedValueOnce('denied').mockResolvedValueOnce('granted');
    const ui = await mount(); await ui.next();
    await ui.press('onboarding.permissions.grant');
    expect(ui.granted()).toBe(false);
    expect(ui.buttons('onboarding.permissions.grant')).toHaveLength(1);
    expect(ui.buttons('onboarding.permissions.openSettings')).toHaveLength(0);
    expect(ui.primary().props.disabled).not.toBe(true);
    await ui.press('onboarding.permissions.grant');
    expect(state.request).toHaveBeenCalledTimes(2);
    expect(ui.granted()).toBe(true);
    expect(state.openSettings).not.toHaveBeenCalled();
  });

  it('uses real Back handlers: export→permissions→intro, then lets Android handle Back on a fresh first page', async () => {
    const ui = await mount(); await toExport(ui);
    expect(await ui.back()).toBe(true); expect(ui.text()).toContain('onboarding.permissions.title');
    expect(await ui.back()).toBe(true); expect(ui.text()).toContain('onboarding.intro.title');
    expect(await ui.back()).toBe(false);
    expect(ui.renderer.root.findByType(host('AppScreenScaffold')).props.onBack).toBeUndefined();
    expect(state.update).not.toHaveBeenCalled();
  });

  it('leaves replay to its caller without changing persisted onboarding on first-page Back', async () => {
    state.completed = true;
    const ui = await mount();
    expect(await ui.back()).toBe(true);
    expect(state.clearReplay).toHaveBeenCalledOnce();
    expect(state.update).not.toHaveBeenCalled();
    expect(state.request).not.toHaveBeenCalled();
  });

  it('shows a recoverable completion error and does not finish after persistence rejects', async () => {
    state.update.mockRejectedValueOnce(new Error('NO_SPACE'));
    const ui = await mount(); await toExport(ui); await ui.next();
    expect(ui.text()).toContain('onboarding.saveFailed');
    expect(ui.text()).toContain('onboarding.export.title');
    expect(ui.finish).not.toHaveBeenCalled(); expect(state.clearReplay).not.toHaveBeenCalled();
    await ui.next(); expect(ui.finish).toHaveBeenCalledOnce();
    expect(state.update).toHaveBeenCalledTimes(2);
  });

  it('reserves final submission against double taps and awaits the actual commit before finishing', async () => {
    let resolve!: () => void;
    state.update.mockReturnValueOnce(new Promise<void>((accept) => { resolve = accept; }));
    const ui = await mount(); await toExport(ui);
    const press = ui.primary().props.onPress;
    await act(async () => { press(); press(); });
    expect(state.update).toHaveBeenCalledOnce(); expect(ui.finish).not.toHaveBeenCalled();
    expect(ui.primary().props.disabled).toBe(true);
    await act(async () => resolve());
    expect(ui.finish).toHaveBeenCalledOnce(); expect(state.update).toHaveBeenCalledOnce();
  });
});
