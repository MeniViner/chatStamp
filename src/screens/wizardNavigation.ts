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
