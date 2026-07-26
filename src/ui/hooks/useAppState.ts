import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';

export function useAppState(onForeground?: () => void, onBackground?: () => void) {
  const appState = useRef<AppStateStatus>(AppState.currentState);

  const handleAppStateChange = useCallback((nextState: AppStateStatus) => {
    if (appState.current.match(/active/) && nextState.match(/inactive|background/)) {
      onBackground?.();
    } else if (nextState === 'active' && appState.current.match(/inactive|background/)) {
      onForeground?.();
    }
    appState.current = nextState;
  }, [onForeground, onBackground]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [handleAppStateChange]);

  return { currentState: appState.current };
}
