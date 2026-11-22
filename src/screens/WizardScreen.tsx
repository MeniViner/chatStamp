import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { PipelineStage } from '../types/media';
import { getWizardStepIndex, wizardSteps } from './wizardNavigation';
import { spacing } from '../theme/designTokens';
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
  titleMode?: 'large' | 'compact';
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
  contentStyle,
  titleMode
}: WizardScreenProps) {
  const { t } = useTranslation();
  const stepIndex = getWizardStepIndex(stage);
  const progress = (stepIndex + 1) / wizardSteps.length;
  // Home is the starting point, not a numbered step.
  const isWizardStage = stage === 'analyzing' || stage === 'selectFiles' || stage === 'saving' || stage === 'results';

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
      titleMode={titleMode}
    >
      {children}
    </AppScreenScaffold>
  );
}

export function FooterActions({ children }: { children: React.ReactNode }) {
  return <View style={styles.footerActions}>{children}</View>;
}

const styles = StyleSheet.create({
  footerActions: {
    gap: spacing.smallGap
  }
});
