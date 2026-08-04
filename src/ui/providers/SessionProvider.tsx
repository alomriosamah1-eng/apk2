import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { router } from 'expo-router';
import { DIContainer } from '@core/di/container';
import { SecureStorageSource } from '@data/datasources/SecureStorageSource';

interface SessionState {
  activeVaultId: string | null;
  isUnlocked: boolean;
  lastActivityTime: number | null;
  autoLockTimeout: number;
}

interface SessionContextValue extends SessionState {
  unlock: (vaultId: string, remember?: boolean) => void;
  lock: () => void;
  setAutoLockTimeout: (timeout: number) => void;
  recordActivity: () => void;
  hydrated: boolean;
}

const AUTO_LOCK_KEY = 'auto_lock_timeout';
const SESSION_KEY = 'khaznati_active_session';
const DEFAULT_AUTO_LOCK = 300000;

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SessionState>({
    activeVaultId: null,
    isUnlocked: false,
    lastActivityTime: null,
    autoLockTimeout: DEFAULT_AUTO_LOCK,
  });
  const [hydrated, setHydrated] = useState(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const backgroundTimeRef = useRef<number | null>(null);
  const storageRef = useRef<SecureStorageSource | null>(null);

  useEffect(() => {
    storageRef.current = DIContainer.resolve<SecureStorageSource>('SecureStorageSource');
    (async () => {
      try {
        const [storedTimeout, storedSession] = await Promise.all([
          storageRef.current!.get(AUTO_LOCK_KEY),
          storageRef.current!.get(SESSION_KEY),
        ]);
        setState((prev) => ({
          ...prev,
          autoLockTimeout: storedTimeout ? parseInt(storedTimeout, 10) : prev.autoLockTimeout,
        }));
        if (storedSession) {
          const parsed = JSON.parse(storedSession) as { vaultId: string; lastActivityTime: number };
          if (parsed.vaultId) {
            setState((prev) => ({
              ...prev,
              activeVaultId: parsed.vaultId,
              isUnlocked: true,
              lastActivityTime: parsed.lastActivityTime || Date.now(),
            }));
            router.replace({ pathname: '/(app)/(tabs)/vault', params: { vaultId: parsed.vaultId } });
          }
        }
      } catch (error) {
        // Ignore malformed/corrupt session; fall through to a fresh login.
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  const unlock = useCallback((vaultId: string, remember = false) => {
    setState(prev => ({
      ...prev,
      activeVaultId: vaultId,
      isUnlocked: true,
      lastActivityTime: Date.now(),
    }));
    if (remember && storageRef.current) {
      void storageRef.current.set(
        SESSION_KEY,
        JSON.stringify({ vaultId, lastActivityTime: Date.now() }),
      );
    }
  }, []);

  const lock = useCallback(() => {
    setState(prev => ({
      ...prev,
      isUnlocked: false,
      activeVaultId: null,
      lastActivityTime: null,
    }));
    if (storageRef.current) {
      void storageRef.current.delete(SESSION_KEY);
    }
  }, []);

  const setAutoLockTimeout = useCallback(async (timeout: number) => {
    setState(prev => ({ ...prev, autoLockTimeout: timeout }));
    if (storageRef.current) {
      await storageRef.current.set(AUTO_LOCK_KEY, String(timeout));
    }
  }, []);

  const recordActivity = useCallback(() => {
    setState(prev => ({ ...prev, lastActivityTime: Date.now() }));
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (appStateRef.current.match(/active/) && nextState.match(/inactive|background/)) {
        backgroundTimeRef.current = Date.now();
      }
      if (nextState === 'active' && appStateRef.current.match(/inactive|background/)) {
        const bgTime = backgroundTimeRef.current || Date.now();
        const elapsed = Date.now() - bgTime;
        if (elapsed >= state.autoLockTimeout && state.isUnlocked) {
          setState(prev => ({
            ...prev,
            isUnlocked: false,
            activeVaultId: null,
            lastActivityTime: null,
          }));
          if (storageRef.current) {
            void storageRef.current.delete(SESSION_KEY);
          }
          router.replace('/(auth)/login');
        }
      }
      appStateRef.current = nextState;
    });
    return () => subscription.remove();
  }, [state.autoLockTimeout, state.isUnlocked]);

  return (
    <SessionContext.Provider value={{ ...state, hydrated, unlock, lock, setAutoLockTimeout, recordActivity }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
