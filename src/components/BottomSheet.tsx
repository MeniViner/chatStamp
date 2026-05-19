import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton, Surface, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../theme/useAppTheme';
import { spacing, radius } from '../theme/designTokens';
import { textStyles } from './AppUi';

type BottomSheetProps = {
  visible: boolean;
  title: string;
  subtitle?: string;
  onDismiss: () => void;
  children: React.ReactNode;
};

export function BottomSheet({ visible, title, subtitle, onDismiss, children }: BottomSheetProps) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
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
            <View style={styles.header}>
              <View style={styles.headerText}>
                <Text variant="titleMedium" numberOfLines={2} ellipsizeMode="tail" style={[styles.title, textStyles.start]}>
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
                style={styles.scroll}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
              >
                {children}
              </ScrollView>
            </View>
          </Surface>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.32)'
  },
  pressableSheet: {
    width: '100%'
  },
  sheet: {
    borderTopLeftRadius: radius.largeCard,
    borderTopRightRadius: radius.largeCard,
    paddingHorizontal: spacing.compactInner,
    paddingTop: 10,
    gap: spacing.gap,
    maxHeight: '86%'
  },
  bodyWrap: {
    maxHeight: '72%'
  },
  scroll: {
    flexGrow: 0
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8
  },
  headerText: {
    flex: 1,
    gap: 4,
    paddingTop: 8
  },
  title: {
    fontWeight: '700'
  },
  scrollContent: {
    gap: spacing.gap,
    paddingBottom: spacing.smallGap
  }
});
