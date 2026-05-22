import React from 'react';
import { Pressable, StatusBar, StyleSheet, View, type ImageStyle, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Appbar, Button, Chip, IconButton, ProgressBar, RadioButton, Surface, Switch, Text } from 'react-native-paper';
import { Image as ExpoImage } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { useAppLayoutDirection } from '../i18n/AppLayoutDirectionContext';
import { spacing, radius, size, appTypography, appColorTokens } from '../theme/designTokens';
import { useAppTheme } from '../theme/useAppTheme';
import type { ExtractedMediaFile, MediaType } from '../types/media';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

export const textStyles = StyleSheet.create({
  start: {
    textAlign: 'auto',
    writingDirection: 'auto'
  }
});

const styles = createStyles();

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
  contentStyle
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
}) {
  const theme = useAppTheme();
  const layoutDirection = useAppLayoutDirection();
  const statusBarStyle = theme.dark ? 'light-content' : 'dark-content';

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.scaffoldSafeArea, { backgroundColor: theme.colors.background }]}>
      <StatusBar translucent backgroundColor="transparent" barStyle={statusBarStyle} />
      <Appbar.Header mode="small" elevated={false} statusBarHeight={0} style={[styles.scaffoldAppbar, { backgroundColor: theme.colors.background }]}>
        {onBack ? <Appbar.BackAction disabled={backDisabled} onPress={onBack} /> : null}
        <View style={styles.flex} />
        {actions}
      </Appbar.Header>
      {showProgress && typeof progress === 'number' ? (
        <ProgressBar progress={progress} color={theme.colors.primary} style={[styles.scaffoldProgress, layoutDirection === 'rtl' ? styles.rtlProgress : null]} />
      ) : null}
      <StepHeader stepLabel={stepLabel} title={title} subtitle={subtitle} />
      <View style={[styles.scaffoldContent, contentStyle]}>{children}</View>
      {footer ? <PrimaryBottomActionBar>{footer}</PrimaryBottomActionBar> : null}
    </SafeAreaView>
  );
}

