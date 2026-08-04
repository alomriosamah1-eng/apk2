import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import { Snackbar } from '@ui/components/atoms/Snackbar';

interface SnackbarContextValue {
  show: (message: string, options?: { actionLabel?: string; onAction?: () => void; duration?: number }) => void;
}

const SnackbarContext = createContext<SnackbarContextValue | null>(null);

export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [options, setOptions] = useState<{ actionLabel?: string; onAction?: () => void; duration?: number }>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback<SnackbarContextValue['show']>((msg, opts = {}) => {
    setMessage(msg);
    setOptions(opts);
    setVisible(true);
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const handleDismiss = useCallback(() => {
    setVisible(false);
  }, []);

  return (
    <SnackbarContext.Provider value={{ show }}>
      {children}
      <Snackbar
        visible={visible}
        message={message}
        actionLabel={options.actionLabel}
        onAction={options.onAction}
        onDismiss={handleDismiss}
        duration={options.duration}
      />
    </SnackbarContext.Provider>
  );
}

export function useSnackbar(): SnackbarContextValue {
  const ctx = useContext(SnackbarContext);
  if (!ctx) throw new Error('useSnackbar must be used within SnackbarProvider');
  return ctx;
}