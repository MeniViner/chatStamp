import { type MD3Theme, useTheme } from 'react-native-paper';
import type { AppThemeMetadata } from './dynamicColors';

export type AppTheme = MD3Theme & {
  metadata?: AppThemeMetadata;
  colors: MD3Theme['colors'] & {
    surfaceContainer?: string;
    surfaceContainerLow?: string;
    surfaceContainerLowest?: string;
    surfaceContainerHigh?: string;
    surfaceContainerHighest?: string;
  };
};

export const useAppTheme = useTheme<AppTheme>;
