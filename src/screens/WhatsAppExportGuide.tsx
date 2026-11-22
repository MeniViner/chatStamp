import React from 'react';
import { BackHandler, I18nManager, ScrollView, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Appbar, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { AppScreenScaffold, PrimaryButton, SecondaryButton, textStyles } from '../components/AppUi';
import { useAppTheme } from '../theme/useAppTheme';
import { radius, spacing } from '../theme/designTokens';

export function WhatsAppExportGuide({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const [page, setPage] = React.useState(0);
  const pages = [
    { id: 'openChat', icon: 'message-text-outline', title: t('whatsAppGuide.steps.openChat.title'), body: t('whatsAppGuide.steps.openChat.body') },
    { id: 'menu', icon: 'dots-vertical', title: t('whatsAppGuide.steps.menu.title'), body: t('whatsAppGuide.steps.menu.body') },
    { id: 'exportChat', icon: 'export', title: t('whatsAppGuide.steps.exportChat.title'), body: t('whatsAppGuide.steps.exportChat.body') },
    { id: 'includeMedia', icon: 'image-multiple-outline', title: t('whatsAppGuide.steps.includeMedia.title'), body: t('whatsAppGuide.steps.includeMedia.body') },
    { id: 'shareToApp', icon: 'share-variant-outline', title: t('whatsAppGuide.steps.shareToApp.title'), body: t('whatsAppGuide.steps.shareToApp.body') },
    { id: 'automaticImport', icon: 'check-circle-outline', title: t('whatsAppGuide.steps.automaticImport.title'), body: t('whatsAppGuide.steps.automaticImport.body') }
  ] as const;
  const current = pages[page] ?? pages[0];
  const last = page === pages.length - 1;
  React.useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
    return () => listener.remove();
  }, [onClose]);

  return <AppScreenScaffold title={t('whatsAppGuide.title')}
    stepLabel={t('common.stepOf', { current: page + 1, total: pages.length })} onBack={onClose} titleMode="compact"
    actions={<Appbar.Action icon="close" accessibilityLabel={t('common.close')} onPress={onClose} />}
    footer={<View style={styles.actions}>
      <SecondaryButton style={styles.action} disabled={page === 0} icon={I18nManager.isRTL ? 'chevron-right' : 'chevron-left'}
        onPress={() => setPage((value) => Math.max(0, value - 1))}>{t('whatsAppGuide.previous')}</SecondaryButton>
      <PrimaryButton style={styles.action} icon={last ? 'check' : I18nManager.isRTL ? 'arrow-left' : 'arrow-right'} iconAfterLabel={!last}
        onPress={last ? onClose : () => setPage((value) => Math.min(pages.length - 1, value + 1))}>
        {last ? t('whatsAppGuide.finish') : t('common.next')}
      </PrimaryButton>
    </View>}>
    <ScrollView key={current.id} style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={[styles.icon, { backgroundColor: theme.colors.primaryContainer }]} importantForAccessibility="no-hide-descendants">
        <MaterialCommunityIcons name={current.icon} size={56} color={theme.colors.onPrimaryContainer} />
      </View>
      <Text variant="headlineMedium" accessibilityRole="header" accessibilityLiveRegion="polite" style={[styles.title, textStyles.start]}>
        {current.title}
      </Text>
      <Text variant="bodyLarge" style={[textStyles.start, { color: theme.colors.onSurfaceVariant }]}>{current.body}</Text>
      <View style={styles.dots} importantForAccessibility="no-hide-descendants">
        {pages.map((entry, index) => <View key={entry.id} style={[styles.dot, {
          width: index === page ? 22 : 8, backgroundColor: index === page ? theme.colors.primary : theme.colors.outlineVariant
        }]} />)}
      </View>
    </ScrollView>
  </AppScreenScaffold>;
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', gap: spacing.card, paddingVertical: spacing.section, paddingHorizontal: spacing.tinyGap },
  icon: { width: 112, height: 112, borderRadius: radius.largeCard + 8, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  title: { fontWeight: '500' },
  dots: { flexDirection: 'row', gap: 6, paddingTop: spacing.smallGap },
  dot: { height: 8, borderRadius: 4 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.smallGap },
  action: { flexGrow: 1, flexBasis: 136 }
});
