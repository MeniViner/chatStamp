import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppLanguagePreference } from '../src/types/media';

const native = vi.hoisted(() => ({ rtl: false, tag: 'en-US', allowRTL: vi.fn(), forceRTL: vi.fn(), reload: vi.fn() }));
vi.mock('react-native', () => ({ I18nManager: { get isRTL() { return native.rtl; }, allowRTL: native.allowRTL, forceRTL: native.forceRTL } }));
vi.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: native.tag }] }));
vi.mock('react-i18next', () => ({ initReactI18next: { type: '3rdParty', init: () => undefined } }));
vi.mock('expo', () => ({ reloadAppAsync: native.reload }));

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((accept) => { resolve = accept; });
  return { promise, resolve };
}
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks();
  native.rtl = false; native.tag = 'en-US'; native.reload.mockReset().mockResolvedValue(undefined);
});

describe('native-only language direction synchronization', () => {
  it.each(['en-US', 'he-IL'])('does not overwrite persisted native direction at module import for system %s', async (tag) => {
    native.tag = tag;
    await import('../src/i18n');
    expect(native.allowRTL).not.toHaveBeenCalled();
    expect(native.forceRTL).not.toHaveBeenCalled();
    expect(native.reload).not.toHaveBeenCalled();
  });

  it.each([['en-US', 'en'], ['en-GB', 'en'], ['he-IL', 'he'], ['he', 'he'], ['iw-IL', 'he'], ['HE-il', 'he'], ['fr-FR', 'en']])('resolves system %s to supported %s', async (tag, expected) => {
    native.tag = tag;
    const { resolveAppLanguage } = await import('../src/i18n');
    expect(resolveAppLanguage('system')).toBe(expected);
  });

  it.each([['en', true, true, false], ['he', false, true, true], ['en', false, false, false], ['he', true, false, true]] as const)(
    'explicit %s against runningRTL=%s returns mismatch=%s without mutating the snapshot', async (preference, currentRTL, mismatch, desiredRTL) => {
      native.rtl = currentRTL;
      const { syncI18nLanguage, default: i18n } = await import('../src/i18n');
      await expect(syncI18nLanguage(preference)).resolves.toBe(mismatch);
      expect(native.allowRTL).toHaveBeenLastCalledWith(desiredRTL);
      expect(native.forceRTL).toHaveBeenLastCalledWith(desiredRTL);
      expect(native.rtl).toBe(currentRTL);
      expect(i18n.resolvedLanguage ?? i18n.language).toBe(preference);
      expect(native.reload).not.toHaveBeenCalled();
    });

  it('keeps reporting restart-needed on repeated requests until the native runtime actually restarts', async () => {
    const { syncI18nLanguage } = await import('../src/i18n');
    await expect(syncI18nLanguage('he')).resolves.toBe(true);
    await expect(syncI18nLanguage('he')).resolves.toBe(true);
    await expect(syncI18nLanguage('en')).resolves.toBe(false);
    expect(native.rtl).toBe(false);
  });

  it('serializes immediate translation changes so an older delayed request cannot win last', async () => {
    const module = await import('../src/i18n');
    const original = module.default.changeLanguage.bind(module.default);
    const first = deferred();
    const change = vi.spyOn(module.default, 'changeLanguage').mockImplementationOnce(async (language) => { await first.promise; return original(language); });
    const hebrew = module.syncI18nLanguage('he');
    const english = module.syncI18nLanguage('en');
    await flush(); expect(change).toHaveBeenCalledTimes(1);
    first.resolve(); await Promise.all([hebrew, english]);
    expect(change.mock.calls.map(([language]) => language)).toEqual(['he', 'en']);
    expect(module.default.resolvedLanguage ?? module.default.language).toBe('en');
    expect(native.forceRTL).toHaveBeenLastCalledWith(false);
  });

  it('uses the current supported system language when the explicit preference is system', async () => {
    const { syncI18nLanguage, default: i18n } = await import('../src/i18n');
    native.tag = 'he-IL';
    await expect(syncI18nLanguage('system' satisfies AppLanguagePreference)).resolves.toBe(true);
    expect(i18n.resolvedLanguage ?? i18n.language).toBe('he');
  });
});

describe('same-bundle native restart adapter', () => {
  it('calls the shipped Expo reload API and awaits its completion', async () => {
    const gate = deferred(); native.reload.mockReturnValueOnce(gate.promise);
    const { restartAppForLanguage } = await import('../src/native/appReload');
    let finished = false;
    const pending = restartAppForLanguage().then(() => { finished = true; });
    await flush(); expect(native.reload).toHaveBeenCalledOnce(); expect(finished).toBe(false);
    gate.resolve(); await pending; expect(finished).toBe(true);
  });
  it('preserves restart rejection for the UI instead of pretending a layout reload occurred', async () => {
    const error = new Error('no activity'); native.reload.mockRejectedValueOnce(error);
    const { restartAppForLanguage } = await import('../src/native/appReload');
    await expect(restartAppForLanguage()).rejects.toBe(error);
  });
});
