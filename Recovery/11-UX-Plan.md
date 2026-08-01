# 11 — UX / UI Plan (تحسين واجهة وتجربة المستخدم)

> Current strengths/weaknesses from `OSS/18` (design system), `OSS/19` (i18n), `OSS/21` (components), `OSS/03` (screens). Phase 7 work.

## 1. Current Strengths (keep)

- Cairo Arabic-first font + forced RTL + professional design tokens (`theme/`).
- 4 theme modes (System/Light/Dark/AMOLED) with full palettes.
- Consistent `ScreenLayout`, atoms (Typography/Button/Input/Icon), empty/loading/error states.
- Vault color/icon customization on creation.

## 2. UX Defects to Fix

| Defect | Evidence | Fix | Phase |
|---|---|---|---|
| Language change → app reload → **logged out** | `OSS/19.6`, P0-1 | persist language; no full reload; session-aware redirect | 0.5/7.1 |
| Theme resets on restart | `OSS/18.1` | persist via SettingsRepository | 7.1 |
| Dead/unreachable screens (biometric-setup, create-folder) | `OSS/14.4` | wire or remove | 7.2 |
| Quick-exit on iOS just pushes welcome (no lock) | `OSS/03 §vault`, `OSS/02 §5` | lock-all then exit | 0.5/4.14 |
| Add-sheet note/password creation silently fails (FK) | P0-3 | pass vaultId; show errors | 0.7/3 |
| Settings shows toggles with no effect | `OSS/14.5` | implement (Phase 5) or hide | 7.4 |
| Imported media via Add sheet lands in wrong tab | `OSS/03 §vault` | unified import pipeline | 3.4 |
| Export produces corrupt files | R8 | binary write | 3.4 |
| No feedback on decrypt failure (shows `[encrypted]`) | R9 | typed error + toast | 0.8 |
| Hardcoded Arabic strings | `activity-log.tsx:79`, `settings.tsx:314` | i18n keys | 7.2 |

## 3. UX Priorities (v1.1)

1. **Trust & clarity**: show encryption state honestly; replace "كل شيء مشفر" claims until true; clear errors.
2. **Onboarding flow**:
   - Welcome → create vault (name/icon/color/PIN) → **offer biometrics now** (reachable screen) → enter vault.
   - Existing vaults → login with PIN/biometric + remember-me.
3. **Session UX**: opening app within timeout stays unlocked (if remember-me); auto-lock countdown on lock screen.
4. **Consistent empty/loading/error states** across tabs (already mostly there — keep).
5. **Media/Files**: unified import with progress; preview works for images/text; video placeholder → real player (optional).

## 4. Visual Refresh Items

| Item | Action |
|---|---|
| App icons | Use new `assets/` set (already added); rebuild APK (6.1) |
| Splash | uses new splash.png with brand; keep dark bg |
| Dynamic color (Android 12+) | optional: SYSTEM mode maps MaterialYou palette |
| Edge-to-edge (Android 15) | verify insets/contrast (6) |
| Micro-interactions | motion tokens exist (`motion.ts`); apply consistently |

## 5. Accessibility (a11y) Pass

- Touch targets ≥ 48dp (buttons/FAB/rows).
- `accessibilityLabel`/`role` on Icon buttons, SelectionBar, FAB.
- Contrast: verify primary/secondary on both themes; use `state.ts` tokens.
- RTL focus order + reading order in lists.
- TalkBack smoke test on login, vault, notes, settings.
- Reduce motion option (respect `reduceMotion`).

## 6. Navigation & Information Architecture

- Keep push-driven flow (hidden tab bar) — it's intentional; do **not** reintroduce visible tabs.
- Ensure all modals dismissable and back-stack clean after `replace`.
- Remove route guard bypass (P0-2) so deep links respect session.

## 7. Localization

- Persist `language` in settings; hydrate before first render; no reload needed.
- Remove hardcoded Arabic; ensure `en.json` parity (missing plural keys noted in audit).
- Locale-aware date formatting via `Intl` (fix `activity-log.tsx:79`).

## 8. UX Metrics to Verify (manual QA in Phase 7)

| Flow | Accept |
|---|---|
| First-run → vault created → unlock | < 3 steps, no dead ends |
| Language switch | stays logged in, RTL correct |
| Theme switch | persists after restart |
| Create note/password from vault | works, error-free |
| Import file → appears → preview | works |
| Export media | file opens correctly |
| Auto-lock | locks after timeout; PIN required |
| Quick-exit | locks, no back-door |

## 9. Design Tokens Governance

- All colors/spacing/type from `theme/` (already). No new hardcoded hex in screens.
- Components reused from atoms/molecules; remove dead components after Phase 1 (smaller bundle + less confusion).
