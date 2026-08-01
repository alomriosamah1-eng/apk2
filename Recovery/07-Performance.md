# 07 — Performance Plan (إعادة تصميم الأداء)

> Per-operation: current time, target time, causes, solutions, caching, lazy/virtualization, memoization, background processing, memory & battery. Sources: `oaa.md` measurements (APK size, `.so`), `OSS/27` (tests), `OSS/14`.

## 1. APK Size

| Metric | Current | Target |
|---|---|---|
| Release APK | **96.5 MB** (`khaznty.apk`) | ≤ 45 MB (stretch ≤ 35 MB) |
| `.so` (4 ABIs) | 75,664,596 B | one ABI ≈ 19 MB |

| Cause | Evidence | Solution |
|---|---|---|
| `reactNativeArchitectures=all` (arm64+v7a+x86+x86_64) | `gradle.properties` | `arm64-v8a` only (or +armeabi-v7a if required by market) |
| R8/minify disabled | `build.gradle:125` `enableMinifyInReleaseBuilds` default false | `enableMinifyInReleaseBuilds=true` + proguard |
| `assetBundlePatterns:"**/*"` bundles everything | `app.json:50` | explicit globs (`assets/**`) |
| Debug signing fallback (no real keystore) | secrets missing | add secrets (Phase 9) |

**Verify**: rebuild in CI; download artifact; `ls -lh`. Gate: ≤ 45 MB.

## 2. Login / Vault Create (hashPin)

| Metric | Current | Target |
|---|---|---|
| `hashPin` (100k sequential `await digestStringAsync`) | multi-second | < 500 ms |

**Cause**: 100k await-bridge round-trips (`secure.ts:48-57`).
**Solution**: PBKDF2-HMAC-SHA256 via native (JSI) primitive — one call, off JS thread; iterations from config. Fallback if no JSI crypto: batch or lower iterations documented.
**Verify**: `console.time` in release build; unit benchmark.

## 3. Media Encrypt / Decrypt

| Metric | Current | Target |
|---|---|---|
| Large image | minutes | < 2 s (photo), streaming for video |
| Memory | full base64 in JS heap | chunked |

**Cause**: SHA-256 per-32B-block stream over JS bridge (`crypto.ts`).
**Solution**: native AES-GCM chunked streaming; base64 only at boundaries; thumbnails generated once and cached (config `thumbnailsMaxWidth` exists).
**Verify**: import 12 MP photo; time in profile; heap check.

## 4. Boot Time

| Metric | Current | Target |
|---|---|---|
| App boot (fonts+DI+DB+migrations+integrity) | blocking (`_layout.tsx:20-77`) | < 1.5 s cold |

**Cause**: synchronous DB init + integrity check on main.
**Solution**: keep splash visible; run `integrityCheck` async/background; load fonts in parallel with DB (already sequential — parallelize); cache migrations status.
**Verify**: `expo-dev-menu` startup profile / `adb shell am start` timing.

## 5. Metro / Dev Performance

| Cause | Evidence | Solution |
|---|---|---|
| `fs.statSync` per module in alias resolver | `metro.config.js:7-43` | static alias map; cache; no sync FS |
| large asset bundle | `**/*` | explicit patterns |

## 6. UI / List Rendering

| Cause | Solution |
|---|---|
| Lists re-render wholesale; no `React.memo` | memoize `FileRow`, `MediaThumb`, `ItemRow`, note/password rows |
| `useVaults` re-resolves DI each render | resolve once (module-level or `useMemo`) |
| Search without debounce | `useDebounce` (exists, unused) — wire it (Phase 3) |
| No virtualization | use `FlatList` with `getItemLayout` + `initialNumToRender` for large lists (files/notes/passwords) |
| `Dimensions.get` in render | `useWindowDimensions` |
| Heavy re-renders from ThemeProvider | memoized context value; `useMemo` |

**Verify**: React DevTools flamegraph; scroll at 60fps in release.

## 7. Background Processing

- Crypto for large files on background thread (JS worklet / native).
- No background services (keep offline, battery-friendly).
- `withRetry` on DB writes is fine; don't retry user-cancelled ops.

## 8. Memory

| Fix | Benefit |
|---|---|
| Chunked file IO instead of whole-file base64 | prevents OOM on videos |
| Clear decrypted media temp after view/export | reduces footprint |
| Prune activity_log (cap 500) | DB growth |
| Thumbnails on disk (`.thumbs`) | memory |

## 9. Battery

- No polling/wakelocks; AppState-only.
- Lazy import/decrypt (never decrypt all media on load).

## 10. Caching Strategy

| Cache | Location | Invalidation |
|---|---|---|
| Decrypted notes/passwords (session) | memory | on lock / write |
| Thumbnails | `khaznati/.thumbs` | by mtime |
| Vault keys | memory (session) | on lock |
| i18n resources | bundled | n/a |

## 11. Benchmarks to Track (record at each phase gate)

| Op | Baseline | After Phase 2 |
|---|---|---|
| Cold boot | TBD | < 1.5 s |
| PIN login | TBD | < 500 ms |
| Encrypt 12MP | TBD | < 2 s |
| Import 50 MB file | TBD | streamed |
| APK size | 96.5 MB | ≤ 45 MB |
| Scroll 60fps | TBD | pass |
