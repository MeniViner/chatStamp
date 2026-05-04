import { describe, expect, it } from 'vitest';
import { getOnboardingPermissionVisualState } from '../src/screens/onboarding/onboardingLogic';

describe('onboarding permission visual state', () => {
  it('returns checking before access status is known', () => {
    expect(getOnboardingPermissionVisualState({ accessGranted: undefined, grantAttempted: false })).toBe('checking');
  });

  it('returns granted when Android access is already available', () => {
    expect(getOnboardingPermissionVisualState({ accessGranted: true, grantAttempted: false })).toBe('granted');
  });

  it('returns pending before the user tries to grant access', () => {
    expect(getOnboardingPermissionVisualState({ accessGranted: false, grantAttempted: false })).toBe('pending');
  });

  it('returns limited after the user tried to grant access but it is still unavailable', () => {
    expect(getOnboardingPermissionVisualState({ accessGranted: false, grantAttempted: true })).toBe('limited');
  });
});
