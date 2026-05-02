import React, { useCallback, useEffect } from 'react';
import { AppState, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import * as DocumentPicker from 'expo-document-picker';
import { usePipelineStore } from '../store/pipelineStore';
import { importWhatsAppZip } from '../services/importService';
import { logger } from '../lib/logger';
import {
  getMediaPermissionStatus,
  type GalleryPermissionStatus
} from '../services/mediaLibraryService';
import { screenStyles } from './screenStyles';

export function ImportScreen() {
  const setZip = usePipelineStore((state) => state.setZip);
  const setStage = usePipelineStore((state) => state.setStage);
  const setProgress = usePipelineStore((state) => state.setProgress);
  const setImportResult = usePipelineStore((state) => state.setImportResult);
  const setError = usePipelineStore((state) => state.setError);
  const [permissionStatus, setPermissionStatus] = React.useState<GalleryPermissionStatus | undefined>();

  const importZip = useCallback(async (uri: string, name: string) => {
    setZip({ uri, name });
    setStage('analyzing');

    const importResult = await importWhatsAppZip({
      zipUri: uri,
      zipName: name,
      onProgress: setProgress
    });

    setImportResult({
      workingDirectory: importResult.workingDirectory,
      mediaFiles: importResult.mediaFiles,
      importSummary: importResult.importSummary
    });
  }, [setImportResult, setProgress, setStage, setZip]);

  const refreshPermissionStatus = useCallback(async (reason: string) => {
    try {
      const status = await getMediaPermissionStatus();
      logger.debug(reason, status);
      setPermissionStatus(status);
    } catch (error) {
      logger.warn('Could not read startup permission status', error);
    }
  }, []);

  useEffect(() => {
    void refreshPermissionStatus('Startup permission status');

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void refreshPermissionStatus('App resumed and permission rechecked');
      }
    });

    return () => subscription.remove();
  }, [refreshPermissionStatus]);

  async function pickZip() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/zip', 'application/x-zip-compressed', 'application/octet-stream'],
        copyToCacheDirectory: true,
        multiple: false
      });
      logger.debug('Document picker result', result);

      if (result.canceled) return;

      const asset = result.assets[0];
      await importZip(asset.uri, asset.name);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Import failed.');
    }
  }

  return (
    <View style={screenStyles.container}>
      <Text variant="headlineMedium">WhatsApp Media TimeFixer</Text>
      <Text variant="bodyLarge">
        Import a WhatsApp chat export ZIP, choose photos and videos, and save them to Gallery using their original chat dates.
      </Text>
      <Text variant="bodyMedium">Choose a ZIP here, or share the ZIP directly from WhatsApp to this app.</Text>
      <Text variant="titleMedium">Gallery access</Text>
      <Text variant="bodyMedium">{getPermissionLabel(permissionStatus)}</Text>
      <Button mode="contained" onPress={pickZip}>
        Choose WhatsApp ZIP
      </Button>
    </View>
  );
}

function getPermissionLabel(status?: GalleryPermissionStatus): string {
  if (!status) return 'Checking Android media permission status for diagnostics...';
  if (status.granted) return 'Read permission is granted, but saving new files does not depend on it.';
  return 'No broad Gallery read permission is required for saving new files created by this app.';
}
