import React from 'react';
import { I18nManager, Pressable, StatusBar, StyleSheet, View, type ImageStyle, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Appbar, Button, ProgressBar, RadioButton, Switch, Text } from 'react-native-paper';
import { Image as ExpoImage } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { spacing, radius, size, appTypography } from '../theme/designTokens';
import { useAppTheme, type AppTheme } from '../theme/useAppTheme';
import type { MediaType } from '../types/media';
import { getThumbnail, invalidateThumbnail, type ThumbnailResult } from '../native/mediaPreviews';
import appIconSource from '../../assets/app-logo.png';

export type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

export const textStyles = StyleSheet.create({
  start: {
    textAlign: 'auto',
    writingDirection: 'auto'
  }
});

const styles = createStyles();

/** Surface roles with fallbacks for palettes that predate the container roles. */
export function surfaceRoles(theme: AppTheme) {
  return {
    group: theme.colors.surfaceContainer ?? theme.colors.surfaceVariant,
    groupPressed: theme.colors.surfaceContainerHighest ?? theme.colors.surfaceVariant,
    raised: theme.colors.surfaceContainerHigh ?? theme.colors.surfaceVariant,
    low: theme.colors.surfaceContainerLow ?? theme.colors.surface
  };
}

const forwardChevron = (): IconName => I18nManager.isRTL ? 'chevron-left' : 'chevron-right';
export const forwardArrow = (): IconName => I18nManager.isRTL ? 'arrow-left' : 'arrow-right';

/** The launcher artwork in a round frame, as used in headers and the About row. */
export function AppLogo({ size: diameter = 40 }: { size?: number }) {
  const theme = useAppTheme();
  return (
    <View importantForAccessibility="no-hide-descendants"
      style={[styles.logo, { width: diameter, height: diameter, borderRadius: diameter / 2, borderColor: theme.colors.outlineVariant }]}>
      <ExpoImage source={appIconSource} contentFit="cover" style={styles.logoImage} />
    </View>
  );
}

export function AppScreenScaffold({
  title,
  subtitle,
  stepLabel,
  progress,
  showProgress,
  onBack,
  backDisabled,
  actions,
  children,
  footer,
  contentStyle,
  titleMode = 'large'
}: {
  title: string;
  subtitle?: string;
  stepLabel?: string;
  progress?: number;
  showProgress?: boolean;
  onBack?: () => void;
  backDisabled?: boolean;
  actions?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  /**
   * Large titles sit under the top bar; compact titles stay inside it for dense
   * screens; none leaves the heading to the screen content.
   */
  titleMode?: 'large' | 'compact' | 'none';
}) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const statusBarStyle = theme.dark ? 'light-content' : 'dark-content';
  const large = titleMode === 'large';

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.scaffoldSafeArea, { backgroundColor: theme.colors.background }]}>
      <StatusBar translucent backgroundColor="transparent" barStyle={statusBarStyle} />
      <Appbar.Header mode="small" elevated={false} statusBarHeight={0} style={[styles.scaffoldAppbar, { backgroundColor: theme.colors.background }]}>
        {onBack ? <Appbar.BackAction accessibilityLabel={t('common.back')} disabled={backDisabled} onPress={onBack} /> : null}
        <View style={styles.flex}>
          {titleMode === 'compact' ? (
            <Text variant="titleLarge" numberOfLines={1} ellipsizeMode="tail" accessibilityRole="header"
              style={[styles.compactTitle, textStyles.start]}>
              {title}
            </Text>
          ) : null}
        </View>
        {actions}
      </Appbar.Header>
      {large ? (
        <View style={styles.largeHeader}>
          {stepLabel ? <StepPill label={stepLabel} /> : null}
          <Text variant="headlineLarge" accessibilityRole="header" style={[styles.largeTitle, textStyles.start, { color: theme.colors.onBackground }]}>
            {title}
          </Text>
          {subtitle ? (
            <Text variant="bodyMedium" style={[textStyles.start, { color: theme.colors.onSurfaceVariant }]}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      ) : titleMode === 'compact' && (stepLabel || subtitle) ? (
        <View style={styles.compactHeaderMeta}>
          {stepLabel ? <StepPill label={stepLabel} /> : null}
          {subtitle ? (
            <Text variant="bodySmall" style={[styles.flex, textStyles.start, { color: theme.colors.onSurfaceVariant }]}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      ) : null}
      {showProgress && typeof progress === 'number' ? (
        <View style={styles.progressWrap}>
          <ProgressBar progress={progress} color={theme.colors.primary} style={[styles.progress, { backgroundColor: surfaceRoles(theme).raised }]} />
        </View>
      ) : null}
      <View style={[styles.scaffoldContent, contentStyle]}>{children}</View>
      {footer ? <BottomActionBar>{footer}</BottomActionBar> : null}
    </SafeAreaView>
  );
}

function StepPill({ label }: { label: string }) {
  const theme = useAppTheme();
  return (
    <View style={[styles.stepPill, { backgroundColor: theme.colors.secondaryContainer }]}>
      <Text variant="labelMedium" numberOfLines={1} style={[styles.tabular, { color: theme.colors.onSecondaryContainer }]}>
        {label}
      </Text>
    </View>
  );
}

function BottomActionBar({ children }: { children: React.ReactNode }) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bottomActionBar, { backgroundColor: theme.colors.background, paddingBottom: insets.bottom + spacing.compactInner }]}>
      {children}
    </View>
  );
}

