import React from 'react';
import { Pressable, StyleSheet, View, type ImageStyle, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, Checkbox, Chip, RadioButton, Surface, Switch, Text } from 'react-native-paper';
import { Image as ExpoImage } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { spacing, radius, size, appTypography } from '../theme/designTokens';
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

export function semanticColors(theme: ReturnType<typeof useAppTheme>) {
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
  const theme = useAppTheme();
  const colors = semanticColors(theme);
  return (
    <Surface elevation={0} style={[styles.sectionCard, { borderColor: colors.borderSubtle, backgroundColor: colors.surface }]}>
      <View style={styles.sectionHeader}>
        <View style={[styles.smallIconBubble, { backgroundColor: colors.peachSoft }]}>
          <MaterialCommunityIcons name={icon} size={20} color={colors.primaryBrown} />
        </View>
        <Text variant="titleMedium" numberOfLines={2} style={[styles.sectionTitle, textStyles.start]}>
          {title}
        </Text>
      </View>
      {children}
    </Surface>
  );
}

export function SelectableOptionCard({
  title,
  description,
  selected,
  disabled,
  badge,
  example,
  showRadio = true,
  onPress
}: {
  title: string;
  description: string;
  selected: boolean;
  disabled?: boolean;
  badge?: string;
  example?: string;
  showRadio?: boolean;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  const colors = semanticColors(theme);
  const content = (
    <Surface
      elevation={0}
      style={[
        styles.optionCard,
        {
          backgroundColor: selected ? colors.peachSelected : colors.surfaceVariant,
          borderColor: selected ? colors.primaryBrown : colors.borderSubtle,
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
      <Text
        variant="bodySmall"
        numberOfLines={2}
        style={[styles.optionDescription, textStyles.start, { color: selected ? theme.colors.onPrimaryContainer : colors.textSecondary }]}
      >
        {description}
      </Text>
      {example ? (
        <Surface elevation={0} style={[styles.codePathContainer, { backgroundColor: theme.colors.surface }]}>
          <FilePathText value={example} maxLines={2} style={{ color: colors.textSecondary }} />
        </Surface>
      ) : null}
    </Surface>
  );

  if (disabled) return content;
  return <Pressable onPress={onPress}>{content}</Pressable>;
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
  return (
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
      <Pressable onPress={onPreview} style={styles.mediaPreviewPress}>
        <MediaThumb file={file} />
        <View style={styles.mediaText}>
          <Text variant="bodyMedium" numberOfLines={1} ellipsizeMode="tail" style={[styles.mediaTitle, textStyles.start]}>
            {file.filename}
          </Text>
          <Text variant="bodySmall" numberOfLines={1} style={[textStyles.start, { color: colors.textSecondary }]}>
            {`${t(`media.singular.${file.mediaType}`)} • ${file.matchedRecord?.sender ?? t('fileSelection.unknownSender')}`}
          </Text>
          <Text variant="bodySmall" numberOfLines={1} style={[textStyles.start, { color: colors.textSecondary }]}>
            {file.matchedRecord?.messageDateIso ? new Date(file.matchedRecord.messageDateIso).toLocaleString() : t('fileSelection.noDate')}
          </Text>
        </View>
      </Pressable>
      <CheckboxHitBox selected={selected} onToggle={onToggle} />
    </Surface>
  );
}

function CheckboxHitBox({ selected, onToggle }: { selected: boolean; onToggle: () => void }) {
  return (
    <View style={styles.checkboxBox}>
      <Checkbox status={selected ? 'checked' : 'unchecked'} onPress={onToggle} />
    </View>
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
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6
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
    minWidth: 84,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2
  },
  mediaItem: {
    minHeight: size.listItemMinHeight,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.thumbnail,
    paddingHorizontal: spacing.smallGap,
    paddingVertical: spacing.tinyGap,
    gap: spacing.tinyGap
  },
  mediaPreviewPress: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.gap,
    minWidth: 0
  },
  mediaText: {
    flex: 1,
    minWidth: 0,
    gap: 0
  },
  mediaTitle: {
    fontWeight: '700'
  },
  mediaImage: {
    width: 48,
    height: 48,
    borderRadius: radius.thumbnail
  },
  mediaIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.thumbnail,
    alignItems: 'center',
    justifyContent: 'center'
  },
  checkboxBox: {
    width: size.touchTarget,
    height: size.touchTarget,
    alignItems: 'center',
    justifyContent: 'center'
  },
  tabular: {
    fontVariant: ['tabular-nums'],
    fontWeight: '700'
  }
  });
}
