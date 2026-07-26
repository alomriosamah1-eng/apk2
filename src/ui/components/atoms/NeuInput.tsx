import { TextInput, TextInputProps, ViewStyle } from 'react-native';
import { useTheme } from '@ui/providers/ThemeProvider';
import { createNeuShadow } from '@core/theme';

/** Props for the {@link NeuInput} component. */
interface NeuInputProps extends TextInputProps {
  containerStyle?: ViewStyle;
}

/** A neumorphism-styled text input with inset shadow effect. */
export function NeuInput({ style, containerStyle: _containerStyle, ...props }: NeuInputProps) {
  const { colors } = useTheme();
  const neu = createNeuShadow(colors);

  return (
    <TextInput
      placeholderTextColor={colors.onSurfaceVariant}
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: 8,
          paddingHorizontal: 14,
          paddingVertical: 10,
          fontSize: 15,
          color: colors.onSurface,
          ...neu.pressed,
        },
        style,
      ]}
      {...props}
    />
  );
}