function shortenMiddle(value: string, max = 76): string {
  if (value.length <= max) return value;
  const normalized = value.replace(/\\/g, '/');
  const keep = Math.max(12, Math.floor((max - 3) / 2));
  return `${normalized.slice(0, keep)}...${normalized.slice(-keep)}`;
}

export function FilePathText({
  value,
  maxLines = 2,
  ellipsizeMode = 'middle',
  style
}: {
  value: string;
  maxLines?: number;
  ellipsizeMode?: 'head' | 'middle' | 'tail' | 'clip';
  style?: StyleProp<TextStyle>;
}) {
  const theme = useAppTheme();
  const displayValue = ellipsizeMode === 'middle' ? shortenMiddle(value) : value;
  return (
    <Text
      variant="bodySmall"
      numberOfLines={maxLines}
      ellipsizeMode={ellipsizeMode}
      style={[styles.pathText, { color: theme.colors.onSurfaceVariant }, style]}
    >
      {displayValue}
    </Text>
  );
}

/** Small rounded tag, used for counts, statuses and badges. */
export function StatusBadge({ label, selected = false, danger = false }: { label: string; selected?: boolean; danger?: boolean }) {
  const theme = useAppTheme();
  const background = danger ? theme.colors.errorContainer : selected ? theme.colors.secondaryContainer : surfaceRoles(theme).groupPressed;
  const color = danger ? theme.colors.onErrorContainer : selected ? theme.colors.onSecondaryContainer : theme.colors.onSurfaceVariant;
  return (
    <View style={[styles.badge, { backgroundColor: background }]}>
      <Text variant="labelMedium" numberOfLines={1} style={[styles.badgeText, { color }]}>
        {label}
      </Text>
    </View>
  );
}

export function PrimaryButton({
  children,
  icon,
  disabled,
  iconAfterLabel = false,
  onPress,
  style
}: {
  children: React.ReactNode;
  icon?: string;
  disabled?: boolean;
  /** Places a directional icon after the label, as in "Next →". */
  iconAfterLabel?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Button
      mode="contained"
      icon={icon}
      disabled={disabled}
      onPress={onPress}
      style={[styles.fullButton, style]}
      contentStyle={[styles.primaryButtonContent, iconAfterLabel ? styles.iconAfterLabel : null]}
      labelStyle={styles.buttonLabel}
      maxFontSizeMultiplier={2}
    >
      {children}
    </Button>
  );
}

