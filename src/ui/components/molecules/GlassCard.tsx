import { memo } from 'react';
import { View, ViewStyle, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '@ui/providers/ThemeProvider';
import { spacing, borderRadius } from '@core/theme';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  blurIntensity?: number;
  padding?: number;
}

function GlassCardComponent({
  children,
  style,
  blurIntensity = 15,
  padding = spacing.lg,
}: GlassCardProps) {
  const { colors, isDark } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.glassBackground,
          borderColor: colors.glassBorder,
          borderRadius: borderRadius.xl,
          padding,
        },
        style,
      ]}
    >
      <BlurView
        intensity={blurIntensity}
        tint={isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

export const GlassCard = memo(GlassCardComponent);

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  content: {
    zIndex: 1,
  },
});
