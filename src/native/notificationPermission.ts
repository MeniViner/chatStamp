import { Linking, PermissionsAndroid, Platform } from 'react-native';

export type NotificationPermissionState = 'granted' | 'denied' | 'blocked';

/** POST_NOTIFICATIONS is a runtime permission only from Android 13 (API 33). */
export function notificationPermissionApplies(): boolean {
  return Platform.OS === 'android' && Number(Platform.Version) >= 33;
}

export async function checkNotificationPermission(): Promise<boolean> {
  if (!notificationPermissionApplies()) return true;
  return PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
}

export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (!notificationPermissionApplies()) return 'granted';
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  if (result === PermissionsAndroid.RESULTS.GRANTED) return 'granted';
  return result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN ? 'blocked' : 'denied';
}

/** Android no longer shows the prompt after a permanent denial; the app settings page is the only path. */
export async function openNotificationSettings(): Promise<void> {
  await Linking.openSettings();
}