export function SecondaryButton({
  children,
  icon,
  disabled,
  onPress,
  danger,
  selected,
  style
}: {
  children: React.ReactNode;
  icon?: string;
  disabled?: boolean;
  danger?: boolean;
  selected?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useAppTheme();
  return (
    <Button
      mode={selected ? 'contained' : danger ? 'text' : 'contained-tonal'}
      icon={icon}
      disabled={disabled}
      textColor={danger ? theme.colors.error : undefined}
      onPress={onPress}
      style={[styles.secondaryButton, style]}
      contentStyle={styles.secondaryButtonContent}
      labelStyle={styles.secondaryButtonLabel}
      maxFontSizeMultiplier={2}
    >
      {children}
    </Button>
  );
}

/** Primary colored icon and label above a group of settings. */
export function SectionHeader({ icon, label, style }: { icon?: IconName; label: string; style?: StyleProp<ViewStyle> }) {
  const theme = useAppTheme();
  return (
    <View style={[styles.sectionHeader, style]} accessibilityRole="header">
      {icon ? <MaterialCommunityIcons name={icon} size={18} color={theme.colors.primary} importantForAccessibility="no" /> : null}
      <Text variant="labelLarge" style={[styles.sectionHeaderLabel, textStyles.start, { color: theme.colors.primary }]}>
        {label}
      </Text>
    </View>
  );
}

export function SettingsSectionCard({
  title,
  icon,
  children
}: {
  title: string;
  icon: IconName;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <SectionHeader icon={icon} label={title} />
      {children}
    </View>
  );
}

/**
 * Segmented group: each child becomes one row of a shared rounded surface,
 * with large outer corners and small inner corners.
 */
export function ListGroup({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const theme = useAppTheme();
  const rows = React.Children.toArray(children).filter(React.isValidElement);
  const background = surfaceRoles(theme).group;
  return (
    <View style={[styles.listGroup, style]}>
      {rows.map((row, index) => (
        <View key={row.key ?? index} style={[styles.segment, {
          backgroundColor: background,
          borderTopLeftRadius: index === 0 ? radius.card : radius.segment,
          borderTopRightRadius: index === 0 ? radius.card : radius.segment,
          borderBottomLeftRadius: index === rows.length - 1 ? radius.card : radius.segment,
          borderBottomRightRadius: index === rows.length - 1 ? radius.card : radius.segment
        }]}>
          {row}
        </View>
      ))}
    </View>
  );
}

export function IconCircle({ icon, tone = 'tonal', size: diameter = size.iconContainer }: {
  icon: IconName;
  tone?: 'tonal' | 'primary' | 'error' | 'success';
  size?: number;
}) {
  const theme = useAppTheme();
  const colors = tone === 'primary' ? [theme.colors.primary, theme.colors.onPrimary]
    : tone === 'error' ? [theme.colors.errorContainer, theme.colors.onErrorContainer]
      : tone === 'success' ? [theme.colors.tertiaryContainer, theme.colors.onTertiaryContainer]
        : [theme.colors.secondaryContainer, theme.colors.onSecondaryContainer];
  return (
    <View importantForAccessibility="no-hide-descendants"
      style={[styles.iconCircle, { width: diameter, height: diameter, borderRadius: diameter / 2, backgroundColor: colors[0] }]}>
      <MaterialCommunityIcons name={icon} size={Math.round(diameter * 0.5)} color={colors[1]} />
    </View>
  );
}

/** One row inside a ListGroup: leading icon, title, supporting text and trailing control. */
export function ListItem({
  icon,
  iconTone,
  leading,
  title,
  description,
  trailing,
  onPress,
  selected = false,
  disabled = false,
  accessibilityRole,
  accessibilityState,
  children,
  titleNumberOfLines
}: {
  icon?: IconName;
  iconTone?: 'tonal' | 'primary' | 'error' | 'success';
  leading?: React.ReactNode;
  title: string;
  description?: string;
  trailing?: React.ReactNode;
  onPress?: () => void;
  selected?: boolean;
  disabled?: boolean;
  accessibilityRole?: 'button' | 'radio' | 'switch' | 'checkbox' | 'link';
  accessibilityState?: { checked?: boolean; selected?: boolean; disabled?: boolean };
  children?: React.ReactNode;
  titleNumberOfLines?: number;
}) {
  const theme = useAppTheme();
  const roles = surfaceRoles(theme);
  const hasLeading = Boolean(leading ?? icon);
  // Extra controls (badges, details toggles) sit below the pressable row, so the row itself stays one
  // accessible element that exposes its role and checked state while the extras stay separately focusable.
  const extras = React.Children.toArray(children).length > 0 ? (
    <View style={[styles.listExtras, hasLeading ? styles.listExtrasIndented : null]}>{children}</View>
  ) : null;
  const body = (
    <>
      {leading ?? (icon ? <IconCircle icon={icon} tone={iconTone} /> : null)}
      <View style={styles.listText}>
        <Text variant="titleMedium" numberOfLines={titleNumberOfLines}
          style={[styles.listTitle, textStyles.start, { color: selected ? theme.colors.onSecondaryContainer : theme.colors.onSurface }]}>
          {title}
        </Text>
        {description ? (
          <Text variant="bodyMedium" style={[textStyles.start, { color: selected ? theme.colors.onSecondaryContainer : theme.colors.onSurfaceVariant }]}>
            {description}
          </Text>
        ) : null}
      </View>
      {trailing}
    </>
  );
  const rowStyle = [styles.listItem, extras ? styles.listItemWithExtras : null, { opacity: disabled ? 0.5 : 1 }];
  const selectedSurface = selected ? { backgroundColor: theme.colors.secondaryContainer } : null;
  if (!onPress) {
    return <View style={selectedSurface}><View style={rowStyle}>{body}</View>{extras}</View>;
  }
  return (
    <View style={selectedSurface}>
      <Pressable
        accessibilityRole={accessibilityRole ?? 'button'}
        accessibilityLabel={description ? `${title}, ${description}` : title}
        accessibilityState={{ disabled, ...accessibilityState }}
        disabled={disabled}
        onPress={onPress}
        android_ripple={{ color: roles.groupPressed }}
        style={({ pressed }) => [rowStyle, { backgroundColor: !selected && pressed ? roles.groupPressed : 'transparent' }]}
      >
        {body}
      </Pressable>
      {extras}
    </View>
  );
}

/** Navigation row that opens a deeper page. */
export function NavigationItem({ icon, title, description, onPress }: {
  icon: IconName; title: string; description?: string; onPress: () => void;
}) {
  const theme = useAppTheme();
  return <ListItem icon={icon} title={title} description={description} onPress={onPress}
    trailing={<MaterialCommunityIcons name={forwardChevron()} size={24} color={theme.colors.onSurfaceVariant} importantForAccessibility="no" />} />;
}

export function PremiumCard({
  title,
  icon,
  trailing,
  children,
  style,
  contentStyle
}: {
  title?: string;
  icon?: IconName;
  trailing?: React.ReactNode;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const theme = useAppTheme();
  return (
    <View style={[styles.sectionCard, { backgroundColor: surfaceRoles(theme).group }, style]}>
      {title || icon || trailing ? (
        <View style={styles.cardHeader}>
          {icon ? <IconCircle icon={icon} /> : null}
          {title ? (
            <Text variant="titleMedium" style={[styles.flex, styles.listTitle, textStyles.start]}>
              {title}
            </Text>
          ) : (
            <View style={styles.flex} />
          )}
          {trailing}
        </View>
      ) : null}
      <View style={[styles.cardContent, contentStyle]}>{children}</View>
    </View>
  );
}

/** Prominent colored notice with a leading icon, optionally tappable. */
export function InfoBanner({ icon, title, body, tone = 'primary', onPress, children }: {
  icon: IconName;
  title?: string;
  body?: string;
  tone?: 'primary' | 'error' | 'neutral';
  onPress?: () => void;
  children?: React.ReactNode;
}) {
  const theme = useAppTheme();
  const [background, foreground] = tone === 'error' ? [theme.colors.errorContainer, theme.colors.onErrorContainer]
    : tone === 'neutral' ? [surfaceRoles(theme).group, theme.colors.onSurfaceVariant]
      : [theme.colors.primaryContainer, theme.colors.onPrimaryContainer];
  const content = (
    <View style={styles.bannerRow}>
      <MaterialCommunityIcons name={icon} size={24} color={foreground} importantForAccessibility="no" />
      <View style={styles.listText}>
        {title ? <Text variant="titleMedium" style={[styles.listTitle, textStyles.start, { color: foreground }]}>{title}</Text> : null}
        {body ? <Text variant="bodyMedium" style={[textStyles.start, { color: foreground }]}>{body}</Text> : null}
        {children}
      </View>
    </View>
  );
  const shape = [styles.banner, { backgroundColor: background }];
  if (!onPress) return <View style={shape}>{content}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={[title, body].filter(Boolean).join(', ')} onPress={onPress}
      android_ripple={{ color: foreground + '22' }} style={shape}>
      {content}
    </Pressable>
  );
}

export function OptionChoiceCard({
  title,
  description,
  selected,
  disabled,
  badge,
  example,
  technicalDetail,
  caution,
  showRadio = true,
  onPress
}: {
  title: string;
  description?: string;
  selected: boolean;
  disabled?: boolean;
  badge?: string;
  example?: string;
  technicalDetail?: string;
  caution?: boolean;
  showRadio?: boolean;
  onPress?: () => void;
}) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const detail = technicalDetail ?? example;
  const textColor = selected ? theme.colors.onSecondaryContainer : theme.colors.onSurfaceVariant;
  return (
    <ListItem
      title={title}
      description={description}
      selected={selected}
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      trailing={showRadio ? (
        <RadioButton value={title} status={selected ? 'checked' : 'unchecked'} disabled={disabled} onPress={onPress}
          color={caution ? theme.colors.error : theme.colors.primary} />
      ) : selected ? (
        <MaterialCommunityIcons name="check-circle" size={24} color={caution ? theme.colors.error : theme.colors.primary} importantForAccessibility="no" />
      ) : null}
    >
      {badge ? <View style={styles.badgeLine}><StatusBadge label={badge} selected={!selected} /></View> : null}
      {detail ? (
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: detailsOpen }}
          onPress={() => setDetailsOpen((value) => !value)} style={styles.detailsToggle}>
          <Text variant="labelLarge" style={{ color: selected ? theme.colors.onSecondaryContainer : theme.colors.primary }}>
            {detailsOpen ? t('common.hideTechnicalDetails') : t('common.showTechnicalDetails')}
          </Text>
          <MaterialCommunityIcons name={detailsOpen ? 'chevron-up' : 'chevron-down'} size={18}
            color={selected ? theme.colors.onSecondaryContainer : theme.colors.primary} />
        </Pressable>
      ) : null}
      {detail && detailsOpen ? <FilePathText value={detail} maxLines={3} style={{ color: textColor }} /> : null}
    </ListItem>
  );
}