export function StepHeader({
  stepLabel,
  title,
  subtitle,
  style
}: {
  stepLabel?: string;
  title: string;
  subtitle?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useAppTheme();
  return (
    <View style={[styles.stepHeader, style]}>
      <View style={styles.stepHeaderLine}>
        {stepLabel ? (
          <View style={[styles.stepPill, { backgroundColor: theme.colors.secondaryContainer }]}>
            <Text variant="labelSmall" numberOfLines={1} style={[styles.tabular, { color: theme.colors.onSecondaryContainer }]}>
              {stepLabel}
            </Text>
          </View>
        ) : null}
        <Text variant="titleSmall" numberOfLines={1} ellipsizeMode="tail" style={[styles.screenTitle, textStyles.start]}>
          {title}
        </Text>
      </View>
      {subtitle ? (
        <Text variant="bodySmall" numberOfLines={1} ellipsizeMode="tail" style={[styles.scaffoldSubtitle, textStyles.start, { color: theme.colors.onSurfaceVariant }]}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

export function PrimaryBottomActionBar({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  return (
    <Surface
      elevation={2}
      style={[
        styles.primaryBottomActionBar,
        {
          backgroundColor: theme.colors.surface,
          paddingBottom: Math.max(insets.bottom, spacing.compactInner)
        },
        style
      ]}
    >
      {children}
    </Surface>
  );
}

export function semanticColors(theme: ReturnType<typeof useAppTheme>) {
  const tokens = appColorTokens[theme.dark ? 'dark' : 'light'];
  return {
    primaryBrown: theme.colors.primary,
    primaryBrownOn: theme.colors.onPrimary,
    peachSelected: theme.colors.primaryContainer,
    peachSoft: theme.colors.secondaryContainer,
    surface: theme.colors.surface,
    surfaceVariant: theme.colors.surfaceContainerHigh ?? theme.colors.surfaceVariant,
    borderSubtle: theme.colors.outlineVariant,
    textPrimary: theme.colors.onSurface,
    textSecondary: theme.colors.onSurfaceVariant,
    danger: theme.colors.error,
    warning: tokens.warning,
    warningContainer: tokens.warningContainer,
    success: tokens.success,
    successContainer: tokens.successContainer,
    disabled: theme.colors.surfaceDisabled
  };
}

export function shortenMiddle(value: string, max = 76): string {
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

export function StatusBadge({ label, selected = false, danger = false }: { label: string; selected?: boolean; danger?: boolean }) {
  const theme = useAppTheme();
  const colors = semanticColors(theme);
  return (
    <Chip
      compact
      style={[
        styles.badge,
        {
          backgroundColor: danger ? theme.colors.errorContainer : selected ? colors.peachSelected : colors.surfaceVariant,
          borderColor: danger ? theme.colors.error : selected ? colors.primaryBrown : colors.borderSubtle
        }
      ]}
      textStyle={[
        styles.badgeText,
        { color: danger ? theme.colors.onErrorContainer : selected ? theme.colors.onPrimaryContainer : colors.textSecondary }
      ]}
    >
      {label}
    </Chip>
  );
}

export function SelectableChip({
  label,
  selected,
  onPress,
  icon,
  disabled,
  style
}: {
  label: string;
  selected: boolean;
  onPress?: () => void;
  icon?: IconName;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useAppTheme();
  const colors = semanticColors(theme);
  return (
    <Chip
      selected={selected}
      showSelectedCheck
      icon={icon}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.filterChip,
        {
          backgroundColor: selected ? colors.peachSelected : colors.surface,
          borderColor: selected ? colors.primaryBrown : colors.borderSubtle
        },
        style
      ]}
      textStyle={[styles.filterChipText, { color: selected ? theme.colors.onPrimaryContainer : colors.textSecondary }]}
    >
      {label}
    </Chip>
  );
}

export function PrimaryButton({
  children,
  icon,
  disabled,
  onPress,
  style
}: {
  children: React.ReactNode;
  icon?: string;
  disabled?: boolean;
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
      contentStyle={styles.primaryButtonContent}
      labelStyle={styles.buttonLabel}
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
      mode={selected ? 'contained-tonal' : danger ? 'text' : 'outlined'}
      icon={icon}
      disabled={disabled}
      textColor={danger ? theme.colors.error : undefined}
      onPress={onPress}
      style={[styles.secondaryButton, style]}
      contentStyle={styles.secondaryButtonContent}
      labelStyle={styles.secondaryButtonLabel}
    >
      {children}
    </Button>
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
    <PremiumCard>
      <SectionHeader icon={icon} label={title} />
      {children}
    </PremiumCard>
  );
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
  const colors = semanticColors(theme);
  return (
    <Surface elevation={0} style={[styles.sectionCard, { borderColor: colors.borderSubtle, backgroundColor: colors.surface }, style]}>
      {title || icon || trailing ? (
        <View style={styles.sectionHeader}>
          {icon ? (
            <View style={[styles.smallIconBubble, { backgroundColor: colors.peachSoft }]}>
              <MaterialCommunityIcons name={icon} size={20} color={colors.primaryBrown} />
            </View>
          ) : null}
          {title ? (
            <Text variant="titleMedium" numberOfLines={3} style={[styles.sectionTitle, textStyles.start]}>
              {title}
            </Text>
          ) : (
            <View style={styles.flex} />
          )}
          {trailing}
        </View>
      ) : null}
      <View style={[styles.cardContent, contentStyle]}>{children}</View>
    </Surface>
  );
}

export function SectionHeader({
  icon,
  label,
  style
}: {
  icon: IconName;
  label: string;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useAppTheme();
  const colors = semanticColors(theme);
  return (
    <View style={[styles.sectionHeader, style]}>
      <View style={[styles.smallIconBubble, { backgroundColor: colors.peachSoft }]}>
        <MaterialCommunityIcons name={icon} size={20} color={colors.primaryBrown} />
      </View>
      <Text variant="titleMedium" numberOfLines={3} style={[styles.sectionTitle, textStyles.start, { color: colors.primaryBrown }]}>
        {label}
      </Text>
    </View>
  );
}

export function StatusBanner({
  tone = 'info',
  title,
  body,
  icon,
  style
}: {
  tone?: 'info' | 'success' | 'warning' | 'error';
  title: string;
  body?: string;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useAppTheme();
  const colors = semanticColors(theme);
  const toneColor =
    tone === 'error'
      ? theme.colors.error
      : tone === 'warning'
        ? colors.warning
        : tone === 'success'
          ? colors.success
          : theme.colors.primary;
  const background =
    tone === 'error'
      ? theme.colors.errorContainer
      : tone === 'warning'
        ? colors.warningContainer
        : tone === 'success'
          ? colors.successContainer
          : theme.colors.primaryContainer;
  return (
    <Surface elevation={0} style={[styles.statusBanner, { backgroundColor: background, borderColor: toneColor }, style]}>
      <MaterialCommunityIcons name={icon ?? (tone === 'success' ? 'check-circle-outline' : tone === 'error' ? 'alert-circle-outline' : 'information-outline')} size={24} color={toneColor} />
      <View style={styles.flex}>
        <Text variant="titleSmall" style={[styles.settingTitle, textStyles.start, { color: theme.colors.onSurface }]}>
          {title}
        </Text>
        {body ? (
          <Text variant="bodySmall" style={[textStyles.start, { color: theme.colors.onSurfaceVariant }]}>
            {body}
          </Text>
        ) : null}
      </View>
    </Surface>
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
  const colors = semanticColors(theme);
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const detail = technicalDetail ?? example;
  const content = (
    <Surface
      elevation={0}
      style={[
        styles.optionCard,
        {
          backgroundColor: selected ? colors.peachSelected : colors.surface,
          borderColor: caution && selected ? theme.colors.error : selected ? colors.primaryBrown : colors.borderSubtle,
          opacity: disabled ? 0.56 : 1
        }
      ]}
    >
      <View style={styles.optionTop}>
        <View style={styles.optionText}>
          {badge ? (
            <View style={styles.badgeLine}>
              <StatusBadge label={badge} selected={selected} />
            </View>
          ) : null}
          <Text variant="bodyMedium" numberOfLines={2} style={[styles.optionTitle, textStyles.start]}>
            {title}
          </Text>
        </View>
        {showRadio ? <RadioButton value={title} status={selected ? 'checked' : 'unchecked'} disabled={disabled} onPress={onPress} /> : null}
      </View>
      {description ? (
        <Text
          variant="bodySmall"
          numberOfLines={3}
          style={[styles.optionDescription, textStyles.start, { color: selected ? theme.colors.onPrimaryContainer : colors.textSecondary }]}
        >
          {description}
        </Text>
      ) : null}
      {detail ? (
        <Button
          mode="text"
          compact
          icon={detailsOpen ? 'chevron-up' : 'chevron-down'}
          onPress={() => setDetailsOpen((value) => !value)}
          style={styles.detailsButton}
          labelStyle={styles.detailsButtonLabel}
        >
          {detailsOpen ? t('common.hideTechnicalDetails') : t('common.showTechnicalDetails')}
        </Button>
      ) : null}
      {detail && detailsOpen ? (
        <Surface elevation={0} style={[styles.codePathContainer, { backgroundColor: theme.colors.surface }]}>
          <FilePathText value={detail} maxLines={3} style={{ color: colors.textSecondary }} />
        </Surface>
      ) : null}
    </Surface>
  );

  if (disabled || !onPress) return content;
  return <Pressable onPress={onPress}>{content}</Pressable>;
}

export function SelectableOptionCard(props: React.ComponentProps<typeof OptionChoiceCard>) {
  return <OptionChoiceCard {...props} />;
}

export function OptionCard(props: React.ComponentProps<typeof OptionChoiceCard>) {
  return <OptionChoiceCard {...props} />;
}

export function FilterChipGroup<T extends string>({
  values,
  selectedValues,
  getLabel,
  onToggle,
  style
}: {
  values: T[];
  selectedValues: T[];
  getLabel: (value: T) => string;
  onToggle: (value: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.chipWrap, style]}>
      {values.map((value) => {
        const selected = selectedValues.includes(value);
        return (
          <SelectableChip
            key={value}
            selected={selected}
            onPress={() => onToggle(value)}
            label={getLabel(value)}
          />
        );
      })}
    </View>
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
  const theme = useAppTheme();
  const colors = semanticColors(theme);
  return (
    <View style={styles.settingRow}>
      {icon ? (
        <View style={[styles.rowIcon, { backgroundColor: colors.peachSoft }]}>
          <MaterialCommunityIcons name={icon} size={20} color={colors.primaryBrown} />
        </View>
      ) : null}
      <View style={styles.settingText}>
        <Text variant="titleSmall" numberOfLines={2} style={[textStyles.start, styles.settingTitle]}>
          {title}
        </Text>
        {description ? (
          <Text variant="bodySmall" numberOfLines={3} style={[textStyles.start, { color: colors.textSecondary }]}>
            {description}
          </Text>
        ) : null}
        {children}
      </View>
      {typeof value === 'boolean' && onValueChange ? <Switch value={value} onValueChange={onValueChange} /> : null}
    </View>
  );
}

export function InfoRow({ icon, label, value, path }: { icon: IconName; label: string; value: string; path?: boolean }) {
  const theme = useAppTheme();
  return (
    <SettingRow icon={icon} title={label}>
      {path ? (
        <FilePathText value={value} maxLines={2} />
      ) : (
        <Text variant="bodySmall" numberOfLines={3} style={[textStyles.start, { color: theme.colors.onSurfaceVariant }]}>
          {value}
        </Text>
      )}
    </SettingRow>
  );
}

export function MetricTile({ label, value }: { label: string; value: string | number }) {
  const theme = useAppTheme();
  return (
    <Surface elevation={0} style={[styles.metricTile, { backgroundColor: theme.colors.surfaceContainerHigh ?? theme.colors.surfaceVariant }]}>
      <Text variant="titleMedium" numberOfLines={1} style={styles.tabular}>
        {value}
      </Text>
      <Text variant="labelSmall" numberOfLines={2} style={[textStyles.start, { color: theme.colors.onSurfaceVariant }]}>
        {label}
      </Text>
    </Surface>
  );
}

export function SummaryMetricCard({ label, value, icon }: { label: string; value: string | number; icon?: IconName }) {
  const theme = useAppTheme();
  return (
    <Surface elevation={0} style={[styles.summaryMetricCard, { backgroundColor: theme.colors.surfaceContainerHigh ?? theme.colors.surfaceVariant }]}>
      {icon ? <MaterialCommunityIcons name={icon} size={20} color={theme.colors.primary} /> : null}
      <View style={styles.flex}>
        <Text variant="titleLarge" numberOfLines={1} style={styles.tabular}>
          {value}
        </Text>
        <Text variant="labelMedium" numberOfLines={2} style={[textStyles.start, { color: theme.colors.onSurfaceVariant }]}>
          {label}
        </Text>
      </View>
    </Surface>
  );
}

export function ExpandableTechnicalDetails({
  title,
  collapsedTitle,
  expandedTitle,
  children,
  initiallyExpanded = false,
  style
}: {
  title?: string;
  collapsedTitle?: string;
  expandedTitle?: string;
  children: React.ReactNode;
  initiallyExpanded?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const [open, setOpen] = React.useState(initiallyExpanded);
  const label = title ?? (open ? expandedTitle ?? t('common.hideTechnicalDetails') : collapsedTitle ?? t('common.showTechnicalDetails'));
  return (
    <View style={[styles.expandableDetails, style]}>
      <Pressable onPress={() => setOpen((value) => !value)} style={styles.expandableHeader}>
        <Text variant="labelLarge" style={[styles.flex, textStyles.start, { color: theme.colors.primary }]}>
          {label}
        </Text>
        <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={22} color={theme.colors.primary} />
      </Pressable>
      {open ? (
        <Surface elevation={0} style={[styles.expandableBody, { backgroundColor: theme.colors.surfaceContainerLow ?? theme.colors.surfaceVariant }]}>
          {children}
        </Surface>
      ) : null}
    </View>
  );
}

export function MediaFileListItem({
  file,
  selected,
  onToggle,
  onPreview
}: {
  file: ExtractedMediaFile;
  selected: boolean;
  onToggle: () => void;
  onPreview: () => void;
}) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const colors = semanticColors(theme);
  const sender = file.sourceKind === 'chat-transcript'
    ? t('fileSelection.chatTranscript')
    : file.matchedRecord?.sender ?? t('fileSelection.unknownSender');
  const restoredDate = file.sourceKind === 'chat-transcript'
    ? t('fileSelection.chatTranscriptFile')
    : file.matchedRecord?.messageDateIso ? new Date(file.matchedRecord.messageDateIso).toLocaleString() : t('fileSelection.noDate');
  return (
    <Pressable onPress={onToggle} accessibilityRole="button">
      <Surface
        elevation={0}
        style={[
          styles.mediaItem,
          {
            backgroundColor: selected ? colors.peachSelected : colors.surface,
            borderColor: selected ? colors.primaryBrown : colors.borderSubtle
          }
        ]}
      >
        <MediaThumb file={file} />
        <View style={styles.mediaText}>
          <View style={styles.mediaMainLine}>
            <StatusBadge label={t(`media.singular.${file.mediaType}`)} selected={selected} />
            {selected ? <MaterialCommunityIcons name="check-circle" size={22} color={colors.primaryBrown} /> : null}
          </View>
          <Text variant="titleSmall" numberOfLines={1} ellipsizeMode="tail" style={[styles.mediaTitle, textStyles.start]}>
            {sender}
          </Text>
          <Text variant="bodySmall" numberOfLines={1} style={[textStyles.start, { color: colors.textSecondary }]}>
            {restoredDate}
          </Text>
          <Text variant="bodySmall" numberOfLines={1} ellipsizeMode="middle" style={[textStyles.start, { color: colors.textSecondary }]}>
            {file.filename}
          </Text>
        </View>
        <IconButton
          icon="eye-outline"
          size={20}
          onPress={(event) => {
            event.stopPropagation();
            onPreview();
          }}
          accessibilityLabel={t('fileSelection.previewFile')}
        />
      </Surface>
    </Pressable>
  );
}

function MediaThumb({ file }: { file: ExtractedMediaFile }) {
  const theme = useAppTheme();
  if (file.mediaType === 'photo' || file.mediaType === 'sticker') {
    return <ExpoImage source={file.thumbnailUri ?? file.uri} contentFit="cover" style={styles.mediaImage as StyleProp<ImageStyle>} />;
  }
  return (
    <View style={[styles.mediaIcon, { backgroundColor: theme.colors.surfaceContainerHigh ?? theme.colors.surfaceVariant }]}>
        <MaterialCommunityIcons name={getMediaIcon(file.mediaType)} size={22} color={theme.colors.primary} />
    </View>
  );
}

function getMediaIcon(mediaType: MediaType): IconName {
  if (mediaType === 'video') return 'video-outline';
  if (mediaType === 'voice' || mediaType === 'audio') return 'microphone-outline';
  if (mediaType === 'sticker') return 'sticker-outline';
  if (mediaType === 'document') return 'file-document-outline';
  return 'file-question-outline';
}

function createStyles() {
  return StyleSheet.create({
  scaffoldSafeArea: {
    flex: 1
  },
  scaffoldAppbar: {
    height: 48,
    paddingHorizontal: 8
  },
  scaffoldProgress: {
    height: 3
  },
  rtlProgress: {
    transform: [{ scaleX: -1 }]
  },
  stepHeader: {
    paddingHorizontal: spacing.screenHorizontal,
    paddingTop: spacing.tinyGap,
    paddingBottom: spacing.smallGap,
    gap: 2
  },
  stepHeaderLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.smallGap
  },
  stepPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    maxWidth: 112
  },
  screenTitle: {
    ...appTypography.cardTitle,
    flex: 1,
    letterSpacing: 0,
    fontWeight: '800'
  },
  scaffoldSubtitle: {
    ...appTypography.caption
  },
  scaffoldContent: {
    flex: 1,
    paddingHorizontal: spacing.screenHorizontal,
    paddingTop: spacing.tinyGap
  },
  primaryBottomActionBar: {
    paddingHorizontal: spacing.screenHorizontal,
    paddingTop: spacing.compactInner,
    minHeight: size.stickyFooterMinHeight,
    gap: spacing.smallGap
  },
  pathText: {
    ...appTypography.caption,
    textAlign: 'auto',
    writingDirection: 'auto'
  },
  badge: {
    minHeight: size.chipHeight,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.chip,
    alignSelf: 'flex-start'
  },
  badgeText: {
    ...appTypography.caption,
    fontWeight: '700',
    maxWidth: 180,
    textAlign: 'auto',
    writingDirection: 'auto'
  },
  fullButton: {
    borderRadius: radius.button
  },
  primaryButtonContent: {
    minHeight: size.buttonHeight
  },
  buttonLabel: {
    ...appTypography.button
  },
  secondaryButton: {
    borderRadius: radius.smallButton
  },
  secondaryButtonContent: {
    minHeight: size.smallButtonHeight
  },
  secondaryButtonLabel: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '700'
  },
  sectionCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.card,
    padding: spacing.innerCard,
    gap: spacing.gap
  },
  cardContent: {
    gap: spacing.gap
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.gap,
    minHeight: size.touchTarget
  },
  smallIconBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center'
  },
  sectionTitle: {
    flex: 1,
    ...appTypography.cardTitle
  },
  optionCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.card,
    padding: spacing.compactInner,
    gap: spacing.gap,
    minHeight: 88
  },
  optionTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.gap
  },
  optionText: {
    flex: 1,
    minWidth: 0,
    gap: spacing.smallGap
  },
  optionTitle: {
    ...appTypography.cardTitle
  },
  optionDescription: {
    ...appTypography.secondaryBody
  },
  badgeLine: {
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  codePathContainer: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  detailsButton: {
    alignSelf: 'flex-start',
    marginHorizontal: -8,
    marginVertical: -2
  },
  detailsButtonLabel: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700'
  },
  settingRow: {
    minHeight: size.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.gap
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center'
  },
  settingText: {
    flex: 1,
    minWidth: 0,
    gap: 3
  },
  settingTitle: {
    fontWeight: '700'
  },
  metricTile: {
    flex: 1,
    minWidth: 98,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4
  },
  summaryMetricCard: {
    flex: 1,
    minWidth: 112,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.smallGap
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
    borderRadius: 18,
    padding: spacing.compactInner,
    gap: spacing.smallGap
  },
  statusBanner: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.card,
    padding: spacing.compactInner,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.gap
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.smallGap
  },
  filterChip: {
    minHeight: size.chipHeight,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.chip
  },
  filterChipText: {
    ...appTypography.caption,
    fontWeight: '700'
  },
  mediaItem: {
    minHeight: 104,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: radius.card,
    padding: spacing.gap,
    gap: spacing.gap,
  },
  mediaText: {
    flex: 1,
    minWidth: 0,
    gap: 4
  },
  mediaMainLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.smallGap
  },
  mediaTitle: {
    fontWeight: '700'
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
