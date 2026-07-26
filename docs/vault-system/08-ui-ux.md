# تجربة المستخدم (UI/UX)

## Design System

- **Framework**: Material Design 3
- **Font**: Cairo (خط عربي احترافي)
- **RTL**: Full right-to-left support
- **Themes**: Light, Dark, AMOLED (pure black)
- **Effects**: Glassmorphism, Neumorphism

## Font Setup

- Cairo font loaded via `@expo-google-fonts/cairo`
- Weights: 400 (Regular), 500 (Medium), 600 (SemiBold), 700 (Bold)
- Applied to all typography variants in `src/core/theme/typography.ts`
- Mono font: system monospace (for code)

## RTL Implementation

- `I18nManager.forceRTL()` on language switch
- `I18nManager.swapLeftAndRightInRTL()` on language switch
- All UI components use RTL-aware layout
- Icons mirrored where appropriate (arrows, chevrons)

## Arabic-First Principles

1. All UI text in Arabic (labels, buttons, errors, placeholders)
2. English is fallback only
3. Dates formatted for Arabic locale
4. Number formatting respects Arabic numerals

## Screen Requirements

| Screen | Status | Notes |
|--------|--------|-------|
| Welcome | ✅ | Gradient hero, feature cards |
| Create Vault | ✅ | Icon grid, color picker, password meter |
| Login | ✅ | Password field, biometric, remember-me |
| Biometric Setup | ✅ | Device-specific icon, skip option |
| Vault Home | ✅ | FlashList vault cards |
| Files | ✅ | File list, import, search |
| Media | ✅ | Image grid with permissions |
| Notes | ✅ | CRUD, pin, search |
| Passwords | ✅ | CRUD, generate, copy, categories |
| Settings | ✅ | All toggles and handlers |
