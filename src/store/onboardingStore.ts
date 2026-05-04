import { create } from 'zustand';

type OnboardingState = {
  replayRequested: boolean;
  requestReplay: () => void;
  clearReplayRequest: () => void;
};

export const useOnboardingStore = create<OnboardingState>((set) => ({
  replayRequested: false,
  requestReplay: () => set({ replayRequested: true }),
  clearReplayRequest: () => set({ replayRequested: false })
}));
