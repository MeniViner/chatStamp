export const spacing = {
  screenHorizontal: 24,
  listHorizontal: 20,
  section: 32,
  card: 18,
  innerCard: 22,
  compactInner: 16,
  gap: 12,
  smallGap: 8,
  tinyGap: 4
} as const;

export const radius = {
  card: 24,
  largeCard: 32,
  button: 28,
  smallButton: 24,
  chip: 18,
  thumbnail: 14
} as const;

export const size = {
  buttonHeight: 54,
  smallButtonHeight: 46,
  chipHeight: 36,
  stickyFooterMinHeight: 92,
  iconContainer: 48,
  listItemMinHeight: 82,
  touchTarget: 48
} as const;

export const appTypography = {
  screenTitle: {
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '800' as const
  },
  sectionTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800' as const
  },
  cardTitle: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '800' as const
  },
  body: {
    fontSize: 16,
    lineHeight: 24
  },
  secondaryBody: {
    fontSize: 15,
    lineHeight: 21
  },
  caption: {
    fontSize: 13,
    lineHeight: 20
  },
  button: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700' as const
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
