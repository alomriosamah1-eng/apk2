# الحزم المطلوبة للتثبيت

شغّل هذا الأمر في terminal في جذر المشروع:

```bash
npm install --legacy-peer-deps --save expo-build-properties@~0.13.0 expo-image-picker@~57.0.6
```

ثم:

```bash
npm install --legacy-peer-deps
```

لإتمام تحديث `package-lock.json` بعد تغيير `react-native-worklets` في `package.json`.
