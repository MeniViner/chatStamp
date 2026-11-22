import React from 'react';
import { Button, Dialog, Portal, Text } from 'react-native-paper';
import { ScrollView, StyleSheet } from 'react-native';
import { surfaceRoles, textStyles } from './AppUi';
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
      <Dialog visible={visible} dismissable={!busy} dismissableBackButton={!busy} onDismiss={() => { if (!busy) onDismiss(); }} style={[styles.dialog, { backgroundColor: surfaceRoles(theme).raised }]}>
        <Dialog.Title style={[styles.title, textStyles.start, { color: theme.colors.onSurface }]}>{title}</Dialog.Title>
        <ScrollView style={styles.body}><Dialog.Content>
          <Text variant="bodyMedium" style={[textStyles.start, { color: theme.colors.onSurfaceVariant }]}>{body}</Text>
        </Dialog.Content></ScrollView>
        <Dialog.Actions style={styles.actions}>
          <Button style={styles.button} contentStyle={styles.button} disabled={busy} onPress={busy ? undefined : onDismiss}>{cancelLabel}</Button>
          <Button style={styles.button} contentStyle={styles.button} disabled={busy} loading={busy} mode="text" textColor={destructive ? theme.colors.error : theme.colors.primary} onPress={busy ? undefined : onConfirm}>
            {confirmLabel}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  dialog: {
    borderRadius: radius.dialog
  },
  title: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '400',
    letterSpacing: 0
  },
  body: { flexShrink: 1 },
  button: { minHeight: 48, borderRadius: radius.button },
  actions: {
    flexShrink: 0,
    flexWrap: 'wrap',
    gap: 8
  }
});
