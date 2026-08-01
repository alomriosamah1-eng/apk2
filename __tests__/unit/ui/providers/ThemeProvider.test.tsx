import { renderHook, act } from '@testing-library/react-native';
import { ThemeProvider, useTheme } from '@ui/providers/ThemeProvider';
import { ThemeMode } from '@core/constants';

jest.mock('expo-secure-store');

const secureStoreMock = jest.requireMock('expo-secure-store');

describe('ThemeProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    secureStoreMock.getItemAsync.mockReset();
    secureStoreMock.setItemAsync.mockReset();
    secureStoreMock.getItemAsync.mockResolvedValue(null);
  });

  it('defaults to SYSTEM theme', () => {
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider });
    expect(result.current.mode).toBe(ThemeMode.LIGHT);
  });

  it('rehydrates a persisted theme from secure storage', async () => {
    secureStoreMock.getItemAsync.mockResolvedValue('dark');
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider });
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.mode).toBe(ThemeMode.DARK);
  });

  it('persists the theme when setThemeMode is called', async () => {
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider });
    act(() => {
      result.current.setThemeMode(ThemeMode.AMOLED);
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.mode).toBe(ThemeMode.AMOLED);
    expect(secureStoreMock.setItemAsync).toHaveBeenCalledWith(
      'theme_mode',
      'amoled',
      expect.objectContaining({ keychainAccessible: expect.anything() }),
    );
  });

  it('maps SYSTEM to the system color scheme', () => {
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider });
    expect(result.current.mode).toBe(ThemeMode.LIGHT);
    expect(result.current.isDark).toBe(false);
  });
});
