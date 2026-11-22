export const spacing = {
  screenHorizontal: 16,
  section: 28,
  card: 16,
  innerCard: 20,
  compactInner: 16,
  gap: 12,
  smallGap: 8,
  tinyGap: 4,
  segmentGap: 2
} as const;

/**
 * Grouped lists use large outer corners and small inner corners, so adjacent
 * rows read as one segmented surface. Buttons are full pills.
 */
export const radius = {
  card: 24,
  largeCard: 28,
  segment: 6,
  button: 999,
  smallButton: 999,
  chip: 8,
  thumbnail: 12,
  dialog: 28,
  bubble: 18
} as const;

export const size = {
  buttonHeight: 56,
  smallButtonHeight: 44,
  chipHeight: 28,
  iconContainer: 40,
  listItemMinHeight: 64,
  touchTarget: 48,
  topBarHeight: 56
} as const;

export const appTypography = {
  largeTitle: {
    fontSize: 34,
    lineHeight: 42,
    fontWeight: '400' as const
  },
  sectionTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600' as const
  },
  caption: {
    fontSize: 12,
    lineHeight: 16
  },
  button: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600' as const
  }
} as const;

export const appColorTokens = {
  light: {
    background: '#fbf6ef',
    surface: '#fffaf4',
    elevatedSurface: '#fff4e8',
    primary: '#8b5433',
    onPrimary: '#ffffff',
    primaryContainer: '#f7dcc7',
    onPrimaryContainer: '#321506',
    secondary: '#a46346',
    secondaryContainer: '#f5dfd1',
    success: '#3f7c57',
    successContainer: '#dcefdc',
    warning: '#9a6500',
    warningContainer: '#ffedc0',
    error: '#ba1a1a',
    errorContainer: '#ffdad6',
    textPrimary: '#241a14',
    textSecondary: '#66564c',
    textMuted: '#8a766a',
    border: '#e7d7ca',
    disabled: '#ded4cc'
  },
  dark: {
    background: '#16110e',
    surface: '#211915',
    elevatedSurface: '#2d211b',
    primary: '#f0b990',
    onPrimary: '#4d250e',
    primaryContainer: '#6d3b22',
    onPrimaryContainer: '#ffdcc6',
    secondary: '#e7bdac',
    secondaryContainer: '#5a4035',
    success: '#a9d7b4',
    successContainer: '#254b33',
    warning: '#f5c56e',
    warningContainer: '#523a06',
    error: '#ffb4ab',
    errorContainer: '#93000a',
    textPrimary: '#f5ede8',
    textSecondary: '#d8c6bb',
    textMuted: '#bda99c',
    border: '#4a3a32',
    disabled: '#4d443e'
  }
} as const;
