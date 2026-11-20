import { reloadAppAsync } from 'expo';

/** The caller commits settings and releases active work/media before requesting this reload. */
export async function restartAppForLanguage(): Promise<void> {
  await reloadAppAsync('Apply app language');
}
