import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppSettings } from '../src/types/media';
import { defaultSettings, mergeSettings } from '../src/store/settingsLogic';

const io = vi.hoisted(() => ({ read: vi.fn(), write: vi.fn() }));
vi.mock('../src/store/jsonFileStorage', () => ({ atomicStore: { read: io.read }, writeJsonFile: io.write }));
vi.mock('../src/lib/logger', () => ({ logger: { warn: vi.fn() } }));

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((accept, fail) => { resolve = accept; reject = fail; });
  return { promise, resolve, reject };
}
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

describe('message-date default migration', () => {
  it.each([
    ['no file', undefined, true], ['null file', null, true], ['legacy missing field', {}, true],
    ['older explicit false', { alwaysUseMessageDate: false }, false], ['explicit true', { alwaysUseMessageDate: true }, true],
    ['invalid string', { alwaysUseMessageDate: 'false' }, true], ['invalid number', { alwaysUseMessageDate: 0 }, true],
    ['invalid null', { alwaysUseMessageDate: null }, true],
  ])('%s retains the intended message-date policy', (_name, value, expected) => {
    expect(mergeSettings(value as Partial<AppSettings> | null | undefined).alwaysUseMessageDate).toBe(expected);
  });
  it('makes the actual new-install default ON', () => { expect(defaultSettings.alwaysUseMessageDate).toBe(true); });
});

