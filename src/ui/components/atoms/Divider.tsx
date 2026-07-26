import { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '@ui/providers/ThemeProvider';
import { spacing } from '@core/theme';

/** Props for the {@link Divider} component. */
interface DividerProps {
  marginVertical?: number;
}

function DividerComponent({ marginVertical = spacing.md }: DividerProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.divider,
        { backgroundColor: colors.outlineVariant, marginVertical },
      ]}
      accessibilityRole="none"
    />
  );
}

/** A horizontal divider line with configurable vertical margin. */
export const Divider = memo(DividerComponent);

const styles = StyleSheet.create({
  divider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
});
