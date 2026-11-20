import React from 'react';
import { Button, Dialog, Portal, Text } from 'react-native-paper';
import { ScrollView, StyleSheet } from 'react-native';
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
  busy?: boolean;
};

export function ConfirmDialog({
  visible,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onDismiss,
  destructive = false,
  busy = false
}: ConfirmDialogProps) {
  const theme = useAppTheme();
  return (
    <Portal>
      <Dialog visible={visible} dismissable={!busy} dismissableBackButton={!busy} onDismiss={() => { if (!busy) onDismiss(); }} style={[styles.dialog, { backgroundColor: theme.colors.surface }]}>
        <Dialog.Title style={[styles.title, textStyles.start]}>{title}</Dialog.Title>
        <ScrollView style={styles.body}><Dialog.Content>
          <Text variant="bodyMedium" style={textStyles.start}>{body}</Text>
        </Dialog.Content></ScrollView>
        <Dialog.Actions style={styles.actions}>
          <Button style={styles.button} contentStyle={styles.button} disabled={busy} onPress={busy ? undefined : onDismiss}>{cancelLabel}</Button>
          <Button style={styles.button} contentStyle={styles.button} disabled={busy} loading={busy} mode={destructive ? 'text' : 'contained'} textColor={destructive ? theme.colors.error : undefined} onPress={busy ? undefined : onConfirm}>
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
    fontWeight: '600',
    letterSpacing: 0
  },
  body: { flexShrink: 1 },
  button: { minHeight: 48, borderRadius: 16 },
  actions: {
    flexShrink: 0,
    flexWrap: 'wrap',
    gap: 8
  }
});
