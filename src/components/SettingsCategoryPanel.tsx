import React from 'react';
import { I18nManager, Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text } from 'react-native-paper';
import { useAppTheme } from '../theme/useAppTheme';
import { radius, size, spacing } from '../theme/designTokens';
import { textStyles } from './AppUi';

export function SettingsCategoryPanel({ title, summary, icon, onPress }: {
  title: string;
  summary: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  onPress: () => void;
}) {
  const theme = useAppTheme();
  return (
    <Pressable accessible accessibilityRole="button" accessibilityLabel={title} accessibilityHint={summary}
      onPress={onPress} style={({ pressed }) => [styles.row, {
        backgroundColor: pressed ? theme.colors.secondaryContainer : theme.colors.surface,
        borderColor: theme.colors.outlineVariant
      }]}>
      <View style={[styles.icon, { backgroundColor: theme.colors.secondaryContainer }]} importantForAccessibility="no-hide-descendants">
        <MaterialCommunityIcons name={icon} size={22} color={theme.colors.onSecondaryContainer} />
      </View>
      <View style={styles.labels}>
        <Text variant="titleSmall" style={[textStyles.start, { color: theme.colors.onSurface }]}>{title}</Text>
        <Text variant="bodySmall" style={[textStyles.start, { color: theme.colors.onSurfaceVariant }]}>{summary}</Text>
      </View>
      <MaterialCommunityIcons name={I18nManager.isRTL ? 'chevron-left' : 'chevron-right'} size={24}
        color={theme.colors.onSurfaceVariant} importantForAccessibility="no" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: size.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.gap,
    paddingHorizontal: spacing.compactInner,
    paddingVertical: spacing.gap,
    borderRadius: radius.card,
    borderWidth: 1
  },
  icon: { width: 36, height: 36, borderRadius: radius.card, alignItems: 'center', justifyContent: 'center' },
  labels: { flex: 1, minWidth: 0, gap: spacing.tinyGap }
});
