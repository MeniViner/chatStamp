import React from 'react';
import type { AppLayoutDirection } from './index';

const AppLayoutDirectionContext = React.createContext<AppLayoutDirection>('ltr');

export function AppLayoutDirectionProvider({
  direction,
  children
}: {
  direction: AppLayoutDirection;
  children: React.ReactNode;
}) {
  return <AppLayoutDirectionContext.Provider value={direction}>{children}</AppLayoutDirectionContext.Provider>;
}

export function useAppLayoutDirection(): AppLayoutDirection {
  return React.useContext(AppLayoutDirectionContext);
}

export function useIsAppRtl(): boolean {
  return useAppLayoutDirection() === 'rtl';
}
