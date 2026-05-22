import React from 'react';
import { AppState } from 'react-native';
import { ImportScreen } from './ImportScreen';
import { FileSelectionScreen } from './FileSelectionScreen';
import { OutputFolderScreen } from './OutputFolderScreen';
import { ProcessingScreen } from './ProcessingScreen';
import { DoneScreen } from './DoneScreen';
import { ErrorScreen } from './ErrorScreen';
import { SettingsScreen } from './SettingsScreen';
import { HistoryScreen } from './HistoryScreen';
import { usePipelineStore } from '../store/pipelineStore';
import { getPendingSharedZip, getShareIntentDebugStatus } from '../native/shareIntent';
import { importWhatsAppZip } from '../services/importService';
import { logger } from '../lib/logger';
import i18n from '../i18n';

export function AppNavigator() {
  const stage = usePipelineStore((state) => state.stage);
  useGlobalSharedZipImport();

  if (stage === 'selectFiles') return <FileSelectionScreen />;
  if (stage === 'outputOptions') return <OutputFolderScreen />;
  if (stage === 'analyzing' || stage === 'saving') {
    return <ProcessingScreen />;
  }
  if (stage === 'results') return <DoneScreen />;
  if (stage === 'settings') return <SettingsScreen />;
  if (stage === 'history') return <HistoryScreen />;
  if (stage === 'error') return <ErrorScreen />;

  return <ImportScreen />;
}

function useGlobalSharedZipImport() {
  const stage = usePipelineStore((state) => state.stage);
  const setZip = usePipelineStore((state) => state.setZip);
  const setStage = usePipelineStore((state) => state.setStage);
  const setProgress = usePipelineStore((state) => state.setProgress);
  const setImportResult = usePipelineStore((state) => state.setImportResult);
  const setError = usePipelineStore((state) => state.setError);
  const importingRef = React.useRef(false);
  const sharePollingDisabledRef = React.useRef(false);
  const lastInvalidShareKeyRef = React.useRef<string | null>(null);
  const stageRef = React.useRef(stage);

  React.useEffect(() => {
    stageRef.current = stage;
  }, [stage]);

  const consumePendingShare = React.useCallback(async (reason: string) => {
    if (sharePollingDisabledRef.current) return;
    if (importingRef.current || stageRef.current === 'analyzing' || stageRef.current === 'saving') return;
    importingRef.current = true;
    try {
      const sharedZip = await getPendingSharedZip();
      if (!sharedZip.received) {
        if (__DEV__ && reason === 'startup') {
          const status = await getShareIntentDebugStatus();
          logger.debug('shareIntentDebugStatus', status);
        }
        return;
      }

      if (!sharedZip.copiedUri) {
        logger.warn('shareIntentReceivedButInvalid', sharedZip);
        const invalidShareKey = [
          sharedZip.sourceAction,
          sharedZip.sourceUri,
          sharedZip.filename,
          sharedZip.mimeType,
          sharedZip.error
        ].join('|');
        if (lastInvalidShareKeyRef.current === invalidShareKey) return;
        lastInvalidShareKeyRef.current = invalidShareKey;
        setError(sharedZip.error ?? i18n.t('import.sharedFileCouldNotOpen'));
        return;
      }

      lastInvalidShareKeyRef.current = null;
      logger.debug('shareIntentConsumedByJS', sharedZip);
      const name = sharedZip.filename ?? 'shared-whatsapp-export.zip';
      setZip({ uri: sharedZip.copiedUri, name });
      setStage('analyzing');
      setProgress({ stageLabel: 'ZIP received from Android share sheet', processed: 0, total: 7, failed: 0 });
      const importResult = await importWhatsAppZip({
        zipUri: sharedZip.copiedUri,
        zipName: name,
        onProgress: setProgress
      });
      setImportResult({
        workingDirectory: importResult.workingDirectory,
        mediaFiles: importResult.mediaFiles,
        importSummary: importResult.importSummary
      });
    } catch (error) {
      logger.error('Share intent handling failed', error);
      if (error instanceof Error && error.message.includes('ChatStampNative is not available')) {
        sharePollingDisabledRef.current = true;
        logger.warn('Share intent polling disabled because the native module is unavailable.');
        return;
      }
      setError(error instanceof Error ? error.message : i18n.t('import.sharedZipFailed'));
    } finally {
      importingRef.current = false;
    }
  }, [setError, setImportResult, setProgress, setStage, setZip]);

  React.useEffect(() => {
    void consumePendingShare('startup');
  }, [consumePendingShare]);

  React.useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') void consumePendingShare('active');
    });
    const interval = setInterval(() => {
      void consumePendingShare('poll');
    }, 1500);
    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, [consumePendingShare]);
}
