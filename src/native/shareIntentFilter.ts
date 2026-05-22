export function shouldIgnoreShareIntentUri(uri: string): boolean {
  const value = uri.toLowerCase();
  return (
    value.startsWith('chatstamp://expo-development-client') ||
    value.startsWith('exp://') ||
    value.includes('expo-development-client') ||
    value.includes('localhost:8081') ||
    value.includes('127.0.0.1:8081') ||
    /^https?:\/\/192\.168\.[^/]+:8081/.test(value)
  );
}

export function isShareImportUri(uri: string): boolean {
  if (shouldIgnoreShareIntentUri(uri)) return false;
  if (!uri.startsWith('content://') && !uri.startsWith('file://')) return false;
  return hasZipExtension(uri);
}

function hasZipExtension(uri: string): boolean {
  const withoutQuery = uri.split(/[?#]/)[0] ?? uri;
  try {
    return decodeURIComponent(withoutQuery).toLowerCase().endsWith('.zip');
  } catch {
    return withoutQuery.toLowerCase().endsWith('.zip');
  }
}
