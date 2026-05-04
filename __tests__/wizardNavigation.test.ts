import { describe, expect, it } from 'vitest';
import { canGoBackInWizard, getPreviousWizardStage, getWizardStepIndex } from '../src/screens/wizardNavigation';

describe('wizardNavigation', () => {
  it('maps wizard step indexes', () => {
    expect(getWizardStepIndex('welcome')).toBe(0);
    expect(getWizardStepIndex('results')).toBe(5);
    expect(getWizardStepIndex('error')).toBe(0);
  });

  it('uses safe back behavior for editable steps', () => {
    expect(getPreviousWizardStage('selectFiles')).toBe('welcome');
    expect(getPreviousWizardStage('outputOptions')).toBe('selectFiles');
    expect(getPreviousWizardStage('reviewSave')).toBeUndefined();
    expect(canGoBackInWizard('saving')).toBe(false);
    expect(canGoBackInWizard('results')).toBe(false);
  });
});
