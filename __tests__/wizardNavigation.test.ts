import { describe, expect, it } from 'vitest';
import { getWizardStepIndex, wizardSteps } from '../src/screens/wizardNavigation';

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

});
