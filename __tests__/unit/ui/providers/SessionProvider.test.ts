import { renderHook, act } from '@testing-library/react-native';
import { SessionProvider, useSession } from '@ui/providers/SessionProvider';

jest.mock('expo-router', () => ({
  router: {
    replace: jest.fn(),
    push: jest.fn(),
    back: jest.fn(),
  },
}));

const mockSetItem = jest.fn(async () => {});
const mockGetItem = jest.fn(async () => null);

jest.mock('@core/di/container', () => ({
  DIContainer: {
    resolve: jest.fn(() => ({
      get: mockGetItem,
      set: mockSetItem,
    })),
  },
}));

describe('SessionProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('starts locked with no active vault', () => {
    const { result } = renderHook(() => useSession(), {
      wrapper: SessionProvider,
    });
    expect(result.current.isUnlocked).toBe(false);
    expect(result.current.activeVaultId).toBeNull();
  });

  it('unlocks a vault and sets the active id', () => {
    const { result } = renderHook(() => useSession(), {
      wrapper: SessionProvider,
    });
    act(() => {
      result.current.unlock('vault-1');
    });
    expect(result.current.isUnlocked).toBe(true);
    expect(result.current.activeVaultId).toBe('vault-1');
    expect(result.current.lastActivityTime).not.toBeNull();
  });

  it('locks the session and clears the active vault', () => {
    const { result } = renderHook(() => useSession(), {
      wrapper: SessionProvider,
    });
    act(() => {
      result.current.unlock('vault-1');
    });
    act(() => {
      result.current.lock();
    });
    expect(result.current.isUnlocked).toBe(false);
    expect(result.current.activeVaultId).toBeNull();
  });

  it('unlock then lock are idempotent', () => {
    const { result } = renderHook(() => useSession(), {
      wrapper: SessionProvider,
    });
    act(() => {
      result.current.lock();
      result.current.lock();
    });
    expect(result.current.isUnlocked).toBe(false);
  });
});
