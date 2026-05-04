export type GalleryPermissionStatus = {
  granted: boolean;
  status: string;
  canAskAgain: boolean;
  accessPrivileges?: string;
  platform: string;
  androidVersion?: number;
};

export type PermissionAction = 'granted' | 'request' | 'open-settings';
export type SaveMethod = 'termux-parity' | 'mediastore-fallback';

export function getPermissionAction(status: GalleryPermissionStatus): PermissionAction {
  if (status.granted) return 'granted';
  return status.canAskAgain ? 'request' : 'open-settings';
}

export function isAllFilesAccessRequired(saveMethod: SaveMethod): boolean {
  return saveMethod === 'termux-parity';
}

export function canContinueWithSaveMethod(saveMethod: SaveMethod, allFilesAccessGranted: boolean): boolean {
  if (!isAllFilesAccessRequired(saveMethod)) return true;
  return allFilesAccessGranted;
}
