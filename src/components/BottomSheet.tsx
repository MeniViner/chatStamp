import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton, Surface, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../theme/useAppTheme';
import { spacing, radius } from '../theme/designTokens';
import { textStyles } from './AppUi';
import { useAppLayoutDirection } from '../i18n/AppLayoutDirectionContext';

type BottomSheetProps = {
  visible: boolean;
  title: string;
  subtitle?: string;
  onDismiss: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export function PremiumBottomSheet({ visible, title, subtitle, onDismiss, children, footer }: BottomSheetProps) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const layoutDirection = useAppLayoutDirection();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <Pressable style={[styles.backdrop, layoutDirection === 'rtl' ? styles.rtl : styles.ltr]} onPress={onDismiss}>
        <Pressable style={styles.pressableSheet}>
          <Surface
            elevation={3}
            style={[
              styles.sheet,
              {
                backgroundColor: theme.colors.surface,
                paddingBottom: Math.max(insets.bottom, spacing.compactInner)
              }
            ]}
          >
            <View style={[styles.handle, { backgroundColor: theme.colors.outlineVariant }]} />
            <View style={styles.header}>
              <View style={styles.headerText}>
                <Text variant="headlineSmall" numberOfLines={3} ellipsizeMode="tail" style={[styles.title, textStyles.start]}>
                  {title}
                </Text>
                {subtitle ? (
                  <Text
                    variant="bodySmall"
                    numberOfLines={4}
                    ellipsizeMode="tail"
                    style={[textStyles.start, { color: theme.colors.onSurfaceVariant }]}
                  >
                    {subtitle}
                  </Text>
                ) : null}
              </View>
              <IconButton icon="close" onPress={onDismiss} accessibilityLabel={t('common.close')} />
            </View>
            <View style={styles.bodyWrap}>
              <ScrollView
                nestedScrollEnabled
                style={styles.scroll}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
              >
                {children}
              </ScrollView>
            </View>
            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </Surface>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function BottomSheet(props: BottomSheetProps) {
  return <PremiumBottomSheet {...props} />;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.32)'
  },
  ltr: {
    direction: 'ltr'
  },
  rtl: {
    direction: 'rtl'
  },
  pressableSheet: {
    width: '100%'
  },
  sheet: {
    borderTopLeftRadius: radius.largeCard,
    borderTopRightRadius: radius.largeCard,
    paddingHorizontal: spacing.screenHorizontal,
    paddingTop: 12,
    gap: spacing.gap,
    maxHeight: '88%'
  },
  handle: {
    alignSelf: 'center',
    width: 46,
    height: 5,
    borderRadius: 999
  },
  bodyWrap: {
    flexShrink: 1,
    maxHeight: '72%'
  },
  scroll: {
    flexGrow: 0
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.smallGap
  },
  headerText: {
    flex: 1,
    gap: 4,
    paddingTop: 8
  },
  title: {
    fontWeight: '800',
    letterSpacing: 0
  },
  scrollContent: {
    gap: spacing.gap,
    paddingBottom: spacing.section
  },
  footer: {
    gap: spacing.smallGap,
    paddingTop: spacing.smallGap
  }
});
