import { memo, useCallback } from 'react';
import { View, Modal, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useTheme } from '@ui/providers/ThemeProvider';
import { spacing, borderRadius } from '@core/theme';
import { Typography } from '@ui/components/atoms/Typography';
import { Button } from '@ui/components/atoms/Button';

interface DialogProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  variant?: 'default' | 'danger';
}

function DialogComponent({
  visible,
  onClose,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'default',
}: DialogProps) {
  const { colors } = useTheme();

  const handleCancel = useCallback(() => {
    onCancel?.();
    onClose();
  }, [onCancel, onClose]);

  const handleConfirm = useCallback(() => {
    onConfirm?.();
    onClose();
  }, [onConfirm, onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'android' ? 'height' : 'padding'}
        style={styles.overlay}
      >
        <View
          style={[styles.dialog, { backgroundColor: colors.surface, borderRadius: borderRadius.xl }]}
          accessibilityRole="alert"
        >
          <ScrollView
            bounces={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <Typography variant="titleLarge">{title}</Typography>
            <Typography
              variant="bodyMedium"
              color={colors.onSurfaceVariant}
              style={styles.message}
            >
              {message}
            </Typography>
          </ScrollView>
          <View style={styles.actions}>
            <Button
              title={cancelLabel}
              onPress={handleCancel}
              variant="ghost"
              style={styles.button}
            />
            <Button
              title={confirmLabel}
              onPress={handleConfirm}
              variant={variant === 'danger' ? 'danger' : 'primary'}
              style={styles.button}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export const Dialog = memo(DialogComponent);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  dialog: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  scrollContent: {
    padding: spacing.xl,
  },
  message: {
    marginTop: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: spacing.lg,
    paddingTop: 0,
    gap: spacing.sm,
  },
  button: {
    minWidth: 80,
  },
});