export function SettingRow({
  icon,
  title,
  description,
  value,
  onValueChange,
  children
}: {
  icon?: IconName;
  title: string;
  description?: string;
  value?: boolean;
  onValueChange?: (value: boolean) => void;
  children?: React.ReactNode;
}) {
  const toggles = typeof value === 'boolean' && onValueChange;
  return (
    <ListItem
      icon={icon}
      title={title}
      description={description}
      onPress={toggles ? () => onValueChange(!value) : undefined}
      accessibilityRole={toggles ? 'switch' : undefined}
      accessibilityState={toggles ? { checked: value } : undefined}
      trailing={toggles ? <Switch value={value} onValueChange={onValueChange} /> : undefined}
    >
      {children}
    </ListItem>
  );
}

export function InfoRow({ icon, label, value, path }: { icon: IconName; label: string; value: string; path?: boolean }) {
  const theme = useAppTheme();
  return (
    <SettingRow icon={icon} title={label}>
      {path ? (
        <FilePathText value={value} maxLines={2} />
      ) : (
        <Text variant="bodyMedium" numberOfLines={3} style={[textStyles.start, { color: theme.colors.onSurfaceVariant }]}>
          {value}
        </Text>
      )}
    </SettingRow>
  );
}

export function ExpandableTechnicalDetails({
  title,
  collapsedTitle,
  expandedTitle,
  children,
  initiallyExpanded = false,
  expanded,
  onExpandedChange,
  style
}: {
  title?: string;
  collapsedTitle?: string;
  expandedTitle?: string;
  children: React.ReactNode;
  initiallyExpanded?: boolean;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const [internalOpen, setInternalOpen] = React.useState(initiallyExpanded);
  const open = expanded ?? internalOpen;
  const label = title ?? (open ? expandedTitle ?? t('common.hideTechnicalDetails') : collapsedTitle ?? t('common.showTechnicalDetails'));
  function toggleOpen() {
    const nextOpen = !open;
    if (expanded === undefined) setInternalOpen(nextOpen);
    onExpandedChange?.(nextOpen);
  }
  return (
    <View style={[styles.expandableDetails, style]}>
      <Pressable onPress={toggleOpen} accessibilityRole="button" accessibilityState={{ expanded: open }} style={styles.expandableHeader}>
        <Text variant="labelLarge" style={[styles.flex, textStyles.start, { color: theme.colors.primary }]}>
          {label}
        </Text>
        <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={22} color={theme.colors.primary} />
      </Pressable>
      {open ? (
        <View style={[styles.expandableBody, { backgroundColor: surfaceRoles(theme).low }]}>
          {children}
        </View>
      ) : null}
    </View>
  );
}

export const MediaThumbnail = React.memo(function MediaThumbnail({
  mediaType,
  uri,
  thumbnailUri,
  size: diameter = 78,
  style
}: {
  mediaType?: MediaType;
  uri?: string | null;
  thumbnailUri?: string | null;
  size?: number;
  style?: StyleProp<ViewStyle | ImageStyle>;
}) {
  const theme = useAppTheme();
  const normalizedType = mediaType ?? 'unknown';
  const [resolved, setResolved] = React.useState<{ source: string; result: ThumbnailResult } | null>(null);
  const [failedSupplied, setFailedSupplied] = React.useState<string | null>(null);
  const [retry, setRetry] = React.useState(0);
  const retriedSource = React.useRef<string | null>(null);
  const supplied = thumbnailUri && failedSupplied !== thumbnailUri ? thumbnailUri : null;
  const source = uri ?? '';
  const visual = normalizedType === 'photo' || normalizedType === 'sticker' || normalizedType === 'gif'
    || normalizedType === 'video' || normalizedType === 'document';
  React.useEffect(() => {
    if (!source || !visual || supplied) return;
    let disposed = false;
    void getThumbnail(source, 256).then((result) => {
      if (!disposed) setResolved({ source, result });
    });
    return () => { disposed = true; };
  }, [retry, source, supplied, visual]);
  const nativeImage = resolved?.source === source && resolved.result.available ? resolved.result.uri : null;
  const image = supplied ?? nativeImage;
  const thumbStyle = [styles.mediaImage, { width: diameter, height: diameter }, style] as StyleProp<ImageStyle>;
  const iconStyle = [
    styles.mediaIcon,
    { width: diameter, height: diameter, backgroundColor: theme.colors.secondaryContainer },
    style
  ] as StyleProp<ViewStyle>;

  if (image) {
    return <ExpoImage source={image} contentFit="cover" style={thumbStyle} onError={() => {
      if (supplied) setFailedSupplied(supplied);
      else if (retriedSource.current !== source) {
        retriedSource.current = source;
        setResolved(null);
        void invalidateThumbnail(image).then(() => setRetry((value) => value + 1), () => undefined);
      } else setResolved(null);
    }} />;
  }

  return (
    <View style={iconStyle}>
      <MaterialCommunityIcons name={getMediaIcon(normalizedType)} size={Math.max(20, Math.round(diameter * 0.4))} color={theme.colors.onSecondaryContainer} />
    </View>
  );
});

function getMediaIcon(mediaType: MediaType): IconName {
  if (mediaType === 'video') return 'video-outline';
  if (mediaType === 'voice' || mediaType === 'audio') return 'microphone-outline';
  if (mediaType === 'sticker') return 'sticker-outline';
  if (mediaType === 'document') return 'file-document-outline';
  if (mediaType === 'photo' || mediaType === 'gif') return 'image-outline';
  return 'file-question-outline';
}

function createStyles() {
  return StyleSheet.create({
  scaffoldSafeArea: {
    flex: 1
  },
  scaffoldAppbar: {
    minHeight: size.topBarHeight,
    height: 'auto',
    flexShrink: 0,
    paddingHorizontal: 4,
    gap: 0
  },
  compactTitle: {
    paddingHorizontal: 12,
    letterSpacing: 0
  },
  largeHeader: {
    paddingHorizontal: spacing.screenHorizontal + 4,
    paddingTop: spacing.smallGap,
    paddingBottom: spacing.card,
    gap: spacing.smallGap
  },
  largeTitle: {
    ...appTypography.largeTitle,
    letterSpacing: 0
  },
  compactHeaderMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.smallGap,
    paddingHorizontal: spacing.screenHorizontal,
    paddingBottom: spacing.smallGap
  },
  progressWrap: {
    paddingHorizontal: spacing.screenHorizontal,
    paddingBottom: spacing.smallGap
  },
  progress: {
    height: 4,
    borderRadius: 2
  },
  stepPill: {
    alignSelf: 'flex-start',
    borderRadius: radius.chip,
    paddingHorizontal: 10,
    paddingVertical: 3
  },
  scaffoldContent: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: spacing.screenHorizontal
  },
  bottomActionBar: {
    flexShrink: 0,
    paddingHorizontal: spacing.screenHorizontal,
    paddingTop: spacing.gap,
    gap: spacing.smallGap
  },
  pathText: {
    ...appTypography.caption,
    textAlign: 'auto',
    writingDirection: 'auto'
  },
  badge: {
    minHeight: size.chipHeight,
    borderRadius: radius.chip,
    paddingHorizontal: 10,
    justifyContent: 'center',
    alignSelf: 'flex-start'
  },
  badgeText: {
    fontWeight: '700',
    maxWidth: 200,
    textAlign: 'auto',
    writingDirection: 'auto'
  },
  fullButton: {
    minHeight: size.buttonHeight,
    flexShrink: 0,
    borderRadius: radius.button
  },
  primaryButtonContent: {
    minHeight: size.buttonHeight
  },
  iconAfterLabel: {
    flexDirection: 'row-reverse'
  },
  buttonLabel: {
    ...appTypography.button
  },
  secondaryButton: {
    minHeight: size.smallButtonHeight,
    flexShrink: 0,
    borderRadius: radius.smallButton
  },
  secondaryButtonContent: {
    minHeight: size.smallButtonHeight
  },
  secondaryButtonLabel: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600'
  },
  section: {
    gap: spacing.smallGap
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.smallGap,
    minHeight: 36,
    paddingHorizontal: spacing.tinyGap
  },
  sectionHeaderLabel: {
    ...appTypography.sectionTitle,
    letterSpacing: 0.1
  },
  listGroup: {
    gap: spacing.segmentGap
  },
  segment: {
    overflow: 'hidden'
  },
  listItem: {
    minHeight: size.listItemMinHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: spacing.compactInner,
    paddingVertical: 14
  },
  listItemWithExtras: {
    paddingBottom: 6
  },
  listExtras: {
    paddingHorizontal: spacing.compactInner,
    paddingBottom: 10,
    gap: 2
  },
  listExtrasIndented: {
    paddingStart: spacing.compactInner + size.iconContainer + 16
  },
  listText: {
    flex: 1,
    minWidth: 0,
    gap: 2
  },
  listTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '500',
    letterSpacing: 0
  },
  iconCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  sectionCard: {
    borderRadius: radius.card,
    padding: spacing.innerCard,
    gap: spacing.gap
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.gap,
    minHeight: size.touchTarget
  },
  cardContent: {
    gap: spacing.gap
  },
  banner: {
    borderRadius: radius.card,
    paddingHorizontal: 20,
    paddingVertical: 18,
    overflow: 'hidden'
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16
  },
  badgeLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingTop: 4
  },
  detailsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minHeight: size.touchTarget,
    alignSelf: 'flex-start'
  },
  expandableDetails: {
    gap: spacing.smallGap
  },
  expandableHeader: {
    minHeight: size.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.smallGap
  },
  expandableBody: {
    borderRadius: 16,
    padding: spacing.compactInner,
    gap: spacing.smallGap
  },
  mediaImage: {
    width: 78,
    height: 78,
    borderRadius: radius.thumbnail
  },
  mediaIcon: {
    width: 78,
    height: 78,
    borderRadius: radius.thumbnail,
    alignItems: 'center',
    justifyContent: 'center'
  },
  logo: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: '#ffffff',
    flexShrink: 0
  },
  logoImage: {
    width: '100%',
    height: '100%'
  },
  tabular: {
    fontVariant: ['tabular-nums'],
    fontWeight: '700'
  },
  flex: {
    flex: 1,
    minWidth: 0
  }
  });
}
