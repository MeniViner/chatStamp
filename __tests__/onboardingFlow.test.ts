import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { OnboardingFlow } from '../src/screens/onboarding/OnboardingFlow';

const state = vi.hoisted(() => ({ completed: false, update: vi.fn(), clearReplay: vi.fn(), permission: vi.fn(), listeners: [] as (() => boolean)[] }));
vi.mock('../src/store/settingsStore', () => ({ useSettingsStore: (select: (value: unknown) => unknown) => select({ settings: { onboardingCompleted: state.completed }, updateSettings: state.update }) }));
vi.mock('../src/store/onboardingStore', () => ({ useOnboardingStore: (select: (value: unknown) => unknown) => select({ clearReplayRequest: state.clearReplay }) }));
vi.mock('react-native', () => ({
  ScrollView: 'ScrollView', StyleSheet: { create: <T,>(styles: T) => styles },
  PermissionsAndroid: { request: state.permission, requestMultiple: state.permission },
  BackHandler: { addEventListener: (_name: string, listener: () => boolean) => {
    state.listeners.push(listener); return { remove: () => { state.listeners.splice(state.listeners.indexOf(listener), 1); } };
  } },
}));
vi.mock('react-native-paper', () => ({ Text: 'Text' }));
vi.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: 'Icon' }));
vi.mock('../src/theme/useAppTheme', () => ({ useAppTheme: () => ({ colors: { primary: '#123', onSurfaceVariant: '#456', error: '#900' } }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, values?: Record<string, unknown>) => values ? `${key}|${JSON.stringify(values)}` : key }) }));
vi.mock('../src/components/AppUi', async () => {
  const { createElement } = await import('react');
  return { textStyles: { start: {} }, PrimaryButton: 'PrimaryButton',
    AppScreenScaffold: ({ children, footer, ...props }: { children?: React.ReactNode; footer?: React.ReactNode }) => createElement('AppScreenScaffold', props, children, footer) };
});

const host = (name: string) => name as React.ElementType;
const renderers: ReactTestRenderer[] = [];
const env = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
const previous = env.IS_REACT_ACT_ENVIRONMENT;
beforeAll(() => { env.IS_REACT_ACT_ENVIRONMENT = true; });
afterAll(() => { if (previous === undefined) delete env.IS_REACT_ACT_ENVIRONMENT; else env.IS_REACT_ACT_ENVIRONMENT = previous; });
beforeEach(() => { state.completed = false; state.update.mockReset().mockResolvedValue(undefined); state.clearReplay.mockReset(); state.permission.mockReset(); state.listeners.length = 0; });
afterEach(async () => { await act(async () => renderers.splice(0).forEach((renderer) => renderer.unmount())); });

async function mount() {
  const finish = vi.fn(); let renderer!: ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(OnboardingFlow, { onFinish: finish })); renderers.push(renderer); });
  return { renderer, finish, text: () => JSON.stringify(renderer.toJSON()),
    next: async () => { await act(async () => renderer.root.findByType(host('PrimaryButton')).props.onPress()); },
    back: async () => { let consumed = false; await act(async () => { consumed = [...state.listeners].reverse().some((listener) => listener()); }); return consumed; } };
}

describe('actual two-page permission-free onboarding', () => {
  it('shows exactly the purpose/export pages and completes only after the final action', async () => {
    const ui = await mount();
    expect(ui.text()).toContain('onboarding.intro.title');
    expect(ui.renderer.root.findByType(host('AppScreenScaffold')).props.stepLabel).toContain('"total":2');
    await ui.next();
    expect(ui.text()).toContain('onboarding.export.title');
    expect(state.update).not.toHaveBeenCalled();
    expect(ui.finish).not.toHaveBeenCalled();
    await ui.next();
    expect(state.update).toHaveBeenCalledExactlyOnceWith({ onboardingCompleted: true });
    expect(state.clearReplay).toHaveBeenCalledOnce();
    expect(ui.finish).toHaveBeenCalledOnce();
    expect(state.permission).not.toHaveBeenCalled();
  });

  it('uses real Back handlers: export→intro, then lets Android handle Back on a fresh first page', async () => {
    const ui = await mount(); await ui.next();
    expect(await ui.back()).toBe(true); expect(ui.text()).toContain('onboarding.intro.title');
    expect(await ui.back()).toBe(false);
    expect(state.update).not.toHaveBeenCalled(); expect(state.permission).not.toHaveBeenCalled();
  });

  it('leaves replay to its caller without changing persisted onboarding on first-page Back', async () => {
    state.completed = true;
    const ui = await mount();
    expect(await ui.back()).toBe(true);
    expect(state.clearReplay).toHaveBeenCalledOnce();
    expect(state.update).not.toHaveBeenCalled();
  });

  it('shows a recoverable completion error and does not finish after persistence rejects', async () => {
    state.update.mockRejectedValueOnce(new Error('NO_SPACE'));
    const ui = await mount(); await ui.next(); await ui.next();
    expect(ui.text()).toContain('onboarding.saveFailed');
    expect(ui.text()).toContain('onboarding.export.title');
    expect(ui.finish).not.toHaveBeenCalled(); expect(state.clearReplay).not.toHaveBeenCalled();
    await ui.next(); expect(ui.finish).toHaveBeenCalledOnce();
    expect(state.permission).not.toHaveBeenCalled();
  });

  it('reserves final submission against double taps and awaits the actual commit before finishing', async () => {
    let resolve!: () => void;
    state.update.mockReturnValueOnce(new Promise<void>((accept) => { resolve = accept; }));
    const ui = await mount(); await ui.next();
    const press = ui.renderer.root.findByType(host('PrimaryButton')).props.onPress;
    await act(async () => { press(); press(); });
    expect(state.update).toHaveBeenCalledOnce(); expect(ui.finish).not.toHaveBeenCalled();
    expect(ui.renderer.root.findByType(host('PrimaryButton')).props.disabled).toBe(true);
    await act(async () => resolve());
    expect(ui.finish).toHaveBeenCalledOnce(); expect(state.permission).not.toHaveBeenCalled();
  });
});
