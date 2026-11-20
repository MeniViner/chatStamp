import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Appbar, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { usePipelineStore } from '../store/pipelineStore';
import { chooseZip } from '../services/operationCoordinator';
import { useAppTheme } from '../theme/useAppTheme';
import { PrimaryButton, SecondaryButton, textStyles } from '../components/AppUi';
import { WizardScreen } from './WizardScreen';
import { radius, spacing } from '../theme/designTokens';

export function ImportScreen({ onOpenWhatsAppGuide }: { onOpenWhatsAppGuide: () => void }) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const openOverlay = usePipelineStore((state) => state.openOverlayStage);
  return <WizardScreen stage="welcome" title={t('import.title')}
    actions={<>
      <Appbar.Action icon="history" accessibilityLabel={t('history.title')} onPress={() => openOverlay('history')} />
      <Appbar.Action icon="cog-outline" accessibilityLabel={t('settings.title')} onPress={() => openOverlay('settings')} />
    </>}
    footer={<SecondaryButton icon="folder-zip-outline" onPress={() => { void chooseZip(); }}>{t('import.chooseZip')}</SecondaryButton>}>
    <ScrollView contentContainerStyle={styles.content}>
      <Text variant="headlineMedium" style={[styles.title, textStyles.start]}>{t('import.heroTitle')}</Text>
      <Text variant="bodyLarge" style={textStyles.start}>{t('import.heroBody')}</Text>
      <View style={[styles.sharing, { backgroundColor: theme.colors.primaryContainer }]}>
        <MaterialCommunityIcons name="whatsapp" size={36} color={theme.colors.onPrimaryContainer} importantForAccessibility="no" />
        <Text variant="titleLarge" accessibilityRole="header" style={[styles.sharingTitle, textStyles.start, { color: theme.colors.onPrimaryContainer }]}>
          {t('import.shareTitle')}
        </Text>
        <Text variant="bodyMedium" style={[textStyles.start, { color: theme.colors.onPrimaryContainer }]}>{t('import.shareBody')}</Text>
        <PrimaryButton icon="help-circle-outline" onPress={onOpenWhatsAppGuide}>{t('import.openGuide')}</PrimaryButton>
      </View>
      <Text variant="bodyMedium" style={[textStyles.start, { color: theme.colors.onSurfaceVariant }]}>{t('import.subtitle')}</Text>
      <Text variant="bodySmall" style={[textStyles.start, { color: theme.colors.onSurfaceVariant }]}>{t('import.infoLocalBody')}</Text>
    </ScrollView>
  </WizardScreen>;
}
const styles = StyleSheet.create({
  content: { gap: spacing.card, paddingVertical: spacing.card },
  title: { fontWeight: '800' },
  sharing: { gap: spacing.gap, padding: spacing.compactInner, borderRadius: radius.card },
  sharingTitle: { fontWeight: '700' }
});
