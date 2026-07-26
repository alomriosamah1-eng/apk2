import { ReactNode } from 'react';
import { View, ViewStyle, Pressable, PressableProps } from 'react-native';
import { useTheme } from '@ui/providers/ThemeProvider';
import { createNeuShadow } from '@core/theme';

/** Props for the {@link NeuCard} component. */
interface NeuCardProps {
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  pressed?: boolean;
  onPress?: PressableProps['onPress'];
  style?: ViewStyle;
}

/** A neumorphism-styled card with raised/pressed shadow states and pressable support. */
export function NeuCard({ children, size = 'md', pressed = false, onPress, style }: NeuCardProps) {
  const { colors } = useTheme();
  const neu = createNeuShadow(colors);
  const radius = size === 'sm' ? 8 : size === 'lg' ? 16 : 12;

  const shadowStyle = pressed ? neu.pressed : neu.raised;
  if (size === 'sm') {
    Object.assign(shadowStyle, neu.raisedSm);
  } else if (size === 'lg') {
    Object.assign(shadowStyle, neu.raisedLg);
  }

  const cardStyle: ViewStyle = {
    backgroundColor: colors.surface,
    borderRadius: radius,
    padding: size === 'sm' ? 12 : size === 'lg' ? 24 : 16,
    ...shadowStyle,
    ...style,
  };

  if (onPress) {
    return (
      <Pressable onPress={onPress}>
        <View style={cardStyle}>{children}</View>
      </Pressable>
    );
  }

  return <View style={cardStyle}>{children}</View>;
}
