const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  {
    ignores: [
      'dist/**',
      'android/**',
      'ios/**',
      'coverage/**',
      'scripts/android-verification/probe/build/**',
    ],
  },
];
