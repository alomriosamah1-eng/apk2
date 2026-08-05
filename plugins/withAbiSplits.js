/**
 * Config plugin: split the Android release build into one APK per CPU ABI
 * (arm64-v8a, armeabi-v7a, x86, x86_64), `universalApk false`.
 *
 * Why: a universal APK bundles all 4 ABIs and ships ~90MB+. Splitting keeps
 * each ABI's APK ~30MB while remaining compatible with every Android device
 * (minSdk 24 => Android 7.0+). Per-ABI APKs are emitted with default names
 * (e.g. app-arm64-v8a-release.apk) under the release outputs dir.
 */
const { withAppBuildGradle } = require('@expo/config-plugins');

const SPLITS_BLOCK = `
// ==== khaznati: per-ABI splits (config plugin) ==== //
splits {
    abi {
        enable true
        include 'arm64-v8a', 'armeabi-v7a', 'x86', 'x86_64'
        universalApk false
    }
}
// ==== end ABI splits ==== //
`;

module.exports = function withAbiSplits(config) {
  return withAppBuildGradle(config, (c) => {
    if (c.modResults.contents.includes('per-ABI splits (config plugin)')) {
      return c;
    }
    const marker = 'android {';
    const idx = c.modResults.contents.indexOf(marker);
    if (idx === -1) {
      return c;
    }
    const insertAt = c.modResults.contents.indexOf('\n', idx) + 1;
    c.modResults.contents =
      c.modResults.contents.slice(0, insertAt) + SPLITS_BLOCK + c.modResults.contents.slice(insertAt);
    return c;
  });
};