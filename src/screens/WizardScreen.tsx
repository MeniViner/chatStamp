import React from 'react';
import { StatusBar, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Appbar, ProgressBar, Surface, Text } from 'react-native-paper';
import { useAppTheme } from '../theme/useAppTheme';
import type { PipelineStage } from '../types/media';
import { getWizardStepIndex, wizardSteps } from './wizardNavigation';

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
      <ProgressBar progress={progress} color={theme.colors.primary} style={styles.progress} />
      <View style={[styles.header, { borderBottomColor: theme.colors.outlineVariant }]}>
        <View style={[styles.stepPill, { backgroundColor: theme.colors.secondaryContainer }]}>
          <Text variant="labelSmall" style={[styles.tabular, { color: theme.colors.onSecondaryContainer }]}>
            {Math.min(stepIndex + 1, wizardSteps.length)}/{wizardSteps.length}
          </Text>
        </View>
        {subtitle ? (
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
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
    fontWeight: '700',
    fontSize: 18,
    letterSpacing: 0
  },
  appbar: {
    height: 52,
    paddingHorizontal: 2
  },
  progress: {
    height: 2
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 5,
    paddingBottom: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 5,
    minHeight: 36
  },
  title: {
    fontWeight: '700',
    letterSpacing: 0
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8
  },
  footer: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    paddingHorizontal: 16,
    paddingTop: 8
  },
  footerActions: {
    gap: 7
  },
  metricCard: {
    flex: 1,
    minWidth: 136,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 14,
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
    marginHorizontal: -16
  },
  stepPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2
  }
});

export const wizardStyles = styles;
