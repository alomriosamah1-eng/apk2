import { memo } from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@ui/providers/ThemeProvider';
import { borderRadius, elevations } from '@core/theme';
import { Icon } from '@ui/components/atoms/Icon';

interface FloatingButtonProps {
  icon: keyof typeof import('@expo/vector-icons').MaterialCommunityIcons.glyphMap;
  onPress: () => void;
  size?: number;
  accessibilityLabel?: string;
}

function FloatingButtonComponent({
  icon,
  onPress,
  size = 56,
  accessibilityLabel,
}: FloatingButtonProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? icon}
      style={[
        styles.fab,
        {
          width: size,
          height: size,
          borderRadius: borderRadius.xl,
          backgroundColor: colors.primary,
          ...elevations[4],
          bottom: Math.max(insets.bottom, 16) + 16,
        },
      ]}
    >
      <Icon name={icon} size={24} color={colors.onPrimary} />
    </TouchableOpacity>
  );
}

export const FloatingButton = memo(FloatingButtonComponent);

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 24,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
});
