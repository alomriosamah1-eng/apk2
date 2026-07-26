import { useCallback, memo } from 'react';
import { View, StyleSheet, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { useTheme } from '@ui/providers/ThemeProvider';
import { spacing } from '@core/theme';
import { VaultCard } from '@ui/components/organisms/VaultCard';
import { FloatingButton } from '@ui/components/molecules/FloatingButton';
import { ScreenLayout } from '@ui/components/organisms/ScreenLayout';
import { EmptyState } from '@ui/components/atoms/EmptyState';
import { Loading } from '@ui/components/atoms/Loading';
import { ErrorView } from '@ui/components/atoms/ErrorView';
import { useVaults } from '@ui/hooks/useVaults';

function VaultScreenContent() {
  const { colors } = useTheme();
  const { vaults, loading, error, loadVaults } = useVaults();

  const handleVaultPress = useCallback((item: { id: string; isLocked: boolean }) => {
    if (item.isLocked) {
      router.push({ pathname: '/(auth)/login', params: { id: item.id } });
    } else {
      router.push({ pathname: '/(app)/(tabs)/files', params: { vaultId: item.id } });
    }
  }, []);

  const handleCreateVault = useCallback(() => {
    router.push('/(auth)/create-vault');
  }, []);

  if (loading && vaults.length === 0) {
    return <Loading fullScreen message="Loading vaults..." />;
  }

  if (error && vaults.length === 0) {
    return <ErrorView message={error} onRetry={loadVaults} />;
  }

  return (
    <ScreenLayout title="My Vaults" subtitle={`${vaults.length} vault${vaults.length !== 1 ? 's' : ''}`}>
      <FlashList
        data={vaults}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <VaultCard vault={item} onPress={() => handleVaultPress(item)} />
        )}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={ItemSeparator}
        ListEmptyComponent={
          <EmptyState
            icon="shield-plus"
            title="No vaults yet"
            description="Create your first secure vault to get started"
            actionLabel="Create Vault"
            onAction={handleCreateVault}
          />
        }
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={loadVaults} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      />
      <FloatingButton icon="plus" onPress={handleCreateVault} accessibilityLabel="Create new vault" />
    </ScreenLayout>
  );
}

const ItemSeparator = memo(function ItemSeparator() {
  return <View style={{ height: spacing.md }} />;
});

export default memo(VaultScreenContent);

const styles = StyleSheet.create({
  list: {
    padding: spacing.lg,
    flexGrow: 1,
  },
});
