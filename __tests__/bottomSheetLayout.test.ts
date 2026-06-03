import { describe, expect, it } from 'vitest';
import { getBottomSheetBottomPadding } from '../src/components/bottomSheetLayout';

describe('bottomSheetLayout', () => {
  it('keeps safe-area padding inside the sheet with a minimum touchable inset', () => {
    expect(getBottomSheetBottomPadding(0, 12)).toBe(12);
    expect(getBottomSheetBottomPadding(28, 12)).toBe(28);
  });
});
