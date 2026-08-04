import { Redirect } from 'expo-router';
import { useSession } from '@ui/providers/SessionProvider';
import { Loading } from '@ui/components/atoms/Loading';

export default function Index() {
  const { isUnlocked, activeVaultId, hydrated } = useSession();
  if (!hydrated) {
    return <Loading fullScreen />;
  }
  if (isUnlocked) {
    return <Redirect href={{ pathname: '/(app)/(tabs)/vault', params: { vaultId: activeVaultId ?? undefined } }} />;
  }
  return <Redirect href="/(auth)/welcome" />;
}
