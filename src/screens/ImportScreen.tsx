import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Appbar, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { usePipelineStore } from '../store/pipelineStore';
import { chooseZip } from '../services/operationCoordinator';
import { useAppTheme } from '../theme/useAppTheme';
import { InfoBanner, ListGroup, NavigationItem, PrimaryButton, textStyles } from '../components/AppUi';
import { WizardScreen } from './WizardScreen';
import { spacing } from '../theme/designTokens';

export function ImportScreen({ onOpenWhatsAppGuide }: { onOpenWhatsAppGuide: () => void }) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const openOverlay = usePipelineStore((state) => state.openOverlayStage);
  return <WizardScreen stage="welcome" title={t('import.heroTitle')} subtitle={t('import.heroBody')}
    actions={<>
      <Appbar.Action icon="history" accessibilityLabel={t('history.title')} onPress={() => openOverlay('history')} />
      <Appbar.Action icon="cog-outline" accessibilityLabel={t('settings.title')} onPress={() => openOverlay('settings')} />
    </>}
    footer={<PrimaryButton icon="folder-zip-outline" onPress={() => { void chooseZip(); }}>{t('import.chooseZip')}</PrimaryButton>}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <InfoBanner icon="whatsapp" title={t('import.shareTitle')} body={t('import.shareBody')} onPress={onOpenWhatsAppGuide} />
      <ListGroup>
        <NavigationItem icon="help-circle-outline" title={t('import.openGuide')} onPress={onOpenWhatsAppGuide} />
        <NavigationItem icon="history" title={t('history.title')} description={t('history.subtitle')} onPress={() => openOverlay('history')} />
      </ListGroup>
      <View style={styles.localNote}>
        <MaterialCommunityIcons name="shield-lock-outline" size={18} color={theme.colors.onSurfaceVariant} importantForAccessibility="no" />
        <Text variant="bodySmall" style={[styles.flex, textStyles.start, { color: theme.colors.onSurfaceVariant }]}>{t('import.infoLocalBody')}</Text>
      </View>
    </ScrollView>
  </WizardScreen>;
}
const styles = StyleSheet.create({
  content: { gap: spacing.card, paddingBottom: spacing.card },
  localNote: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.smallGap, paddingHorizontal: spacing.tinyGap },
  flex: { flex: 1 }
});
