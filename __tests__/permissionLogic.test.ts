import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import config from '../app.config';

describe('scoped storage permissions', () => {
  it('blocks broad permissions, including permissions supplied by dependencies', () => {
    const permissions = [
      'MANAGE_EXTERNAL_STORAGE', 'READ_EXTERNAL_STORAGE', 'WRITE_EXTERNAL_STORAGE',
      'READ_MEDIA_IMAGES', 'READ_MEDIA_VIDEO', 'READ_MEDIA_AUDIO', 'READ_MEDIA_VISUAL_USER_SELECTED'
    ];
    for (const permission of permissions) {
      expect(config.android).not.toHaveProperty('permissions', expect.arrayContaining([permission]));
      expect(config.android?.blockedPermissions).toContain('android.permission.' + permission);
    }
  });

  it('exposes only the import cache through the app provider', () => {
    const provider = readFileSync('modules/chatstamp-native/android/src/main/res/xml/chatstamp_file_provider_paths.xml', 'utf8');
    expect(provider).toContain('<cache-path name="imports" path="chatstamp/"');
    expect(provider).not.toMatch(/<external-path|<root-path|<files-path|path="\."/);
  });
});
