import { Linking, Platform } from 'react-native';
import * as Application from 'expo-application';
import * as IntentLauncher from 'expo-intent-launcher';
import { logger } from '../lib/logger';

export type OpenAppLanguageSettingsResult = 'opened' | 'opened-system-settings' | 'unsupported';

export async function openAppLanguageSettings(): Promise<OpenAppLanguageSettingsResult> {
  if (Platform.OS !== 'android') {
    return 'unsupported';
  }

  const packageName = Application.applicationId ?? 'com.local.whatsappmediatimefixer';
  try {
    await IntentLauncher.startActivityAsync('android.settings.APP_LOCALE_SETTINGS', {
      data: `package:${packageName}`
    });
    return 'opened';
  } catch (error) {
    logger.warn('openAppLanguageSettingsFailed', error);
    await Linking.openSettings();
    return 'opened-system-settings';
  }
}
