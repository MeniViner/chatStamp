import type { PipelineStage } from '../types/media';

export const wizardSteps: PipelineStage[] = [
  'welcome',
  'selectFiles',
  'saving'
];

export function getWizardStepIndex(stage: PipelineStage): number {
  if (stage === 'analyzing') return 0;
  if (stage === 'results') return 2;
  const index = wizardSteps.indexOf(stage);
  return index >= 0 ? index : 0;
}

export function getPreviousWizardStage(stage: PipelineStage): PipelineStage | undefined {
  if (stage === 'selectFiles') return 'welcome';
  if (stage === 'settings') return 'welcome';
  if (stage === 'history') return 'welcome';
  return undefined;
}

export function canGoBackInWizard(stage: PipelineStage): boolean {
  return Boolean(getPreviousWizardStage(stage));
}
