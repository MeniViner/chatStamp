export type MediaSourceUriPlan =
  | { kind: 'local-file'; path: string }
  | { kind: 'content-copy-required'; uri: string };

export function planMediaSourceUri(uriOrPath: string): MediaSourceUriPlan {
  if (uriOrPath.startsWith('content://')) {
    return { kind: 'content-copy-required', uri: uriOrPath };
  }

  if (uriOrPath.startsWith('file://')) {
    return { kind: 'local-file', path: decodeURIComponent(uriOrPath.slice('file://'.length)) };
  }

  return { kind: 'local-file', path: uriOrPath };
}

export function shouldFailMp4SaveBeforeInsert(result: {
  metadataRewriteAttempted?: boolean;
  metadataRewriteSucceeded?: boolean;
  mp4RewriteFailureCode?: string | null;
}): boolean {
  return Boolean(result.metadataRewriteAttempted && !result.metadataRewriteSucceeded && result.mp4RewriteFailureCode === 'mp4BoxRewriteFailed');
}

export function isDateCorrectionSuccess(result: {
  boxesVerified?: boolean;
  dateCorrectionVerified?: boolean;
  insertedUri?: string | null;
}): boolean {
  return Boolean(result.boxesVerified && result.dateCorrectionVerified && result.insertedUri);
}
