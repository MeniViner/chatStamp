import React from 'react';
import { Button, Dialog, Portal, Text } from 'react-native-paper';
import { StyleSheet } from 'react-native';
import { textStyles } from './AppUi';
import { radius } from '../theme/designTokens';
import { useAppTheme } from '../theme/useAppTheme';

type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onDismiss: () => void;
  destructive?: boolean;
};

export function ConfirmDialog({
  visible,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onDismiss,
  destructive = false
}: ConfirmDialogProps) {
  const theme = useAppTheme();
  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={[styles.dialog, { backgroundColor: theme.colors.surface }]}>
        <Dialog.Title style={[styles.title, textStyles.start]}>{title}</Dialog.Title>
        <Dialog.Content>
          <Text variant="bodyMedium" style={textStyles.start}>{body}</Text>
        </Dialog.Content>
        <Dialog.Actions style={styles.actions}>
          <Button onPress={onDismiss}>{cancelLabel}</Button>
          <Button mode={destructive ? 'text' : 'contained'} textColor={destructive ? theme.colors.error : undefined} onPress={onConfirm}>
            {confirmLabel}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  dialog: {
    borderRadius: radius.largeCard
  },
  title: {
    fontWeight: '800',
    letterSpacing: 0
  },
  actions: {
    flexWrap: 'wrap',
    gap: 8
  }
});
