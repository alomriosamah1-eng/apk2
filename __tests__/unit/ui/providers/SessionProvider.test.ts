import { renderHook, act, waitFor } from '@testing-library/react-native';
import { SessionProvider, useSession } from '@ui/providers/SessionProvider';

jest.mock('expo-router', () => ({
  router: {
    replace: jest.fn(),
    push: jest.fn(),
    back: jest.fn(),
  },
}));

const mockSetItem = jest.fn(async () => {});
const mockGetItem = jest.fn(async (_key?: string): Promise<string | null> => null);
const mockDeleteItem = jest.fn(async () => {});

jest.mock('@core/di/container', () => ({
  DIContainer: {
    resolve: jest.fn(() => ({
      get: mockGetItem,
      set: mockSetItem,
      delete: mockDeleteItem,
    })),
  },
}));

async function renderSession() {
  const { result } = renderHook(() => useSession(), {
    wrapper: SessionProvider,
  });
  await waitFor(() => expect(result.current.hydrated).toBe(true));
  return result;
}

describe('SessionProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetItem.mockResolvedValue(null);
  });

  it('starts locked with no active vault', async () => {
    const result = await renderSession();
    expect(result.current.isUnlocked).toBe(false);
    expect(result.current.activeVaultId).toBeNull();
    expect(result.current.hydrated).toBe(true);
  });

  it('unlocks a vault and sets the active id', async () => {
    const result = await renderSession();
    act(() => {
      result.current.unlock('vault-1');
    });
    expect(result.current.isUnlocked).toBe(true);
    expect(result.current.activeVaultId).toBe('vault-1');
    expect(result.current.lastActivityTime).not.toBeNull();
  });

  it('unlock with remember persists the session', async () => {
    const result = await renderSession();
    act(() => {
      result.current.unlock('vault-1', true);
    });
    expect(mockSetItem).toHaveBeenCalledWith(
      'khaznati_active_session',
      expect.stringContaining('"vaultId":"vault-1"'),
    );
  });

  it('unlock without remember does not persist the session', async () => {
    const result = await renderSession();
    act(() => {
      result.current.unlock('vault-1', false);
    });
    expect(mockSetItem).not.toHaveBeenCalledWith(
      'khaznati_active_session',
      expect.anything(),
    );
  });

  it('locks the session and clears the active vault', async () => {
    const result = await renderSession();
    act(() => {
      result.current.unlock('vault-1');
    });
    act(() => {
      result.current.lock();
    });
    expect(result.current.isUnlocked).toBe(false);
    expect(result.current.activeVaultId).toBeNull();
  });

  it('lock deletes the persisted session', async () => {
    const result = await renderSession();
    act(() => {
      result.current.unlock('vault-1', true);
    });
    act(() => {
      result.current.lock();
    });
    expect(mockDeleteItem).toHaveBeenCalledWith('khaznati_active_session');
  });

  it('unlock then lock are idempotent', async () => {
    const result = await renderSession();
    act(() => {
      result.current.lock();
      result.current.lock();
    });
    expect(result.current.isUnlocked).toBe(false);
  });

  it('hydrates a remembered session on boot', async () => {
    mockGetItem.mockImplementation(async (key?: string): Promise<string | null> => {
      if (key === 'khaznati_active_session') {
        return JSON.stringify({ vaultId: 'vault-9', lastActivityTime: Date.now() });
      }
      return null;
    });
    const result = await renderSession();
    expect(result.current.isUnlocked).toBe(true);
    expect(result.current.activeVaultId).toBe('vault-9');
  });
});
