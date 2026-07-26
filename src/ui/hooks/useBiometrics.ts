import { useState, useCallback } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

interface BiometricsState {
  isAvailable: boolean;
  isEnrolled: boolean;
  biometryType: LocalAuthentication.AuthenticationType | null;
}

export function useBiometrics() {
  const [state, setState] = useState<BiometricsState>({
    isAvailable: false,
    isEnrolled: false,
    biometryType: null,
  });

  const checkBiometrics = useCallback(async () => {
    if (Platform.OS === 'web') {
      setState({ isAvailable: false, isEnrolled: false, biometryType: null });
      return;
    }

    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();

    setState({
      isAvailable: hasHardware && isEnrolled,
      isEnrolled,
      biometryType: supportedTypes[0] ?? null,
    });
  }, []);

  const authenticate = useCallback(async (
    promptMessage: string = 'Authenticate to access Khaznati',
  ): Promise<boolean> => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage,
        fallbackLabel: 'Use PIN',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });
      return result.success;
    } catch {
      return false;
    }
  }, []);

  return {
    ...state,
    checkBiometrics,
    authenticate,
  };
}
