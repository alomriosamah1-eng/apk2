import { memo } from 'react';
import { ViewStyle, StyleSheet } from 'react-native';
import { useTheme } from '@ui/providers/ThemeProvider';

import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

/** Props for the {@link Skeleton} component. */
interface SkeletonProps {
  width?: number;
  height?: number;
  borderRadiusVal?: number;
  style?: ViewStyle;
}

function SkeletonComponent({
  width = 100,
  height = 20,
  borderRadiusVal = 4,
  style,
}: SkeletonProps) {
  const { colors } = useTheme();
  const opacity = useSharedValue(0.3);

  opacity.value = withRepeat(
    withTiming(0.7, { duration: 800, easing: Easing.inOut(Easing.ease) }),
    -1,
    true,
  );

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius: borderRadiusVal,
          backgroundColor: colors.surfaceVariant,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

/** An animated skeleton placeholder for loading states. */
export const Skeleton = memo(SkeletonComponent);

const styles = StyleSheet.create({
  skeleton: {
    overflow: 'hidden',
  },
});
