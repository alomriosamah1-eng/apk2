import { useState } from 'react';
import { Pressable, Text, ViewStyle, TextStyle } from 'react-native';
import { useTheme } from '@ui/providers/ThemeProvider';
import { createNeuShadow } from '@core/theme';

/** Props for the {@link NeuButton} component. */
interface NeuButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'default' | 'primary' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  style?: ViewStyle;
}

/** A neumorphism-styled pressable button with raised/pressed shadow effects. */
export function NeuButton({ title, onPress, variant = 'default', size = 'md', disabled, style }: NeuButtonProps) {
  const { colors } = useTheme();
  const [pressed, setPressed] = useState(false);
  const neu = createNeuShadow(colors);

  const radius = size === 'sm' ? 6 : size === 'lg' ? 12 : 8;
  const paddingV = size === 'sm' ? 6 : size === 'lg' ? 14 : 10;
  const paddingH = size === 'sm' ? 12 : size === 'lg' ? 28 : 20;
  const fontSize = size === 'sm' ? 13 : size === 'lg' ? 16 : 14;

  const getBg = () => {
    if (disabled) return colors.surfaceVariant;
    switch (variant) {
      case 'primary': return colors.primary;
      case 'danger': return colors.error;
      case 'success': return colors.success;
      default: return colors.surface;
    }
  };

  const getTextColor = () => {
    if (disabled) return colors.onSurfaceVariant;
    switch (variant) {
      case 'primary': return colors.onPrimary;
      case 'danger': return colors.onError;
      case 'success': return colors.onPrimary;
      default: return colors.onSurface;
    }
  };

  const btnStyle: ViewStyle = {
    backgroundColor: getBg(),
    borderRadius: radius,
    paddingVertical: paddingV,
    paddingHorizontal: paddingH,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    opacity: disabled ? 0.5 : 1,
    ...(pressed ? neu.pressedSm : neu.raisedSm),
    ...style,
  };

  const textStyle: TextStyle = {
    color: getTextColor(),
    fontSize,
    fontWeight: '600',
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={disabled}
      style={btnStyle}
    >
      <Text style={textStyle}>{title}</Text>
    </Pressable>
  );
}
