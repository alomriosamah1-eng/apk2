import { useState, useCallback, useEffect } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

export type BiometricType = 'face' | 'fingerprint' | 'iris' | null;

interface BiometricsState {
  isAvailable: boolean;
  isEnrolled: boolean;
  biometryType: BiometricType;
}

function mapAuthType(type: LocalAuthentication.AuthenticationType): BiometricType {
  switch (type) {
    case LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION:
      return 'face';
    case LocalAuthentication.AuthenticationType.FINGERPRINT:
      return 'fingerprint';
    case LocalAuthentication.AuthenticationType.IRIS:
      return 'iris';
    default:
      return null;
  }
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

    const preferred = supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
      ? LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION
      : supportedTypes.includes(LocalAuthentication.AuthenticationType.IRIS)
        ? LocalAuthentication.AuthenticationType.IRIS
        : supportedTypes[0] ?? null;

    setState({
      isAvailable: hasHardware && isEnrolled && preferred !== null,
      isEnrolled,
      biometryType: preferred ? mapAuthType(preferred) : null,
    });
  }, []);

  useEffect(() => { checkBiometrics(); }, [checkBiometrics]);

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
