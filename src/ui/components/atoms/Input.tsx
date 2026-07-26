import { useState, useCallback, forwardRef, memo } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TextInputProps,
  ViewStyle,
  TouchableOpacity,
  Keyboard,
} from 'react-native';
import { useTheme } from '@ui/providers/ThemeProvider';
import { spacing, borderRadius } from '@core/theme';
import { Typography } from './Typography';
import { Icon } from './Icon';

/** Props for the {@link Input} component. */
interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerStyle?: ViewStyle;
  showSecureToggle?: boolean;
}

function InputComponent({
  label,
  error,
  leftIcon,
  rightIcon,
  containerStyle,
  style,
  showSecureToggle = false,
  secureTextEntry,
  ...props
}: InputProps, ref: React.Ref<TextInput>) {
  const { colors } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [isSecureVisible, setIsSecureVisible] = useState(false);

  const handleFocus = useCallback(() => setIsFocused(true), []);
  const handleBlur = useCallback(() => setIsFocused(false), []);
  const toggleSecure = useCallback(() => setIsSecureVisible((v) => !v), []);
  const dismissKeyboard = useCallback(() => Keyboard.dismiss(), []);

  const effectiveSecure = showSecureToggle && secureTextEntry ? !isSecureVisible : secureTextEntry;

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Typography
          variant="labelMedium"
          style={styles.label}
          accessibilityRole="text"
        >
          {label}
        </Typography>
      )}
      <TouchableOpacity
        activeOpacity={1}
        onPress={dismissKeyboard}
      >
        <View style={[
          styles.inputContainer,
          {
            backgroundColor: colors.surfaceVariant,
            borderColor: error
              ? colors.error
              : isFocused
                ? colors.primary
                : colors.outline,
            borderRadius: borderRadius.md,
            borderWidth: isFocused ? 2 : 1,
          },
        ]}>
          {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
          <TextInput
            ref={ref}
            style={[
              styles.input,
              { color: colors.onSurface, flex: 1 },
              style,
            ]}
            placeholderTextColor={colors.onSurfaceVariant}
            onFocus={handleFocus}
            onBlur={handleBlur}
            secureTextEntry={effectiveSecure}
            allowFontScaling
            maxFontSizeMultiplier={1.4}
            accessibilityLabel={label ?? props.placeholder ?? 'Input'}
            {...props}
          />
          {showSecureToggle && secureTextEntry && (
            <TouchableOpacity
              onPress={toggleSecure}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel={isSecureVisible ? 'Hide password' : 'Show password'}
              style={styles.iconRight}
            >
              <Icon
                name={isSecureVisible ? 'eye-off' : 'eye'}
                size={20}
                color={colors.onSurfaceVariant}
              />
            </TouchableOpacity>
          )}
          {rightIcon && !showSecureToggle && (
            <View style={styles.iconRight}>{rightIcon}</View>
          )}
        </View>
      </TouchableOpacity>
      {error && (
        <Typography
          variant="bodySmall"
          color={colors.error}
          style={styles.error}
          accessibilityRole="text"
          accessibilityLiveRegion="polite"
        >
          {error}
        </Typography>
      )}
      {isFocused && (
        <View style={[styles.focusIndicator, { backgroundColor: colors.primary }]} />
      )}
    </View>
  );
}

/** A themed text input with label, error, icons, and optional secure-text toggle. */
export const Input = memo(forwardRef(InputComponent));

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    marginBottom: spacing.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  input: {
    paddingVertical: spacing.sm,
    fontSize: 16,
  },
  iconLeft: {
    marginRight: spacing.sm,
  },
  iconRight: {
    marginLeft: spacing.sm,
  },
  error: {
    marginTop: spacing.xs,
  },
  focusIndicator: {
    height: 2,
    width: 0,
    alignSelf: 'center',
    borderRadius: 1,
  },
});
