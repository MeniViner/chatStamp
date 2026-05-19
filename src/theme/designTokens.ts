export const spacing = {
  screenHorizontal: 16,
  listHorizontal: 12,
  section: 16,
  card: 10,
  innerCard: 16,
  compactInner: 12,
  gap: 8,
  smallGap: 6,
  tinyGap: 4
} as const;

export const radius = {
  card: 16,
  largeCard: 20,
  button: 20,
  smallButton: 16,
  chip: 18,
  thumbnail: 8
} as const;

export const size = {
  buttonHeight: 48,
  smallButtonHeight: 40,
  chipHeight: 32,
  stickyFooterMinHeight: 72,
  iconContainer: 48,
  listItemMinHeight: 64,
  touchTarget: 48
} as const;

export const appTypography = {
  screenTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700' as const
  },
  sectionTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700' as const
  },
  cardTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700' as const
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
