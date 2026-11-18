import React from 'react';
import { Snackbar } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from './ConfirmDialog';
import { useLanguageRestartStore } from '../store/languageRestartStore';
import { awaitSettingsPersistence } from '../store/settingsStore';
import { usePipelineStore } from '../store/pipelineStore';
import { discardImport, pendingSharedZip, reserveAppRestart } from '../services/operationCoordinator';
import { getChatStampNativeModule } from '../native/chatStampNativeModule';
import { awaitMediaRelease } from '../native/mediaPreviews';
import { restartAppForLanguage } from '../native/appReload';
import { isTerminalProgress } from '../lib/operationProgress';

export function LanguageRestartPrompt() {
  const { t } = useTranslation();
  const promptOpen = useLanguageRestartStore((state) => state.promptOpen);
  const dismiss = useLanguageRestartStore((state) => state.dismiss);
  const stage = usePipelineStore((state) => state.stage);
  const [discardOpen, setDiscardOpen] = React.useState(false);
  const [error, setError] = React.useState(false);
  const [committed, setCommitted] = React.useState(false);
  const running = React.useRef(false);
  const resumeIntake = React.useRef<(() => void) | null>(null);
  const later = () => { if (running.current) return; resumeIntake.current?.(); resumeIntake.current = null; dismiss(); };
  const busy = stage === 'analyzing' || stage === 'saving';
  async function restart(discardConfirmed = false) {
    if (running.current || busy) return;
    const state = usePipelineStore.getState();
    if (state.workingDirectory && !discardConfirmed) {
      dismiss(); setDiscardOpen(true); return;
    }
    running.current = true; setCommitted(true); setError(false);
    try {
      resumeIntake.current = await reserveAppRestart();
      await awaitSettingsPersistence();
      const current = usePipelineStore.getState();
      const native = getChatStampNativeModule();
      const snapshot = await native.getOperationSnapshotAsync();
      if (current.stage === 'analyzing' || current.stage === 'saving' || pendingSharedZip()
        || (snapshot && !isTerminalProgress(snapshot.progress))) {
        throw new Error('Operation must finish before restarting');
      }
      // discardImport also requires durable terminal-save history before resetting.
      await discardImport();
      await awaitMediaRelease();
      await restartAppForLanguage();
    } catch {
      resumeIntake.current?.(); resumeIntake.current = null;
      running.current = false; setCommitted(false); setDiscardOpen(false); setError(true);
    }
  }
  return <>
    <ConfirmDialog visible={promptOpen && !busy} busy={committed} title={t('languageRestart.title')} body={t('languageRestart.body')}
      confirmLabel={t('languageRestart.now')} cancelLabel={t('languageRestart.later')}
      onConfirm={() => { void restart(); }} onDismiss={later} />
    <ConfirmDialog visible={discardOpen} busy={committed} title={t('languageRestart.discardTitle')} body={t('session.discardBody')}
      confirmLabel={t('languageRestart.now')} cancelLabel={t('common.cancel')}
      onConfirm={() => { void restart(true); }} onDismiss={() => { if (!running.current) setDiscardOpen(false); }} />
    <Snackbar visible={error} onDismiss={() => setError(false)} action={{ label: t('common.tryAgain'), onPress: () => { void restart(); } }}>
      {t('languageRestart.failed')}
    </Snackbar>
  </>;
}
