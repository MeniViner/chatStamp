import type { PickedFolderResult } from '../types/media';

export type NativeOpenFolderTarget = {
  treeUri?: string | null;
  documentUri?: string | null;
  documentId?: string | null;
  relativeFolderDocumentId?: string | null;
  path?: string | null;
  displayName?: string | null;
};

export function buildOpenFolderTarget({
  outputDirectory,
  outputPath,
  customFolder
}: {
  outputDirectory?: string | null;
  outputPath?: string | null;
  customFolder?: PickedFolderResult | null;
}): NativeOpenFolderTarget {
  const target = outputDirectory ?? outputPath ?? null;
  return {
    treeUri: customFolder?.treeUri ?? null,
    documentUri: target?.startsWith('content://') ? target : null,
    documentId: undefined,
    relativeFolderDocumentId: undefined,
    path: target && !target.startsWith('content://') ? target : outputPath ?? null,
    displayName: customFolder?.displayName ?? customFolder?.readablePathLabel ?? null
  };
}

export function joinSafDocumentId(rootDocumentId: string, relativeFolder?: string | null): string {
  const root = rootDocumentId.replace(/\/+$/g, '');
  const child = (relativeFolder ?? '')
    .split(/[\\/]+/g)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join('/');
  return child ? `${root}/${child}` : root;
}

export function publicAndroidPathToDocumentId(path?: string | null): string | undefined {
  if (!path) return undefined;
  const normalized = path.replace(/\\/g, '/').replace(/\/+$/g, '');
  const prefixes = ['/storage/emulated/0/', '/sdcard/'];
  const prefix = prefixes.find((candidate) => normalized.startsWith(candidate));
  if (!prefix) return undefined;
  const relative = normalized.slice(prefix.length).replace(/^\/+|\/+$/g, '');
  return relative ? `primary:${relative}` : 'primary:';
}
