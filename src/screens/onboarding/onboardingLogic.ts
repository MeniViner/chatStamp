export type OnboardingPermissionVisualState = 'checking' | 'pending' | 'granted' | 'limited';

export function getOnboardingPermissionVisualState(options: {
  accessGranted?: boolean;
  grantAttempted: boolean;
}): OnboardingPermissionVisualState {
  if (typeof options.accessGranted !== 'boolean') return 'checking';
  if (options.accessGranted) return 'granted';
  return options.grantAttempted ? 'limited' : 'pending';
}

