import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Appbar, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { usePipelineStore } from '../store/pipelineStore';
import { chooseZip } from '../services/operationCoordinator';
import { useAppTheme } from '../theme/useAppTheme';
import { PrimaryButton, textStyles } from '../components/AppUi';
import { WizardScreen } from './WizardScreen';
import { spacing } from '../theme/designTokens';

export function ImportScreen() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const openOverlay = usePipelineStore((state) => state.openOverlayStage);
  return <WizardScreen stage="welcome" title={t('import.title')}
    actions={<>
      <Appbar.Action icon="history" accessibilityLabel={t('history.title')} onPress={() => openOverlay('history')} />
      <Appbar.Action icon="cog-outline" accessibilityLabel={t('settings.title')} onPress={() => openOverlay('settings')} />
    </>}
    footer={<PrimaryButton icon="folder-zip-outline" onPress={() => { void chooseZip(); }}>{t('import.chooseZip')}</PrimaryButton>}>
    <ScrollView contentContainerStyle={styles.content}>
      <MaterialCommunityIcons name="calendar-clock-outline" size={64} color={theme.colors.primary} />
      <Text variant="headlineMedium" style={[styles.title, textStyles.start]}>{t('import.heroTitle')}</Text>
      <Text variant="bodyLarge" style={textStyles.start}>{t('import.heroBody')}</Text>
      <Text variant="bodyMedium" style={[textStyles.start, { color: theme.colors.onSurfaceVariant }]}>{t('import.subtitle')}</Text>
      <Text variant="bodySmall" style={[textStyles.start, { color: theme.colors.onSurfaceVariant }]}>{t('import.infoLocalBody')}</Text>
    </ScrollView>
  </WizardScreen>;
}
const styles = StyleSheet.create({ content: { gap: spacing.section, paddingVertical: spacing.section }, title: { fontWeight: '800' } });
