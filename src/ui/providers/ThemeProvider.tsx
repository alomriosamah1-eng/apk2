import { createContext, useContext, useState, useMemo, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { lightColors, darkColors, amoledColors, ThemeColors } from '@core/theme';
import { ThemeMode } from '@core/constants';
import { getStateLayers, StateLayer } from '@core/theme/state';

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
    setThemeMode: setThemeMode as (mode: ThemeMode) => void,
    stateLayers,
  }), [colors, mode, isDark, stateLayers]);

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
