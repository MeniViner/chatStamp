import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { usePipelineStore } from '../store/pipelineStore';
import { getChatStampNativeModule } from '../native/chatStampNativeModule';
import { beginImport, chooseZip } from '../services/operationCoordinator';
import { errorMessageKey, isRetryAllowed } from '../lib/pipelineErrors';
import { FooterActions, WizardScreen } from './WizardScreen';
import { PremiumCard, PrimaryButton, SecondaryButton, textStyles } from '../components/AppUi';
import { spacing } from '../theme/designTokens';

export function ErrorScreen() {
  const { t } = useTranslation();
  const error = usePipelineStore((state) => state.error);
  const source = usePipelineStore((state) => state.zipUri);
  const name = usePipelineStore((state) => state.zipName);
  const openSettings = usePipelineStore((state) => state.openOverlayStage);
  const [readable, setReadable] = React.useState(false);
  React.useEffect(() => {
    let alive = true;
    setReadable(false);
    if (source) void getChatStampNativeModule().canReadSourceAsync(source).then((value) => {
      if (alive) setReadable(value);
    }).catch(() => { if (alive) setReadable(false); });
    return () => { alive = false; };
  }, [source, error]);
  const code = error?.code ?? 'IO_ERROR';
  return <WizardScreen stage="error" title={t('error.parsingTitle')}
    footer={<FooterActions>
      {source && isRetryAllowed(code, readable) ? <PrimaryButton onPress={() => { void beginImport(source, name ?? 'WhatsApp.zip'); }}>
        {t('session.retry')}</PrimaryButton> : null}
      <SecondaryButton onPress={() => { void chooseZip(); }}>{t('session.chooseAnother')}</SecondaryButton>
      {code === 'PERMISSION_LOST' ? <SecondaryButton onPress={() => openSettings('settings')}>{t('settings.title')}</SecondaryButton> : null}
    </FooterActions>}>
    <ScrollView contentContainerStyle={styles.content}><PremiumCard>
      <Text variant="bodyLarge" style={textStyles.start}>{t(errorMessageKey(code))}</Text>
      {error?.missingBytes ? <Text variant="bodyMedium" style={textStyles.start}>
        {t('session.spaceMissing', { bytes: Math.ceil(error.missingBytes / 1048576) })}</Text> : null}
    </PremiumCard></ScrollView>
  </WizardScreen>;
}

const styles = StyleSheet.create({ content: { gap: spacing.section } });
