import { memo } from 'react';
import { View, ViewStyle, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@ui/providers/ThemeProvider';
import { spacing, borderRadius, elevations } from '@core/theme';

/** Props for the {@link Card} component. */
interface CardProps {
  children: React.ReactNode;
  variant?: 'elevated' | 'filled' | 'outlined' | 'glass';
  elevation?: number;
  onPress?: () => void;
  style?: ViewStyle;
  padding?: number;
}

function CardComponent({
  children,
  variant = 'elevated',
  elevation = 2,
  onPress,
  style,
  padding = spacing.lg,
}: CardProps) {
  const { colors } = useTheme();

  const variantStyles: Record<string, ViewStyle> = {
    elevated: {
      backgroundColor: colors.surface,
      ...elevations[elevation] ?? elevations[2],
    },
    filled: {
      backgroundColor: colors.surfaceVariant,
    },
    outlined: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
    },
    glass: {
      backgroundColor: colors.glassBackground,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      ...elevations[3],
    },
  };

  const container = (
    <View
      style={[
        styles.card,
        { borderRadius: borderRadius.lg, padding },
        variantStyles[variant],
        variant === 'elevated' && !style?.overflow && styles.elevatedFix,
        style,
      ]}
      accessibilityRole={onPress ? 'button' : 'none'}
    >
      {children}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7} accessibilityRole="button">
        {container}
      </TouchableOpacity>
    );
  }

  return container;
}

/** A themed container card with elevated, filled, outlined, and glass variants. */
export const Card = memo(CardComponent);

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
  elevatedFix: {
    overflow: 'visible',
  },
});
