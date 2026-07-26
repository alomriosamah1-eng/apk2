# البصمة والمصادقة الحيوية (Biometric Authentication)

## Supported Methods

- Fingerprint (بصمة الإصبع)
- Face Recognition (التعرف على الوجه)
- Iris (قزحية العين) - if device supports

## Implementation

Uses `expo-local-authentication` package:

```typescript
const { authenticate, isAvailable, isEnrolled, biometryType } = useBiometrics();
```

## Flow

1. Check if biometric hardware is available and enrolled
2. Display appropriate icon (fingerprint or face)
3. User taps "تفعيل البصمة/الوجه"
4. System biometric prompt appears
5. On success: save preference to SecureStorage
6. On failure: show error, allow retry

## Edge Cases

| Case | Behavior |
|------|----------|
| Device no biometrics | Button hidden |
| No fingerprints enrolled | Button disabled, message shown |
| User cancels prompt | Return to screen, no change |
| Too many attempts | Device handles lockout |
| Biometric changed | Next login requires password |
