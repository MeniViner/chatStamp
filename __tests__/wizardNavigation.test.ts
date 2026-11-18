import { describe, expect, it } from 'vitest';
import { canGoBackInWizard, getPreviousWizardStage, getWizardStepIndex, wizardSteps } from '../src/screens/wizardNavigation';

describe('wizardNavigation', () => {
  it('maps wizard step indexes', () => {
    expect(wizardSteps).toEqual(['welcome', 'selectFiles', 'saving']);
    expect(getWizardStepIndex('welcome')).toBe(0);
    expect(getWizardStepIndex('analyzing')).toBe(0);
    expect(getWizardStepIndex('selectFiles')).toBe(1);
    expect(getWizardStepIndex('saving')).toBe(2);
    expect(getWizardStepIndex('results')).toBe(2);
    expect(getWizardStepIndex('error')).toBe(0);
  });

  it('uses safe back behavior for editable steps', () => {
    expect(getPreviousWizardStage('selectFiles')).toBe('welcome');
    expect(getPreviousWizardStage('outputOptions')).toBeUndefined();
    expect(getPreviousWizardStage('reviewSave')).toBeUndefined();
    expect(canGoBackInWizard('saving')).toBe(false);
    expect(canGoBackInWizard('results')).toBe(false);
  });
});
