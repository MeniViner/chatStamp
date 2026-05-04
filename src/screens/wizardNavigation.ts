import type { PipelineStage } from '../types/media';

export const wizardSteps: PipelineStage[] = [
  'welcome',
  'analyzing',
  'selectFiles',
  'outputOptions',
  'saving',
  'results'
];

export function getWizardStepIndex(stage: PipelineStage): number {
  const index = wizardSteps.indexOf(stage);
  return index >= 0 ? index : 0;
}

export function getPreviousWizardStage(stage: PipelineStage): PipelineStage | undefined {
  if (stage === 'selectFiles') return 'welcome';
  if (stage === 'outputOptions') return 'selectFiles';
  if (stage === 'settings') return 'welcome';
  if (stage === 'history') return 'welcome';
  return undefined;
}

export function canGoBackInWizard(stage: PipelineStage): boolean {
  return Boolean(getPreviousWizardStage(stage));
}
