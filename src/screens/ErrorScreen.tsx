import React from 'react';
import { AppState, Linking, View } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';
import { usePipelineStore } from '../store/pipelineStore';
import { clearWorkingDirectory } from '../services/importService';
import {
  galleryPermissionErrorMessage,
  getMediaPermissionStatus,
  requestMediaPermissionsStatus
} from '../services/mediaLibraryService';
import { getPermissionAction } from '../services/permissionLogic';
import { logger } from '../lib/logger';
import { screenStyles } from './screenStyles';

export function ErrorScreen() {
  const error = usePipelineStore((state) => state.error);
  const workingDirectory = usePipelineStore((state) => state.workingDirectory);
  const mediaFiles = usePipelineStore((state) => state.mediaFiles);
  const setError = usePipelineStore((state) => state.setError);
  const clearError = usePipelineStore((state) => state.clearError);
  const setStage = usePipelineStore((state) => state.setStage);
  const reset = usePipelineStore((state) => state.reset);
  const isPermissionError = Boolean(error?.includes('Gallery permission') || error?.includes('permission is missing'));

  const recheckPermissionAfterResume = React.useCallback(async () => {
    try {
      const status = await getMediaPermissionStatus();
      logger.debug('App resumed and permission rechecked', status);
      if (!status.granted) {
        setError(galleryPermissionErrorMessage);
      }
    } catch (permissionError) {
      logger.warn('Permission recheck after settings failed', permissionError);
    }
  }, [setError]);

  React.useEffect(() => {
    if (!isPermissionError) return;

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') return;
      void recheckPermissionAfterResume();
    });

    return () => subscription.remove();
  }, [isPermissionError, recheckPermissionAfterResume]);

  async function resetAndCleanUp() {
    await clearWorkingDirectory(workingDirectory);
    reset();
  }

  async function grantPermission() {
    try {
      const current = await getMediaPermissionStatus();
      const action = getPermissionAction(current);

      if (action === 'open-settings') {
        logger.debug('Settings opened', { reason: 'permission error screen', current });
        await Linking.openSettings();
        return;
      }

      const requested = action === 'request' ? await requestMediaPermissionsStatus() : current;
      if (!requested.granted) {
        setError(galleryPermissionErrorMessage);
        return;
      }

      clearError();
      setStage(mediaFiles.length > 0 ? 'summary' : 'welcome');
    } catch (permissionError) {
      logger.error('Grant permission retry failed', permissionError);
      setError(permissionError instanceof Error ? permissionError.message : galleryPermissionErrorMessage);
    }
  }

  return (
    <View style={screenStyles.container}>
      <Card>
        <Card.Content style={screenStyles.cardContent}>
          <Text variant="headlineSmall">Something went wrong</Text>
          {isPermissionError ? (
            <>
              <Text>Gallery permission is missing.</Text>
              <Text>The app needs it to save selected photos and videos to Android Gallery with corrected dates.</Text>
              <Button mode="contained" onPress={() => void grantPermission()}>
                Grant permission
              </Button>
            </>
          ) : (
            <Text>{error ?? 'Unknown error'}</Text>
          )}
          <Button mode="contained" onPress={resetAndCleanUp}>
            Reset
          </Button>
        </Card.Content>
      </Card>
    </View>
  );
}
