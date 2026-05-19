import React from 'react';
import { I18nManager, StatusBar, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Appbar, ProgressBar, Surface, Text } from 'react-native-paper';
import { useAppTheme } from '../theme/useAppTheme';
import type { PipelineStage } from '../types/media';
import { getWizardStepIndex, wizardSteps } from './wizardNavigation';
import { appTypography, size, spacing } from '../theme/designTokens';
import { textStyles } from '../components/AppUi';

type WizardScreenProps = {
  stage: PipelineStage;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onBack?: () => void;
  backDisabled?: boolean;
  actions?: React.ReactNode;
  scroll?: false;
  contentStyle?: ViewStyle;
};

export function WizardScreen({
  stage,
  title,
  subtitle,
  children,
  footer,
  onBack,
  backDisabled,
  actions,
  contentStyle
}: WizardScreenProps) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const stepIndex = getWizardStepIndex(stage);
  const progress = (stepIndex + 1) / wizardSteps.length;
  const statusBarStyle = theme.dark ? 'light-content' : 'dark-content';

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <StatusBar translucent backgroundColor="transparent" barStyle={statusBarStyle} />
      <Appbar.Header mode="small" elevated={false} statusBarHeight={0} style={[styles.appbar, { backgroundColor: theme.colors.background }]}>
        {onBack ? <Appbar.BackAction disabled={backDisabled} onPress={onBack} /> : null}
        <Appbar.Content title={title} titleStyle={styles.appbarTitle} />
        {actions}
      </Appbar.Header>
      <ProgressBar progress={progress} color={theme.colors.primary} style={[styles.progress, I18nManager.isRTL ? styles.rtlProgress : null]} />
      <View style={[styles.header, { borderBottomColor: theme.colors.outlineVariant }]}>
        <View style={[styles.stepPill, { backgroundColor: theme.colors.secondaryContainer }]}>
          <Text variant="labelSmall" style={[styles.tabular, { color: theme.colors.onSecondaryContainer }]}>
            {Math.min(stepIndex + 1, wizardSteps.length)}/{wizardSteps.length}
          </Text>
        </View>
        {subtitle ? (
          <Text variant="bodyMedium" numberOfLines={3} style={[textStyles.start, styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={[styles.content, contentStyle]}>{children}</View>
      {footer ? (
        <Surface elevation={2} style={[styles.footer, { backgroundColor: theme.colors.surface, paddingBottom: Math.max(insets.bottom, 10) }]}>
          {footer}
        </Surface>
      ) : null}
    </SafeAreaView>
  );
}

export function FooterActions({ children }: { children: React.ReactNode }) {
  return <View style={styles.footerActions}>{children}</View>;
}

export function MetricCard({ label, value }: { label: string; value: string | number }) {
  const theme = useAppTheme();
  return (
    <Surface
      elevation={1}
      style={[
        styles.metricCard,
        {
          backgroundColor: theme.colors.surfaceContainerHigh ?? theme.colors.surfaceVariant,
          borderColor: theme.colors.outlineVariant
        }
      ]}
    >
      <Text variant="headlineSmall" style={styles.tabular}>
        {value}
      </Text>
      <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
        {label}
      </Text>
    </Surface>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1
  },
  appbarTitle: {
    ...appTypography.screenTitle,
    letterSpacing: 0,
    textAlign: 'auto',
    writingDirection: 'auto'
  },
  appbar: {
    height: 56,
    paddingHorizontal: 6
  },
  progress: {
    height: 3
  },
  rtlProgress: {
    transform: [{ scaleX: -1 }]
  },
  header: {
    paddingHorizontal: spacing.screenHorizontal,
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
    minHeight: 56
  },
  title: {
    fontWeight: '700',
    letterSpacing: 0
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.screenHorizontal,
    paddingTop: spacing.card
  },
  footer: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    paddingHorizontal: spacing.screenHorizontal,
    paddingTop: 8,
    minHeight: size.stickyFooterMinHeight
  },
  footerActions: {
    gap: 8
  },
  metricCard: {
    flex: 1,
    minWidth: 136,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 10,
    gap: 3
  },
  tabular: {
    fontVariant: ['tabular-nums'],
    fontWeight: '700'
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  section: {
    gap: 10,
    marginBottom: 18
  },
  fullBleedList: {
    marginHorizontal: -spacing.screenHorizontal
  },
  stepPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4
  },
  subtitle: {
    ...appTypography.secondaryBody
  }
});

export const wizardStyles = styles;
