import { describe, expect, it } from 'vitest';
import { canContinueWithSaveMethod, getPermissionAction, isAllFilesAccessRequired } from '../src/services/permissionLogic';
import type { GalleryPermissionStatus } from '../src/services/permissionLogic';

function status(overrides: Partial<GalleryPermissionStatus>): GalleryPermissionStatus {
  return {
    granted: false,
    status: 'denied' as GalleryPermissionStatus['status'],
    canAskAgain: true,
    platform: 'android',
    androidVersion: 35,
    ...overrides
  };
}

describe('getPermissionAction', () => {
  it('returns granted when permission is granted', () => {
    expect(getPermissionAction(status({ granted: true, status: 'granted' as GalleryPermissionStatus['status'], canAskAgain: false }))).toBe('granted');
  });

  it('returns request when denied but Android can ask again', () => {
    expect(getPermissionAction(status({ granted: false, canAskAgain: true }))).toBe('request');
  });

  it('returns open-settings when denied permanently', () => {
    expect(getPermissionAction(status({ granted: false, canAskAgain: false }))).toBe('open-settings');
  });

  it('requires All Files Access for Termux Parity Mode', () => {
    expect(isAllFilesAccessRequired('termux-parity')).toBe(true);
    expect(canContinueWithSaveMethod('termux-parity', false)).toBe(false);
    expect(canContinueWithSaveMethod('termux-parity', true)).toBe(true);
  });

  it('does not require All Files Access for the explicit MediaStore fallback', () => {
    expect(isAllFilesAccessRequired('mediastore-fallback')).toBe(false);
    expect(canContinueWithSaveMethod('mediastore-fallback', false)).toBe(true);
  });
});
