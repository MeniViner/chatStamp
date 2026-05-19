import React from 'react';
import { Button, Dialog, Portal, Text } from 'react-native-paper';
import { textStyles } from './AppUi';

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
  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss}>
        <Dialog.Title style={textStyles.start}>{title}</Dialog.Title>
        <Dialog.Content>
          <Text variant="bodyMedium" style={textStyles.start}>{body}</Text>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>{cancelLabel}</Button>
          <Button buttonColor={destructive ? undefined : undefined} textColor={destructive ? '#b3261e' : undefined} onPress={onConfirm}>
            {confirmLabel}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
