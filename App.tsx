import React, { useEffect } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Font from 'expo-font';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/screens/AppNavigator';
import { OnboardingFlow } from './src/screens/onboarding/OnboardingFlow';
import { AppThemeProvider } from './src/theme/theme';
import { logger } from './src/lib/logger';
import { useSettingsStore } from './src/store/settingsStore';
import { useHistoryStore } from './src/store/historyStore';
import { useOnboardingStore } from './src/store/onboardingStore';
import { useTranslation } from 'react-i18next';
import { onRtlLayoutChange, syncI18nLanguage } from './src/i18n';

type AppAssetState = 'loading' | 'ready' | 'failed';

export default function App() {
  const { t } = useTranslation();
  const [assetState, setAssetState] = React.useState<AppAssetState>('loading');
  const [assetError, setAssetError] = React.useState<string | undefined>();
  const loadSettings = useSettingsStore((state) => state.loadSettings);
  const onboardingCompleted = useSettingsStore((state) => state.settings.onboardingCompleted);
  const developerMode = useSettingsStore((state) => state.settings.developerMode);
  const loadHistory = useHistoryStore((state) => state.loadHistory);
  const replayRequested = useOnboardingStore((state) => state.replayRequested);
  const [rtlRefreshKey, setRtlRefreshKey] = React.useState(0);

  useEffect(() => {
    logger.setDebugEnabled(developerMode);
  }, [developerMode]);

  const loadRequiredAssets = React.useCallback(async () => {
    setAssetState('loading');
    setAssetError(undefined);

    try {
      logger.debug('Font/icon asset loading start', {
        dev: __DEV__,
        metroHint: __DEV__ ? 'If Android cannot reach Metro, run adb reverse tcp:8081 tcp:8081.' : 'production'
      });
      await Promise.all([
        Font.loadAsync({
          ...MaterialCommunityIcons.font,
          ...MaterialIcons.font
        }),
        loadSettings()
      ]);
      await syncI18nLanguage(useSettingsStore.getState().settings.languagePreference);
      await loadHistory();
      logger.debug('Font/icon asset loading success');
      setAssetState('ready');
    } catch (error) {
      const message = error instanceof Error ? error.message : t('bootstrap.unknownLoadError');
      logger.error('Font/icon asset loading failure', { message });
      setAssetError(message);
      setAssetState('failed');
    }
  }, [loadHistory, loadSettings, t]);

  useEffect(() => {
    logger.debug('App startup', { dev: __DEV__ });
    void loadRequiredAssets();
  }, [loadRequiredAssets]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void syncI18nLanguage(useSettingsStore.getState().settings.languagePreference);
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    return onRtlLayoutChange(() => {
      setRtlRefreshKey((current) => current + 1);
    });
  }, []);

  if (assetState !== 'ready') {
    return (
      <SafeAreaProvider>
        <View style={styles.container}>
          {assetState === 'loading' ? (
            <>
              <ActivityIndicator size="large" />
              <Text style={styles.title}>{t('bootstrap.loading')}</Text>
            </>
          ) : (
            <>
              <Text style={styles.title}>{t('bootstrap.assetLoadFailed')}</Text>
              {__DEV__ ? <Text style={styles.body}>{assetError}</Text> : null}
              {__DEV__ ? (
                <Text style={styles.body}>{t('bootstrap.adbHint')}</Text>
              ) : null}
              <Pressable style={styles.button} onPress={() => void loadRequiredAssets()}>
                <Text style={styles.buttonText}>{t('common.tryAgain')}</Text>
              </Pressable>
            </>
          )}
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <View key={`rtl-layout-${rtlRefreshKey}`} style={styles.appRoot}>
        <AppThemeProvider>
          {!onboardingCompleted || replayRequested ? <OnboardingFlow /> : <AppNavigator />}
        </AppThemeProvider>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  appRoot: {
    flex: 1
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 12,
    backgroundColor: '#f8fafc'
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a'
  },
  body: {
    fontSize: 15,
    color: '#334155'
  },
  button: {
    marginTop: 8,
    alignSelf: 'flex-start',
    borderRadius: 8,
    backgroundColor: '#0f766e',
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '700'
  }
});
