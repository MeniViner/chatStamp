import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageRestartPrompt } from '../src/components/LanguageRestartPrompt';
import { useLanguageRestartStore } from '../src/store/languageRestartStore';
import { usePipelineStore } from '../src/store/pipelineStore';

const calls = vi.hoisted(() => ({ persist: vi.fn(), discard: vi.fn(), release: vi.fn(), restart: vi.fn(), snapshot: vi.fn(), pending: vi.fn(), reserve: vi.fn(), resume: vi.fn() }));
vi.mock('../src/store/settingsStore', () => ({ awaitSettingsPersistence: calls.persist }));
vi.mock('../src/services/operationCoordinator', () => ({ discardImport: calls.discard, pendingSharedZip: calls.pending, reserveAppRestart: calls.reserve }));
vi.mock('../src/native/chatStampNativeModule', () => ({ getChatStampNativeModule: () => ({ getOperationSnapshotAsync: calls.snapshot }) }));
vi.mock('../src/native/mediaPreviews', () => ({ awaitMediaRelease: calls.release }));
vi.mock('../src/native/appReload', () => ({ restartAppForLanguage: calls.restart }));
vi.mock('../src/components/ConfirmDialog', () => ({ ConfirmDialog: 'ConfirmDialog' }));
vi.mock('react-native-paper', () => ({ Snackbar: 'Snackbar' }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const host = (name: string) => name as React.ElementType;
const renderers: ReactTestRenderer[] = [];
const env = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
const previous = env.IS_REACT_ACT_ENVIRONMENT;
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
function deferred() { let resolve!: () => void; const promise = new Promise<void>((accept) => { resolve = accept; }); return { promise, resolve }; }
beforeAll(() => { env.IS_REACT_ACT_ENVIRONMENT = true; });
afterAll(() => { if (previous === undefined) delete env.IS_REACT_ACT_ENVIRONMENT; else env.IS_REACT_ACT_ENVIRONMENT = previous; });
beforeEach(() => {
  usePipelineStore.getState().reset();
  useLanguageRestartStore.setState({ required: true, promptOpen: true });
  [calls.persist, calls.discard, calls.release, calls.restart].forEach((mock) => mock.mockReset().mockResolvedValue(undefined));
  calls.snapshot.mockReset().mockResolvedValue(null); calls.pending.mockReset().mockReturnValue(null);
  calls.resume.mockReset(); calls.reserve.mockReset().mockResolvedValue(calls.resume);
});
afterEach(async () => { await act(async () => renderers.splice(0).forEach((renderer) => renderer.unmount())); });
async function mount() {
  let renderer!: ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(LanguageRestartPrompt)); renderers.push(renderer); });
  return { renderer,
    dialog: (title = 'languageRestart.title') => renderer.root.findAllByType(host('ConfirmDialog')).find((node) => node.props.title === title)!,
    confirm: async (title = 'languageRestart.title') => { await act(async () => { renderer.root.findAllByType(host('ConfirmDialog')).find((node) => node.props.title === title)!.props.onConfirm(); await flush(); }); },
  };
}

