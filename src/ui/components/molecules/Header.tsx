import { memo } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@ui/providers/ThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '@core/theme';
import { Typography } from '@ui/components/atoms/Typography';
import { Icon } from '@ui/components/atoms/Icon';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
}

function HeaderComponent({ title, subtitle, showBack, onBack, rightAction }: HeaderProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[styles.container, { paddingTop: insets.top + spacing.sm }]}
      accessibilityRole="header"
    >
      <View style={styles.content}>
        <View style={styles.left}>
          {showBack && (
            <TouchableOpacity
              onPress={onBack}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={styles.backButton}
              accessibilityRole="button"
              accessibilityLabel={t('common.goBack')}
            >
              <Icon name="arrow-left" size={24} color={colors.onBackground} />
            </TouchableOpacity>
          )}
          <View style={styles.textContainer}>
            {title && (
              <Typography variant="titleLarge" numberOfLines={1}>
                {title}
              </Typography>
            )}
            {subtitle && (
              <Typography variant="bodySmall" color={colors.onSurfaceVariant} numberOfLines={1}>
                {subtitle}
              </Typography>
            )}
          </View>
        </View>
        {rightAction && (
          <View style={styles.right} accessibilityRole="toolbar">
            {rightAction}
          </View>
        )}
      </View>
    </View>
  );
}

export const Header = memo(HeaderComponent);

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  textContainer: {
    flex: 1,
    marginRight: spacing.md,
  },
  right: {
    marginLeft: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  backButton: {
    padding: spacing.sm,
    marginRight: spacing.sm,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
