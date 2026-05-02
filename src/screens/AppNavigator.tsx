import React from 'react';
import { AppState } from 'react-native';
import { ImportScreen } from './ImportScreen';
import { SummaryScreen } from './SummaryScreen';
import { FileSelectionScreen } from './FileSelectionScreen';
import { ReviewSaveScreen } from './ReviewSaveScreen';
import { ProcessingScreen } from './ProcessingScreen';
import { DoneScreen } from './DoneScreen';
import { ErrorScreen } from './ErrorScreen';
import { usePipelineStore } from '../store/pipelineStore';
import { getPendingSharedZip, getShareIntentDebugStatus } from '../native/shareIntent';
import { importWhatsAppZip } from '../services/importService';
import { logger } from '../lib/logger';

export function AppNavigator() {
  const stage = usePipelineStore((state) => state.stage);
  useGlobalSharedZipImport();

  if (stage === 'summary') return <SummaryScreen />;
  if (stage === 'selectFiles') return <FileSelectionScreen />;
  if (stage === 'reviewSave') return <ReviewSaveScreen />;
  if (stage === 'analyzing' || stage === 'saving') {
    return <ProcessingScreen />;
  }
  if (stage === 'results') return <DoneScreen />;
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

  const consumePendingShare = React.useCallback(async (reason: string) => {
    if (importingRef.current || stage === 'analyzing' || stage === 'saving') return;
    importingRef.current = true;
    try {
      const sharedZip = await getPendingSharedZip();
      if (!sharedZip.received) {
        if (__DEV__ && reason !== 'poll') {
          const status = await getShareIntentDebugStatus();
          logger.debug('shareIntentDebugStatus', status);
        }
        return;
      }

      if (!sharedZip.copiedUri) {
        logger.warn('shareIntentReceivedButInvalid', sharedZip);
        setError(sharedZip.error ?? 'The shared file could not be opened. Please select the ZIP from storage.');
        return;
      }

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
      setError(error instanceof Error ? error.message : 'Shared ZIP import failed.');
    } finally {
      importingRef.current = false;
    }
  }, [setError, setImportResult, setProgress, setStage, setZip, stage]);

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
