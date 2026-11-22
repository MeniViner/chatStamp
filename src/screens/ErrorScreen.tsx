import React from 'react';
import { BackHandler, ScrollView, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { usePipelineStore } from '../store/pipelineStore';
import { getChatStampNativeModule } from '../native/chatStampNativeModule';
import { beginImport, chooseZip, discardImport } from '../services/operationCoordinator';
import { errorMessageKey, isRetryAllowed } from '../lib/pipelineErrors';
import { FooterActions, WizardScreen } from './WizardScreen';
import { InfoBanner, PrimaryButton, SecondaryButton, textStyles } from '../components/AppUi';
import { spacing } from '../theme/designTokens';

export function ErrorScreen() {
  const { t } = useTranslation();
  const error = usePipelineStore((state) => state.error);
  const source = usePipelineStore((state) => state.zipUri);
  const name = usePipelineStore((state) => state.zipName);
  const openSettings = usePipelineStore((state) => state.openOverlayStage);
  const [readable, setReadable] = React.useState(false);
  const [recoveryFailed, setRecoveryFailed] = React.useState(false);
  const back = React.useCallback(() => {
    void discardImport().catch(() => setRecoveryFailed(true));
    return true;
  }, []);
  React.useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', back);
    return () => listener.remove();
  }, [back]);
  React.useEffect(() => {
    let alive = true;
    setReadable(false);
    if (source) void getChatStampNativeModule().canReadSourceAsync(source).then((value) => {
      if (alive) setReadable(value);
    }).catch(() => { if (alive) setReadable(false); });
    return () => { alive = false; };
  }, [source, error]);
  const code = error?.code ?? 'IO_ERROR';
  const retry = Boolean(source && isRetryAllowed(code, readable));
  return <WizardScreen stage="error" title={t('error.parsingTitle')} onBack={back}
    footer={<FooterActions>
      {source && retry ? <PrimaryButton onPress={() => { void beginImport(source, name ?? t('import.sharedExportName')); }}>
        {t('session.retry')}</PrimaryButton> : null}
      {retry ? <SecondaryButton onPress={() => { void chooseZip(); }}>{t('session.chooseAnother')}</SecondaryButton>
        : <PrimaryButton onPress={() => { void chooseZip(); }}>{t('session.chooseAnother')}</PrimaryButton>}
      {code === 'PERMISSION_LOST' ? <SecondaryButton onPress={() => openSettings('settings')}>{t('settings.title')}</SecondaryButton> : null}
    </FooterActions>}>
    <ScrollView contentContainerStyle={styles.content}>
      <InfoBanner icon="alert-circle-outline" tone="error" body={t(errorMessageKey(code))}>
        {error?.missingBytes ? <Text variant="bodyMedium" style={textStyles.start}>
          {t('session.spaceMissing', { bytes: Math.ceil(error.missingBytes / 1048576) })}</Text> : null}
      </InfoBanner>
      {recoveryFailed ? <Text accessibilityRole="alert" style={textStyles.start}>{t('error.recoveryFailed')}</Text> : null}
    </ScrollView>
  </WizardScreen>;
}

const styles = StyleSheet.create({ content: { gap: spacing.card } });
