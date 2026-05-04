import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { IconButton, Surface, Text } from 'react-native-paper';
import { useAppTheme } from '../theme/useAppTheme';

type BottomSheetProps = {
  visible: boolean;
  title: string;
  subtitle?: string;
  onDismiss: () => void;
  children: React.ReactNode;
};

export function BottomSheet({ visible, title, subtitle, onDismiss, children }: BottomSheetProps) {
  const theme = useAppTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Pressable>
          <Surface elevation={3} style={[styles.sheet, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.header}>
              <View style={styles.headerText}>
                <Text variant="titleMedium">{title}</Text>
                {subtitle ? (
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    {subtitle}
                  </Text>
                ) : null}
              </View>
              <IconButton icon="close" onPress={onDismiss} />
            </View>
            {children}
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
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 20,
    gap: 14,
    maxHeight: '86%'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8
  },
  headerText: {
    flex: 1,
    gap: 4,
    paddingTop: 12
  }
});
