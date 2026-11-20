const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  {
    ignores: [
      'dist/**',
      'android/**',
      'ios/**',
      'coverage/**',
      'modules/chatstamp-native/android/build/**',
      'scripts/android-verification/probe/build/**',
    ],
  },
];
