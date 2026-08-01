import { Redirect } from 'expo-router';
import { useSession } from '@ui/providers/SessionProvider';

export default function Index() {
  const { isUnlocked, activeVaultId } = useSession();
  if (isUnlocked) {
    return <Redirect href={{ pathname: '/(app)/(tabs)/vault', params: { vaultId: activeVaultId ?? undefined } }} />;
  }
  return <Redirect href="/(auth)/welcome" />;
}
