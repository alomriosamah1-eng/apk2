import { memo, useEffect } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@ui/providers/ThemeProvider';
import { spacing, borderRadius } from '@core/theme';
import { Typography } from './Typography';

/** Props for the {@link Snackbar} component. */
interface SnackbarProps {
  visible: boolean;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss: () => void;
  duration?: number;
}

function SnackbarComponent({
  visible,
  message,
  actionLabel,
  onAction,
  onDismiss,
  duration = 3000,
}: SnackbarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(100);

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, { damping: 15, stiffness: 150 });
      const timer = setTimeout(() => {
        translateY.value = withTiming(100, { duration: 200 });
        runOnJS(onDismiss)();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [visible, duration, onDismiss, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: colors.inverseSurface,
          borderRadius: borderRadius.md,
          bottom: insets.bottom + spacing.lg,
          marginHorizontal: spacing.lg,
        },
        animatedStyle,
      ]}
      accessibilityRole="alert"
      accessibilityLabel={message}
    >
      <Typography
        variant="bodyMedium"
        color={colors.inverseOnSurface}
        style={styles.message}
      >
        {message}
      </Typography>
      {actionLabel && onAction && (
        <TouchableOpacity
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          style={styles.action}
        >
          <Typography
            variant="labelLarge"
            color={colors.inversePrimary}
          >
            {actionLabel}
          </Typography>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

/** An animated snackbar that slides up from the bottom with auto-dismiss and optional action. */
export const Snackbar = memo(SnackbarComponent);

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    zIndex: 999,
  },
  message: {
    flex: 1,
    marginRight: spacing.sm,
  },
  action: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginLeft: spacing.sm,
  },
});
