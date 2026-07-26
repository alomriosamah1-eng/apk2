import { memo } from 'react';
import { View, StyleSheet, StatusBar, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@ui/providers/ThemeProvider';
import { Header } from '@ui/components/molecules/Header';

interface ScreenLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  edges?: Array<'top' | 'bottom'>;
  hasTabs?: boolean;
}

function ScreenLayoutComponent({
  children,
  title,
  subtitle,
  showBack,
  onBack,
  rightAction,
  edges = ['top'],
  hasTabs = false,
}: ScreenLayoutProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
        translucent={Platform.OS === 'android'}
      />
      {edges.includes('top') && (
        <Header
          title={title}
          subtitle={subtitle}
          showBack={showBack}
          onBack={onBack}
          rightAction={rightAction}
        />
      )}
      <View
        style={[
          styles.content,
          {
            paddingBottom: edges.includes('bottom')
              ? hasTabs ? 0 : insets.bottom
              : 0,
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

export const ScreenLayout = memo(ScreenLayoutComponent);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});
