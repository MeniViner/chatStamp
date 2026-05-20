import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { Surface, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../theme/useAppTheme';
import type { PipelineStage } from '../types/media';
import { getWizardStepIndex, wizardSteps } from './wizardNavigation';
import { appTypography, size, spacing } from '../theme/designTokens';
import { AppScreenScaffold } from '../components/AppUi';

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
  const { t } = useTranslation();
  const stepIndex = getWizardStepIndex(stage);
  const progress = (stepIndex + 1) / wizardSteps.length;
  const isWizardStage = wizardSteps.includes(stage);

  return (
    <AppScreenScaffold
      title={title}
      subtitle={subtitle}
      stepLabel={isWizardStage ? t('common.stepOf', { current: Math.min(stepIndex + 1, wizardSteps.length), total: wizardSteps.length }) : undefined}
      progress={progress}
      showProgress={isWizardStage}
      onBack={onBack}
      backDisabled={backDisabled}
      actions={actions}
      footer={footer}
      contentStyle={contentStyle}
    >
      {children}
    </AppScreenScaffold>
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
  appbar: {
    height: 48,
    paddingHorizontal: 8
  },
  appbarSpacer: {
    flex: 1
  },
  progress: {
    height: 3
  },
  rtlProgress: {
    transform: [{ scaleX: -1 }]
  },
  header: {
    paddingHorizontal: spacing.screenHorizontal,
    paddingTop: spacing.smallGap,
    paddingBottom: spacing.card,
    gap: spacing.smallGap
  },
  screenTitle: {
    ...appTypography.screenTitle,
    letterSpacing: 0
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.screenHorizontal,
    paddingTop: spacing.tinyGap
  },
  footer: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    paddingHorizontal: spacing.screenHorizontal,
    paddingTop: spacing.compactInner,
    minHeight: size.stickyFooterMinHeight
  },
  footerActions: {
    gap: spacing.smallGap
  },
  metricCard: {
    flex: 1,
    minWidth: 136,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    padding: 14,
    gap: 4
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
    marginBottom: spacing.card
  },
  fullBleedList: {
    marginHorizontal: -spacing.screenHorizontal
  },
  stepPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6
  },
  subtitle: {
    ...appTypography.secondaryBody
  }
});

export const wizardStyles = styles;