describe('actual settings repository commit and failure ordering', () => {
  let useSettingsStore: typeof import('../src/store/settingsStore').useSettingsStore;
  let disk: Partial<AppSettings> | null;
  beforeEach(async () => {
    vi.resetModules();
    disk = { alwaysUseMessageDate: false, languagePreference: 'en', appearance: 'system' };
    io.read.mockReset().mockImplementation(async () => disk === null ? null : JSON.stringify(disk));
    io.write.mockReset().mockImplementation(async (_file: string, value: AppSettings) => { disk = structuredClone(value); });
    useSettingsStore = (await import('../src/store/settingsStore')).useSettingsStore;
  });

  it('rejects writes before a successful load instead of overwriting unknown existing choices', async () => {
    await expect(useSettingsStore.getState().updateSettings({ languagePreference: 'he' })).rejects.toThrow();
    expect(io.write).not.toHaveBeenCalled();
    expect(disk?.languagePreference).toBe('en');
  });

  it('loads a genuinely absent settings file with the new ON default without writing it implicitly', async () => {
    disk = null;
    await useSettingsStore.getState().loadSettings();
    expect(useSettingsStore.getState()).toMatchObject({ loaded: true, loadError: null, settings: { alwaysUseMessageDate: true } });
    expect(io.write).not.toHaveBeenCalled();
  });

  it.each(['{broken', 'null', '[]', '42'])('treats corrupt/non-object persisted bytes as a load error: %s', async (raw) => {
    io.read.mockResolvedValueOnce(raw);
    await expect(useSettingsStore.getState().loadSettings()).rejects.toThrow();
    expect(useSettingsStore.getState().loaded).toBe(false);
    await expect(useSettingsStore.getState().updateSettings({ languagePreference: 'he' })).rejects.toThrow();
    expect(io.write).not.toHaveBeenCalled();
  });

  it('keeps explicit false through unrelated patches, appearance, save-location reset and reload', async () => {
    await useSettingsStore.getState().loadSettings();
    await useSettingsStore.getState().updateSettings({ languagePreference: 'he', onboardingCompleted: true });
    await useSettingsStore.getState().setAppearance('dark');
    await useSettingsStore.getState().resetSaveLocation();
    await useSettingsStore.getState().loadSettings();
    expect(useSettingsStore.getState().settings).toMatchObject({ alwaysUseMessageDate: false, languagePreference: 'he', appearance: 'dark', onboardingCompleted: true });
    expect(disk).toMatchObject({ alwaysUseMessageDate: false, languagePreference: 'he' });
  });

  it.each([false, true])('round-trips an explicit %s through persistence', async (choice) => {
    await useSettingsStore.getState().loadSettings();
    await useSettingsStore.getState().updateSettings({ alwaysUseMessageDate: choice });
    await useSettingsStore.getState().loadSettings();
    expect(useSettingsStore.getState().settings.alwaysUseMessageDate).toBe(choice);
    expect(disk?.alwaysUseMessageDate).toBe(choice);
  });

  it('does not publish an optimistic language preference before its atomic write commits', async () => {
    await useSettingsStore.getState().loadSettings();
    const writing = deferred(); io.write.mockReturnValueOnce(writing.promise);
    const update = useSettingsStore.getState().updateSettings({ languagePreference: 'he' });
    await flush();
    expect(io.write).toHaveBeenCalledOnce();
    expect(useSettingsStore.getState().settings.languagePreference).toBe('en');
    writing.resolve(); await update;
    expect(useSettingsStore.getState().settings.languagePreference).toBe('he');
  });

  it('serializes concurrent patches against the last committed state without losing either change', async () => {
    await useSettingsStore.getState().loadSettings();
    const first = deferred(); io.write.mockImplementationOnce(async (_file: string, value: AppSettings) => { await first.promise; disk = structuredClone(value); });
    const language = useSettingsStore.getState().updateSettings({ languagePreference: 'he' });
    const appearance = useSettingsStore.getState().setAppearance('dark');
    await flush(); expect(io.write).toHaveBeenCalledOnce();
    first.resolve(); await Promise.all([language, appearance]);
    expect(io.write).toHaveBeenCalledTimes(2);
    expect(disk).toMatchObject({ languagePreference: 'he', appearance: 'dark', alwaysUseMessageDate: false });
    expect(useSettingsStore.getState().settings).toMatchObject(disk!);
  });

  it('keeps committed state after a failed write and permits the next queued patch', async () => {
    await useSettingsStore.getState().loadSettings();
    io.write.mockRejectedValueOnce(new Error('NO_SPACE'));
    const failure = useSettingsStore.getState().updateSettings({ languagePreference: 'he' });
    const recovery = useSettingsStore.getState().setAppearance('dark');
    await expect(failure).rejects.toThrow('NO_SPACE'); await recovery;
    expect(useSettingsStore.getState().settings).toMatchObject({ languagePreference: 'en', appearance: 'dark', alwaysUseMessageDate: false });
    expect(disk).toMatchObject({ languagePreference: 'en', appearance: 'dark' });
  });

  it('merges queued nested organization patches without restoring any stale sibling values', async () => {
    await useSettingsStore.getState().loadSettings();
    const writing = deferred();
    io.write.mockImplementationOnce(async (_file: string, value: AppSettings) => { await writing.promise; disk = structuredClone(value); });
    const first = useSettingsStore.getState().updateSettings({ outputOrganization: { duplicateHandling: 'keep-both' } });
    const second = useSettingsStore.getState().updateSettings({ outputOrganization: { createExportTimestampFolder: true } });
    const third = useSettingsStore.getState().updateSettings({ outputOrganization: { mode: 'by-sender' } });
    await flush(); expect(io.write).toHaveBeenCalledOnce();
    writing.resolve(); await Promise.all([first, second, third]);
    expect(disk?.outputOrganization).toEqual({ mode: 'by-sender', duplicateHandling: 'keep-both', createExportTimestampFolder: true });
    await useSettingsStore.getState().loadSettings();
    expect(useSettingsStore.getState().settings.outputOrganization).toEqual(disk?.outputOrganization);
  });

  it('retains previous settings on read error, blocks overwrite, and recovers only after successful reload', async () => {
    await useSettingsStore.getState().loadSettings();
    const readError = new Error('IO_ERROR'); io.read.mockRejectedValueOnce(readError);
    await expect(useSettingsStore.getState().loadSettings()).rejects.toBe(readError);
    expect(useSettingsStore.getState()).toMatchObject({ loaded: false, loadError: readError, settings: { languagePreference: 'en', alwaysUseMessageDate: false } });
    await expect(useSettingsStore.getState().updateSettings({ languagePreference: 'he' })).rejects.toThrow();
    expect(io.write).not.toHaveBeenCalled();
    await useSettingsStore.getState().loadSettings();
    expect(useSettingsStore.getState()).toMatchObject({ loaded: true, loadError: null });
    await useSettingsStore.getState().updateSettings({ languagePreference: 'he' });
    expect(disk).toMatchObject({ languagePreference: 'he', alwaysUseMessageDate: false });
  });

  it('exposes pending/failed persistence to restart callers and recovers after a later committed write', async () => {
    const { awaitSettingsPersistence } = await import('../src/store/settingsStore');
    await useSettingsStore.getState().loadSettings();
    const writing = deferred(); io.write.mockReturnValueOnce(writing.promise);
    const update = useSettingsStore.getState().updateSettings({ languagePreference: 'he' });
    const barrier = awaitSettingsPersistence();
    let settled = false; void barrier.then(() => { settled = true; }, () => { settled = true; });
    await flush(); expect(settled).toBe(false);
    writing.reject(new Error('NO_SPACE'));
    await expect(update).rejects.toThrow('NO_SPACE');
    await expect(barrier).rejects.toThrow('NO_SPACE');
    await useSettingsStore.getState().setAppearance('dark');
    await expect(awaitSettingsPersistence()).resolves.toBeUndefined();
    expect(useSettingsStore.getState().settings.languagePreference).toBe('en');
  });
});
