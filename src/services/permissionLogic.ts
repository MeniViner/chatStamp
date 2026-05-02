import type { GalleryPermissionStatus } from './mediaLibraryService';

export type PermissionAction = 'granted' | 'request' | 'open-settings';

export function getPermissionAction(status: GalleryPermissionStatus): PermissionAction {
  if (status.granted) return 'granted';
  return status.canAskAgain ? 'request' : 'open-settings';
}
