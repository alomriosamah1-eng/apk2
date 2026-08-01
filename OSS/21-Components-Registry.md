# 21 — Components Registry

UI component inventory under `src/ui/components/` (atoms / molecules / organisms). All re-exported from barrel `components/index.ts`.

## 21.1 Atoms (11)

| Component | Used by | Notes |
|---|---|---|
| `Typography` | everywhere | variant system + color prop |
| `Button` | auth screens, sheets, settings | variants primary/ghost/glass |
| `Input` | auth, passwords, create-folder | labels, error, secure toggle |
| `Card` | settings, about | variant filled/outlined, padding |
| `Icon` | everywhere | wraps MaterialCommunityIcons with glyph map typing |
| `Loading` | all screens | fullScreen mode |
| `ErrorView` | files/media/notes/passwords, file-preview | retry button |
| `EmptyState` | files/media/notes/passwords | icon/title/desc/action |
| `Divider` | settings, screen rows | |
| `Skeleton` | **unused** | dead |
| `Snackbar` | **unused** | dead |

## 21.2 Molecules (10)

| Component | Used by | Notes |
|---|---|---|
| `Header` | ScreenLayout only | title/subtitle/back/right-action |
| `SearchBar` | files/media/notes/passwords | search + clear |
| `FloatingButton` | files/media/notes/passwords | FAB |
| `FileRow` | FilesList | row + selection |
| `MediaThumb` | MediaGallery | thumb + selection |
| `MediaGallery` | media.tsx | gallery grid + refresh |
| `MediaPreview` | media.tsx | full preview + export |
| `BottomSheet` | **unused** | dead (AddOptionsSheet uses Modal) |
| `Dialog` | **unused** | dead |
| `GlassCard` | **unused** | dead |

## 21.3 Organisms (8)

| Component | Used by | Notes |
|---|---|---|
| `ScreenLayout` | every screen | status bar, header, safe area, edges |
| `AddOptionsSheet` | vault.tsx | add-file/photo/video/audio/note/password/exit |
| `VaultListSheet` | vault.tsx | vault switcher + create |
| `FilesList` | files.tsx | list + EmptyState + refresh |
| `SelectionBar` | files/media/notes/passwords | bulk action bar |
| `RenameEditor` | files.tsx | inline rename |
| `VaultCard` | **unused** | dead |
| `ItemRow` | **unused** | dead |

## 21.4 Templates

`templates/index.ts` — empty placeholder (no templates implemented).

## 21.5 Component → Screen Matrix

| Screen | ScreenLayout | Typography | Icon | Button | Input | Card | SearchBar | SelectionBar | FAB | Empty/Error/Loading |
|---|---|---|---|---|---|---|---|---|---|---|
| welcome | | ✓ | ✓ | ✓ | | | | | | |
| create-vault | | ✓ | ✓ | ✓ | ✓ | | | | | |
| login | | ✓ | ✓ | ✓ | ✓ | | | | | |
| biometric-setup | | ✓ | ✓ | ✓ | | | | | | |
| vault | ✓ | ✓ | ✓ | | | | | | ✓ | |
| files | ✓ | | | | | | ✓ | ✓ | ✓ | ✓ |
| media | ✓ | | | | | | ✓ | ✓ | ✓ | ✓ |
| notes | ✓ | ✓ | ✓ | | | | ✓ | ✓ | ✓ | ✓ |
| passwords | ✓ | ✓ | ✓ | ✓ | ✓ | | ✓ | ✓ | ✓ | ✓ |
| settings | ✓ | ✓ | ✓ | | | ✓ | | | | |
| modals (4) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | | | | ✓ |

## 21.6 Usage Stats (verified)

- `ScreenLayout` imported by all 10 main screens + 4 modals.
- `EmptyState`: 4 screens (`files/media/notes/passwords`).
- `SelectionBar`: 4 screens.
- `FloatingButton`: 3 screens (files/media/notes/passwords → 4 actually; files:284, media:214, notes:270, passwords:305).
- Dead components: 7 (see table) — see `14-Hidden-Features.md`.
