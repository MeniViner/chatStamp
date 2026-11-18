import React, { useEffect, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { ImportScreen } from './ImportScreen';
import { FileSelectionScreen } from './FileSelectionScreen';
import { OutputFolderScreen } from './OutputFolderScreen';
import { ProcessingScreen } from './ProcessingScreen';
import { DoneScreen } from './DoneScreen';
import { ErrorScreen } from './ErrorScreen';
import { SettingsScreen } from './SettingsScreen';
import { HistoryScreen } from './HistoryScreen';
import { usePipelineStore } from '../store/pipelineStore';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { acceptSharedZip, attachPipelineRuntime, dismissSharedZip, observePendingShare, pendingSharedZip } from '../services/operationCoordinator';

export function AppNavigator() {
  const { t } = useTranslation();
  const stage = usePipelineStore((state) => state.stage);
  const incoming = useSyncExternalStore(observePendingShare, pendingSharedZip, pendingSharedZip);
  useEffect(attachPipelineRuntime, []);
  const screen = stage === 'selectFiles' ? <FileSelectionScreen />
    : stage === 'outputOptions' ? <OutputFolderScreen />
    : stage === 'analyzing' || stage === 'saving' ? <ProcessingScreen />
    : stage === 'results' ? <DoneScreen />
    : stage === 'settings' ? <SettingsScreen />
    : stage === 'history' ? <HistoryScreen />
    : stage === 'error' ? <ErrorScreen /> : <ImportScreen />;
  return <>
    {screen}
    <ConfirmDialog visible={Boolean(incoming)} title={t('session.replaceTitle')} body={t('session.replaceBody')}
      confirmLabel={t('session.replace')} cancelLabel={t('common.cancel')}
      onConfirm={() => { void acceptSharedZip(); }} onDismiss={() => { void dismissSharedZip(); }} />
  </>;
}
