import { memo, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '@ui/providers/ThemeProvider';
import { spacing } from '@core/theme';
import { Input } from '@ui/components/atoms/Input';
import { Icon } from '@ui/components/atoms/Icon';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onClear?: () => void;
}

function SearchBarComponent({
  value,
  onChangeText,
  placeholder = 'Search...',
  onClear,
}: SearchBarProps) {
  const { colors } = useTheme();

  const handleClear = useCallback(() => {
    onClear?.();
  }, [onClear]);

  return (
    <View style={styles.container}>
      <Input
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        leftIcon={<Icon name="magnify" size={20} color={colors.onSurfaceVariant} />}
        rightIcon={
          value.length > 0 && onClear ? (
            <TouchableOpacity
              onPress={handleClear}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <Icon name="close-circle" size={20} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
          ) : undefined
        }
        containerStyle={styles.inputContainer}
        returnKeyType="search"
      />
    </View>
  );
}

export const SearchBar = memo(SearchBarComponent);

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  inputContainer: {
    marginBottom: 0,
  },
});
