import React, { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Font from 'expo-font';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';
import { AppNavigator } from './src/screens/AppNavigator';
import { appTheme } from './src/theme/theme';
import { logger } from './src/lib/logger';

type AppAssetState = 'loading' | 'ready' | 'failed';

export default function App() {
  const [assetState, setAssetState] = React.useState<AppAssetState>('loading');
  const [assetError, setAssetError] = React.useState<string | undefined>();

  const loadRequiredAssets = React.useCallback(async () => {
    setAssetState('loading');
    setAssetError(undefined);

    try {
      logger.debug('Font/icon asset loading start', {
        dev: __DEV__,
        metroHint: __DEV__ ? 'If Android cannot reach Metro, run adb reverse tcp:8081 tcp:8081.' : 'production'
      });
      await Font.loadAsync({
        ...MaterialCommunityIcons.font,
        ...MaterialIcons.font
      });
      logger.debug('Font/icon asset loading success');
      setAssetState('ready');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown font loading error';
      logger.error('Font/icon asset loading failure', { message });
      setAssetError(message);
      setAssetState('failed');
    }
  }, []);

  useEffect(() => {
    logger.debug('App startup', { dev: __DEV__ });
    void loadRequiredAssets();
  }, [loadRequiredAssets]);

  if (assetState !== 'ready') {
    return (
      <SafeAreaProvider>
        <View style={bootstrapStyles.container}>
          {assetState === 'loading' ? (
            <>
              <ActivityIndicator size="large" />
              <Text style={bootstrapStyles.title}>Loading app assets</Text>
            </>
          ) : (
            <>
              <Text style={bootstrapStyles.title}>Required icon font failed to load.</Text>
              {__DEV__ ? <Text style={bootstrapStyles.body}>{assetError}</Text> : null}
              {__DEV__ ? (
                <Text style={bootstrapStyles.body}>For a USB-connected Android device, run adb reverse tcp:8081 tcp:8081.</Text>
              ) : null}
              <Pressable style={bootstrapStyles.button} onPress={() => void loadRequiredAssets()}>
                <Text style={bootstrapStyles.buttonText}>Try again</Text>
              </Pressable>
            </>
          )}
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <PaperProvider theme={appTheme}>
        <AppNavigator />
      </PaperProvider>
    </SafeAreaProvider>
  );
}

const bootstrapStyles = StyleSheet.create({
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
