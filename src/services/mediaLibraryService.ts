import * as MediaLibrary from 'expo-media-library';
import { Platform } from 'react-native';
import { logger } from '../lib/logger';

export type GalleryPermissionStatus = {
  granted: boolean;
  status: MediaLibrary.PermissionStatus;
  canAskAgain: boolean;
  accessPrivileges?: MediaLibrary.PermissionResponse['accessPrivileges'];
  platform: typeof Platform.OS;
  androidVersion?: number;
};

export const galleryPermissionErrorMessage =
  'Gallery permission is missing. The app needs permission to save selected photos and videos to Android Gallery with corrected dates.';

export async function getMediaPermissionStatus(): Promise<GalleryPermissionStatus> {
  const permission = await MediaLibrary.getPermissionsAsync(true);
  const status = normalizePermission(permission);
  logger.debug('Permissions current status', status);
  return status;
}

export async function requestMediaPermissions(): Promise<boolean> {
  const status = await requestMediaPermissionsStatus();
  return status.granted;
}

export async function requestMediaPermissionsStatus(): Promise<GalleryPermissionStatus> {
  logger.debug('Permissions request start', {
    platform: Platform.OS,
    androidVersion: Platform.OS === 'android' ? Platform.Version : undefined,
    requestedBy: 'expo-media-library'
  });
  const permission = await MediaLibrary.requestPermissionsAsync(true);
  const status = normalizePermission(permission);
  logger.debug('Permissions request result', status);
  return status;
}

function normalizePermission(permission: MediaLibrary.PermissionResponse): GalleryPermissionStatus {
  return {
    granted: permission.granted,
    status: permission.status,
    canAskAgain: permission.canAskAgain,
    accessPrivileges: permission.accessPrivileges,
    platform: Platform.OS,
    androidVersion: Platform.OS === 'android' ? Number(Platform.Version) : undefined
  };
}
