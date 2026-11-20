import React, { useEffect, useSyncExternalStore } from 'react';
import { View } from 'react-native';
import { Button, Dialog, Portal, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { ImportScreen } from './ImportScreen';
import { WhatsAppExportGuide } from './WhatsAppExportGuide';
import { FileSelectionScreen } from './FileSelectionScreen';
import { ProcessingScreen } from './ProcessingScreen';
import { DoneScreen } from './DoneScreen';
import { ErrorScreen } from './ErrorScreen';
import { SettingsScreen } from './SettingsScreen';
import { HistoryScreen } from './HistoryScreen';
import { usePipelineStore } from '../store/pipelineStore';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { textStyles } from '../components/AppUi';
import { errorMessageKey } from '../lib/pipelineErrors';
import { acceptSharedZip, attachPipelineRuntime, dismissSharedZip, observePendingShare, pendingSharedZip } from '../services/operationCoordinator';

export function AppNavigator() {
  const { t } = useTranslation();
  const stage = usePipelineStore((state) => state.stage);
  const returnStage = usePipelineStore((state) => state.overlayReturnStage);
  const overlay = stage === 'settings' || stage === 'history';
  const base = overlay ? returnStage ?? 'welcome' : stage;
  const [guideOpen, setGuideOpen] = React.useState(false);
  const closeGuide = React.useCallback(() => setGuideOpen(false), []);
  const openGuide = React.useCallback(() => {
    if (usePipelineStore.getState().stage === 'welcome') setGuideOpen(true);
  }, []);
  useEffect(() => { if (stage !== 'welcome') setGuideOpen(false); }, [stage]);
  const incoming = useSyncExternalStore(observePendingShare, pendingSharedZip, pendingSharedZip);
  const invalidShare = incoming && (incoming.errorCode || !incoming.sourceUri);
  useEffect(attachPipelineRuntime, []);
  const screen = base === 'selectFiles' ? <FileSelectionScreen />
    : base === 'analyzing' || base === 'saving' ? <ProcessingScreen />
    : base === 'results' ? <DoneScreen />
    : base === 'error' ? <ErrorScreen /> : guideOpen && stage === 'welcome'
      ? <WhatsAppExportGuide onClose={closeGuide} /> : <ImportScreen onOpenWhatsAppGuide={openGuide} />;
  return <>
    <View style={{ flex: 1, display: overlay ? 'none' : 'flex' }}>{screen}</View>
    {stage === 'settings' ? <SettingsScreen /> : stage === 'history' ? <HistoryScreen /> : null}
    {stage !== 'saving' && (invalidShare ? <Portal><Dialog visible onDismiss={() => { void dismissSharedZip(); }}>
      <Dialog.Title style={textStyles.start}>{t('session.shareUnavailableTitle')}</Dialog.Title>
      <Dialog.Content><Text accessibilityRole="alert" style={textStyles.start}>
        {t(incoming.errorCode ? errorMessageKey(incoming.errorCode) : 'error.codes.SHARE_INVALID')}
      </Text></Dialog.Content>
      <Dialog.Actions><Button contentStyle={{ minHeight: 48 }} onPress={() => { void dismissSharedZip(); }}>{t('common.close')}</Button></Dialog.Actions>
    </Dialog></Portal> : <ConfirmDialog visible={Boolean(incoming)} title={t('session.replaceTitle')} body={t('session.replaceBody')}
      confirmLabel={t('session.replace')} cancelLabel={t('common.cancel')}
      onConfirm={() => { void acceptSharedZip(); }} onDismiss={() => { void dismissSharedZip(); }} />)}
  </>;
}
