# خزنتي (Khaznati) — Secure Vault App

A secure, offline-first vault application built with Expo SDK 54 and React Native 0.76.

## Features

- **Multiple Vaults** — Create separate vaults for personal, work, or shared use
- **File Storage** — Store images, videos, documents, and any file type securely
- **Secret Notes** — Encrypted text notes with rich formatting
- **Passwords** — Secure password management with generation
- **Biometric Auth** — Face ID / Fingerprint unlock
- **PIN Protection** — SHA-256 hashed PIN with constant-time comparison
- **AES-256-GCM Encryption** — File-level encryption for all stored data
- **SQLCipher Database** — Encrypted on-device SQLite database
- **Offline-First** — All data stored locally, no cloud dependency
- **Backup & Restore** — Encrypted `.kzb` backup format

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | Expo SDK 54 (React Native 0.76) |
| Language | TypeScript 5.3 |
| Navigation | Expo Router 4 (file-based) |
| Database | expo-sqlite 15 (SQLCipher) |
| Storage | expo-file-system + MMKV |
| Encryption | expo-crypto (AES-256-GCM, PBKDF2) |
| Auth | expo-local-authentication + custom PIN |
| Animation | react-native-reanimated 3 |
| UI | Custom neumorphism + glassmorphism |
| State | Zustand-style with useVaults hook |
| CI/CD | GitHub Actions + EAS Build |

## Architecture

Clean Architecture with 4 layers:

```
app/          → Expo Router screens (presentation)
src/ui/       → UI components, hooks, providers
src/domain/   → Entities, repository interfaces, use cases (pure TS)
src/data/     → Database, DTOs, mappers, repository implementations
src/core/     → DI container, theme, utilities, errors, constants
```

## Setup

```bash
# Install dependencies
npm install

# Start dev server
npx expo start

# Build Android APK
npx eas build --platform android --profile preview

# Run tests
npm test
```

### Offline Install

```bash
bash scripts/install-offline.sh
```

## Project Structure

```
├── app/                    # Expo Router screens
│   ├── (auth)/             # Authentication flow
│   └── (app)/              # Main app (tabs + modals)
├── src/
│   ├── core/               # DI, theme, utilities, errors
│   ├── data/               # Database, DTOs, mappers, repos
│   ├── domain/             # Entities, interfaces, use cases
│   └── ui/                 # Components, hooks, providers
├── docs/                   # Architecture & audit documentation
├── scripts/                # Utility scripts
└── .github/workflows/      # CI/CD pipelines
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start Expo dev server |
| `npm run android` | Start with Android |
| `npm run lint` | ESLint check |
| `npm run typecheck` | TypeScript check |
| `npm test` | Run Jest tests |
| `npm run format` | Prettier format |
| `npm run clean` | Clear Expo cache |

## Security

- **Zero SQL Injection** — All queries parameterized
- **Constant-Time PIN** — No timing side-channel leaks
- **Crypto-Safe Random** — `expo-crypto` for all randomness
- **Secure Deletion** — Overwrite with random bytes before delete
- **Input Validation** — Declarative rules for all public APIs
- **Session Lock** — Auto-lock after 60s of inactivity
- **Clipboard Clear** — Auto-clear after 10s

## License

Private — All rights reserved.
