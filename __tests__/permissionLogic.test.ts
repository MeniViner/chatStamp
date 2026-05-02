import { describe, expect, it } from 'vitest';
import { getPermissionAction } from '../src/services/permissionLogic';
import type { GalleryPermissionStatus } from '../src/services/mediaLibraryService';

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
});
