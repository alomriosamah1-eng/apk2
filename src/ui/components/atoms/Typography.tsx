import { Text, TextProps, StyleSheet } from 'react-native';
import { useTheme } from '@ui/providers/ThemeProvider';
import { typography, TypographyKey } from '@core/theme';

/** Props for the {@link Typography} component. */
interface TypographyProps extends TextProps {
  variant?: TypographyKey;
  color?: string;
  align?: 'left' | 'center' | 'right';
  italic?: boolean;
  mono?: boolean;
}

/** A themed text component using predefined typography variants from the theme. */
export function Typography({
  variant = 'bodyMedium',
  color,
  align,
  italic = false,
  mono = false,
  style,
  children,
  ...props
}: TypographyProps) {
  const { colors } = useTheme();

  return (
    <Text
      style={[
        typography[variant],
        mono && typography['mono'],
        italic && styles.italic,
        align && { textAlign: align },
        { color: color ?? colors.onBackground },
        style,
      ]}
      allowFontScaling
      maxFontSizeMultiplier={1.4}
      {...props}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  italic: {
    fontStyle: 'italic',
  },
});
