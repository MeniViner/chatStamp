export function getBottomSheetBottomPadding(insetBottom: number, minimumPadding: number): number {
  return Math.max(insetBottom, minimumPadding);
}
