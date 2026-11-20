import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton, Surface, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../theme/useAppTheme';
import { spacing, radius } from '../theme/designTokens';
import { textStyles } from './AppUi';
import { getBottomSheetBottomPadding } from './bottomSheetLayout';

type BottomSheetProps = {
  visible: boolean;
  title: string;
  subtitle?: string;
  onDismiss: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  scrollable?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
};

export function PremiumBottomSheet({
  visible,
  title,
  subtitle,
  onDismiss,
  children,
  footer,
  scrollable = true,
  contentStyle
}: BottomSheetProps) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const maximumHeight = Math.max(1, height - insets.top - spacing.smallGap);
  const bottomInset = getBottomSheetBottomPadding(insets.bottom, spacing.compactInner);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Pressable style={[styles.pressableSheet, { maxHeight: maximumHeight }]} onPress={(event) => event.stopPropagation()}>
          <Surface
            elevation={3}
            style={[
              styles.sheet,
              {
                backgroundColor: theme.colors.surface,
                maxHeight: maximumHeight
              }
            ]}
          >
            <View style={[styles.handle, { backgroundColor: theme.colors.outlineVariant }]} />
            <View style={styles.header}>
              <View style={styles.headerText}>
                <Text variant="headlineSmall" style={[styles.title, textStyles.start]}>
                  {title}
                </Text>
                {subtitle ? (
                  <Text
                    variant="bodySmall"
                    style={[textStyles.start, { color: theme.colors.onSurfaceVariant }]}
                  >
                    {subtitle}
                  </Text>
                ) : null}
              </View>
              <IconButton icon="close" onPress={onDismiss} accessibilityLabel={t('common.close')} />
            </View>
            <View style={styles.bodyWrap}>
              {scrollable ? (
                <ScrollView
                  nestedScrollEnabled
                  style={styles.scroll}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={[
                    styles.scrollContent,
                    !footer ? { paddingBottom: bottomInset + spacing.smallGap } : null,
                    contentStyle
                  ]}
                  keyboardShouldPersistTaps="handled"
                >
                  {children}
                </ScrollView>
              ) : (
                <View style={[styles.staticContent, !footer ? { paddingBottom: bottomInset + spacing.smallGap } : null, contentStyle]}>
                  {children}
                </View>
              )}
            </View>
            {footer ? <View style={[styles.footer, { paddingBottom: bottomInset }]}>{footer}</View> : null}
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
  pressableSheet: {
    width: '100%',
    alignSelf: 'stretch',
    marginBottom: 0,
    minHeight: 0,
    flexShrink: 1
  },
  sheet: {
    borderTopLeftRadius: radius.largeCard,
    borderTopRightRadius: radius.largeCard,
    paddingHorizontal: spacing.screenHorizontal,
    paddingTop: 12,
    paddingBottom: 0,
    gap: spacing.gap,
    minHeight: 0,
    flexShrink: 1
  },
  handle: {
    alignSelf: 'center',
    width: 46,
    height: 5,
    borderRadius: 999,
    flexShrink: 0
  },
  bodyWrap: {
    flexShrink: 1,
    minHeight: 0
  },
  scroll: {
    flexGrow: 0,
    flexShrink: 1,
    minHeight: 0
  },
  staticContent: {
    gap: spacing.gap
  },
  header: {
    flexDirection: 'row',
    flexShrink: 0,
    alignItems: 'flex-start',
    gap: spacing.smallGap
  },
  headerText: {
    flex: 1,
    gap: 4,
    paddingTop: 8
  },
  title: {
    fontWeight: '600',
    letterSpacing: 0
  },
  scrollContent: {
    gap: spacing.gap,
    paddingBottom: spacing.section
  },
  footer: {
    gap: spacing.smallGap,
    paddingTop: spacing.smallGap,
    flexShrink: 0
  }
});
