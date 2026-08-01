import { createContext, useContext, useState, useMemo, useEffect, useCallback, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { lightColors, darkColors, amoledColors, ThemeColors } from '@core/theme';
import { ThemeMode } from '@core/constants';
import { getStateLayers, StateLayer } from '@core/theme/state';
import { SecureStorageSource } from '@data/datasources/SecureStorageSource';

const THEME_KEY = 'theme_mode';
const secureStorage = new SecureStorageSource();

interface ThemeContextValue {
  colors: ThemeColors;
  mode: ThemeMode;
  isDark: boolean;
  setThemeMode: (mode: ThemeMode) => void;
  stateLayers: {
    primary: StateLayer;
    surface: StateLayer;
    surfaceVariant: StateLayer;
    error: StateLayer;
  };
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState<ThemeMode>(ThemeMode.SYSTEM);

  useEffect(() => {
    secureStorage.get(THEME_KEY).then((stored) => {
      if (stored && (Object.values(ThemeMode) as string[]).includes(stored)) {
        setThemeMode(stored as ThemeMode);
      }
    }).catch(() => {});
  }, []);

  const persistThemeMode = useCallback((mode: ThemeMode) => {
    setThemeMode(mode);
    secureStorage.set(THEME_KEY, mode).catch(() => {});
  }, []);

  const mode = useMemo(() => {
    if (themeMode === ThemeMode.SYSTEM) {
      return systemScheme === 'dark' ? ThemeMode.DARK : ThemeMode.LIGHT;
    }
    return themeMode;
  }, [themeMode, systemScheme]);

  const colors = useMemo(() => {
    switch (mode) {
      case ThemeMode.AMOLED: return amoledColors;
      case ThemeMode.DARK: return darkColors;
      default: return lightColors;
    }
  }, [mode]);

  const isDark = mode === ThemeMode.DARK || mode === ThemeMode.AMOLED;

  const stateLayers = useMemo(() => getStateLayers(colors, isDark), [colors, isDark]);

  const value = useMemo(() => ({
    colors: colors as ThemeColors,
    mode,
    isDark,
    setThemeMode: persistThemeMode,
    stateLayers,
  }), [colors, mode, isDark, persistThemeMode, stateLayers]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
