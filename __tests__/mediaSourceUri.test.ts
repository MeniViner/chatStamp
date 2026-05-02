import { describe, expect, it } from 'vitest';
import { isDateCorrectionSuccess, planMediaSourceUri, shouldFailMp4SaveBeforeInsert } from '../src/native/mediaSourceUri';

describe('media source URI planning', () => {
  it('converts file URI to a decoded local path', () => {
    expect(planMediaSourceUri('file:///data/user/0/app/cache/%D7%95%D7%99%D7%93%D7%90%D7%95%201.mp4')).toEqual({
      kind: 'local-file',
      path: '/data/user/0/app/cache/וידאו 1.mp4'
    });
  });

  it('requires cache copy for content URIs', () => {
    expect(planMediaSourceUri('content://media/external/video/media/42')).toEqual({
      kind: 'content-copy-required',
      uri: 'content://media/external/video/media/42'
    });
  });
});

describe('MP4 save result guards', () => {
  it('fails before insert if boxes did not change', () => {
    expect(shouldFailMp4SaveBeforeInsert({
      metadataRewriteAttempted: true,
      metadataRewriteSucceeded: false,
      mp4RewriteFailureCode: 'mp4BoxRewriteFailed'
    })).toBe(true);
  });

  it('does not count success when rewritten file is not inserted', () => {
    expect(isDateCorrectionSuccess({
      boxesVerified: true,
      dateCorrectionVerified: true,
      insertedUri: null
    })).toBe(false);
  });

  it('counts success only when boxes and Android verification pass with an inserted URI', () => {
    expect(isDateCorrectionSuccess({
      boxesVerified: true,
      dateCorrectionVerified: true,
      insertedUri: 'content://media/external/video/media/42'
    })).toBe(true);
  });
});
