import { memo, useCallback, useEffect } from 'react';
import { View, StyleSheet, Modal, Dimensions, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useTheme } from '@ui/providers/ThemeProvider';
import { spacing, borderRadius } from '@core/theme';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  height?: number;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

function BottomSheetComponent({
  visible,
  onClose,
  children,
  height = SCREEN_HEIGHT * 0.5,
}: BottomSheetProps) {
  const { colors } = useTheme();
  const translateY = useSharedValue(height);
  const isOpen = useSharedValue(false);

  useEffect(() => {
    if (visible) {
      isOpen.value = true;
      translateY.value = withSpring(0, {
        damping: 20,
        stiffness: 200,
      });
    } else {
      translateY.value = withTiming(height, { duration: 250 });
      isOpen.value = false;
    }
  }, [visible, height, translateY, isOpen]);

  const closeSheet = useCallback(() => {
    'worklet';
    translateY.value = withTiming(height, { duration: 250 });
    runOnJS(onClose)();
  }, [onClose, height, translateY]);

  const gesture = Gesture.Pan()
    .onUpdate((event) => {
      if (event.translationY > 0) {
        translateY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      if (event.translationY > height * 0.3) {
        closeSheet();
      } else {
        translateY.value = withSpring(0, {
          damping: 20,
          stiffness: 200,
        });
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <GestureDetector gesture={gesture}>
          <Animated.View
            style={[
              styles.sheet,
              {
                height,
                backgroundColor: colors.surface,
                borderTopLeftRadius: borderRadius.xxl,
                borderTopRightRadius: borderRadius.xxl,
              },
              animatedStyle,
            ]}
          >
            <Pressable onPress={() => {}} style={styles.content}>
              <View style={styles.handleContainer}>
                <View style={[styles.handle, { backgroundColor: colors.outlineVariant }]} />
              </View>
              {children}
            </Pressable>
          </Animated.View>
        </GestureDetector>
      </Pressable>
    </Modal>
  );
}

export const BottomSheet = memo(BottomSheetComponent);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  content: {
    flex: 1,
  },
  handleContainer: {
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingVertical: spacing.xs,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
});
