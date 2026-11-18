import React, { useEffect, useSyncExternalStore } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ImportScreen } from './ImportScreen';
import { FileSelectionScreen } from './FileSelectionScreen';
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
  const returnStage = usePipelineStore((state) => state.overlayReturnStage);
  const overlay = stage === 'settings' || stage === 'history';
  const base = overlay ? returnStage ?? 'welcome' : stage;
  const incoming = useSyncExternalStore(observePendingShare, pendingSharedZip, pendingSharedZip);
  useEffect(attachPipelineRuntime, []);
  const screen = base === 'selectFiles' ? <FileSelectionScreen />
    : base === 'analyzing' || base === 'saving' ? <ProcessingScreen />
    : base === 'results' ? <DoneScreen />
    : base === 'error' ? <ErrorScreen /> : <ImportScreen />;
  return <>
    <View style={{ flex: 1, display: overlay ? 'none' : 'flex' }}>{screen}</View>
    {stage === 'settings' ? <SettingsScreen /> : stage === 'history' ? <HistoryScreen /> : null}
    <ConfirmDialog visible={Boolean(incoming)} title={t('session.replaceTitle')} body={t('session.replaceBody')}
      confirmLabel={t('session.replace')} cancelLabel={t('common.cancel')}
      onConfirm={() => { void acceptSharedZip(); }} onDismiss={() => { void dismissSharedZip(); }} />
  </>;
}
