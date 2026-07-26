import { memo, useCallback } from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  View,
  ActivityIndicator,
  AccessibilityState,
} from 'react-native';
import { useTheme } from '@ui/providers/ThemeProvider';
import { spacing, borderRadius } from '@core/theme';
import { Typography } from './Typography';

/** Props for the {@link Button} component. */
interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'glass' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  fullWidth?: boolean;
  accessibilityLabel?: string;
}

function ButtonComponent({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  style,
  fullWidth = false,
  accessibilityLabel,
}: ButtonProps) {
  const { colors } = useTheme();

  const bgColors: Record<string, string> = {
    primary: colors.primary,
    secondary: colors.secondary,
    ghost: 'transparent',
    glass: colors.glassBackground,
    danger: colors.error,
  };

  const txtColors: Record<string, string> = {
    primary: colors.onPrimary,
    secondary: colors.onSecondary,
    ghost: colors.primary,
    glass: colors.onSurface,
    danger: colors.onError,
  };

  const isSmall = size === 'sm';
  const touchHeight = 48;
  const visualHeight = isSmall ? 36 : size === 'lg' ? 52 : 44;
  const paddingHorizontal = isSmall ? spacing.md : size === 'lg' ? spacing.xl : spacing.lg;

  const handlePress = useCallback(() => {
    if (!disabled && !loading) onPress();
  }, [disabled, loading, onPress]);

  const accessibilityState: AccessibilityState = {
    disabled: disabled || loading,
    busy: loading,
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={accessibilityState}
      style={[
        styles.base,
        {
          backgroundColor: disabled ? colors.surfaceVariant : bgColors[variant],
          height: touchHeight,
          paddingHorizontal,
          borderRadius: borderRadius.lg,
          opacity: disabled ? 0.5 : 1,
          justifyContent: 'center',
        },
        variant === 'glass' && {
          borderWidth: 1,
          borderColor: colors.glassBorder,
        },
        fullWidth && styles.fullWidth,
        style,
      ]}
    >
      <View style={[
        styles.inner,
        { height: visualHeight },
      ]}>
        {loading ? (
          <ActivityIndicator color={txtColors[variant]} size="small" />
        ) : (
          <>
            {icon}
            <Typography
              variant={isSmall ? 'labelMedium' : 'labelLarge'}
              color={disabled ? colors.onSurfaceVariant : txtColors[variant]}
              style={icon ? { marginLeft: spacing.sm } : undefined}
            >
              {title}
            </Typography>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}

/** A themed pressable button with support for variants, sizes, loading, and icons. */
export const Button = memo(ButtonComponent);

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    width: '100%',
  },
});
