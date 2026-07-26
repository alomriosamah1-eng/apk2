# التنقل (Navigation)

## Router Structure

```
app/
├── _layout.tsx          ← Root: ThemeProvider + DB init
├── index.tsx            ← Redirect to welcome
├── (auth)/
│   ├── _layout.tsx      ← Stack: fade animation
│   ├── welcome.tsx      ← Onboarding
│   ├── create-vault.tsx ← Vault creation wizard
│   ├── login.tsx        ← Password/biometric login
│   └── biometric-setup.tsx ← Biometric enrollment
├── (app)/
│   ├── _layout.tsx      ← Stack: (tabs) + modals
│   ├── (tabs)/
│   │   ├── _layout.tsx  ← Tab navigator (6 tabs)
│   │   ├── vault.tsx    ← Vault list
│   │   ├── files.tsx    ← File manager
│   │   ├── media.tsx    ← Media gallery
│   │   ├── notes.tsx    ← Notes CRUD
│   │   ├── passwords.tsx← Password manager
│   │   └── settings.tsx ← Settings
│   └── modals/
│       ├── _layout.tsx  ← Modal stack
│       ├── create-folder.tsx
│       └── file-preview.tsx
```

## Navigation Rules

- Auth screens use fade animation
- App screens use slide_from_right
- Modals use slide_from_bottom + presentation: 'modal'
- All headers hidden (custom headers via ScreenLayout)
- Tab bar: 6 tabs with icons, primary color for active