describe('actual global restart prompt lifecycle', () => {
  it('Later/dialog Back dismisses only the prompt and preserves required state for Settings', async () => {
    const ui = await mount();
    await act(async () => ui.dialog().props.onDismiss());
    expect(useLanguageRestartStore.getState()).toMatchObject({ required: true, promptOpen: false });
    expect(calls.restart).not.toHaveBeenCalled();
    await act(async () => useLanguageRestartStore.getState().requestPrompt());
    expect(ui.dialog().props.visible).toBe(true);
  });

  it.each(['analyzing', 'saving'] as const)('cannot restart a busy %s operation', async (stage) => {
    usePipelineStore.getState().setStage(stage);
    const ui = await mount();
    expect(ui.dialog().props.visible).toBe(false);
    await ui.confirm();
    expect(calls.persist).not.toHaveBeenCalled(); expect(calls.restart).not.toHaveBeenCalled();
    expect(usePipelineStore.getState().stage).toBe(stage);
  });

  it('requires explicit discard confirmation and retains imported state when it is cancelled', async () => {
    usePipelineStore.setState({ stage: 'selectFiles', workingDirectory: 'file:///cache/chatstamp/synthetic/' });
    const ui = await mount(); await ui.confirm();
    const discard = ui.dialog('languageRestart.discardTitle');
    expect(discard.props.visible).toBe(true);
    expect(calls.discard).not.toHaveBeenCalled();
    await act(async () => discard.props.onDismiss());
    expect(usePipelineStore.getState().workingDirectory).toContain('/synthetic/');
    expect(calls.restart).not.toHaveBeenCalled();
    expect(useLanguageRestartStore.getState().required).toBe(true);
  });

  it('awaits settings commit, safe discard and native media release in order before one reload', async () => {
    usePipelineStore.setState({ stage: 'selectFiles', workingDirectory: 'file:///cache/chatstamp/synthetic/' });
    const persisted = deferred(), discarded = deferred(), released = deferred();
    calls.persist.mockReturnValueOnce(persisted.promise); calls.discard.mockReturnValueOnce(discarded.promise); calls.release.mockReturnValueOnce(released.promise);
    const ui = await mount(); await ui.confirm(); await ui.confirm('languageRestart.discardTitle');
    expect(calls.persist).toHaveBeenCalledOnce(); expect(calls.discard).not.toHaveBeenCalled();
    await act(async () => { persisted.resolve(); await flush(); });
    expect(calls.discard).toHaveBeenCalledOnce(); expect(calls.release).not.toHaveBeenCalled();
    await act(async () => { discarded.resolve(); await flush(); });
    expect(calls.release).toHaveBeenCalledOnce(); expect(calls.restart).not.toHaveBeenCalled();
    await act(async () => { released.resolve(); await flush(); });
    expect(calls.restart).toHaveBeenCalledOnce();
    expect(calls.resume).not.toHaveBeenCalled();
    expect(useLanguageRestartStore.getState().required).toBe(true);
  });

  it.each(['persist', 'discard', 'release', 'restart'] as const)('keeps a retryable required state when %s fails', async (boundary) => {
    calls[boundary].mockRejectedValueOnce(new Error('IO_ERROR'));
    const ui = await mount(); await ui.confirm();
    expect(ui.renderer.root.findByType(host('Snackbar')).props.visible).toBe(true);
    expect(useLanguageRestartStore.getState().required).toBe(true);
    if (boundary !== 'restart') expect(calls.restart).not.toHaveBeenCalled();
    expect(calls.resume).toHaveBeenCalledOnce();
    await act(async () => { ui.renderer.root.findByType(host('Snackbar')).props.action.onPress(); await flush(); });
    expect(calls.restart).toHaveBeenCalledTimes(boundary === 'restart' ? 2 : 1);
  });

  it('rechecks running native snapshots and queued shares after persistence before discarding anything', async () => {
    calls.snapshot.mockResolvedValueOnce({ operationId: 'saving', progress: { phase: 'copying' } });
    const ui = await mount(); await ui.confirm();
    expect(calls.discard).not.toHaveBeenCalled(); expect(calls.restart).not.toHaveBeenCalled();
    calls.pending.mockReturnValue({ sourceUri: 'content://synthetic/new.zip' });
    await ui.confirm();
    expect(calls.discard).not.toHaveBeenCalled(); expect(calls.restart).not.toHaveBeenCalled();
  });

  it('clears pending restart when desired language matches the actual running direction again', () => {
    useLanguageRestartStore.getState().setRequired(false);
    expect(useLanguageRestartStore.getState()).toMatchObject({ required: false, promptOpen: false });
    useLanguageRestartStore.getState().requestPrompt();
    expect(useLanguageRestartStore.getState().promptOpen).toBe(false);
  });

  it.each([
    { working: false, boundary: 'persist' as const },
    { working: true, boundary: 'snapshot' as const },
  ])('does not allow Later/Cancel to release intake during committed $boundary work', async ({ working, boundary }) => {
    if (working) usePipelineStore.setState({ stage: 'selectFiles', workingDirectory: 'file:///cache/chatstamp/synthetic/' });
    const gate = deferred();
    if (boundary === 'persist') calls.persist.mockReturnValueOnce(gate.promise);
    else calls.snapshot.mockReturnValueOnce(gate.promise.then(() => null));
    const ui = await mount(); await ui.confirm();
    if (working) await ui.confirm('languageRestart.discardTitle');
    const active = ui.dialog(working ? 'languageRestart.discardTitle' : 'languageRestart.title');
    expect(active.props.busy).toBe(true); expect(active.props.visible).toBe(true);
    await act(async () => { active.props.onDismiss(); ui.dialog().props.onDismiss(); active.props.onConfirm(); await flush(); });
    expect(active.props.visible).toBe(true); expect(calls.resume).not.toHaveBeenCalled(); expect(calls.restart).not.toHaveBeenCalled();
    expect(calls.reserve).toHaveBeenCalledOnce();
    await act(async () => { gate.resolve(); await flush(); });
    expect(calls.restart).toHaveBeenCalledOnce(); expect(calls.resume).not.toHaveBeenCalled();
  });
});
