const config = {
  name: 'chatStamp',
  slug: 'chatstamp',
  version: '0.2.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'chatstamp',
  userInterfaceStyle: 'automatic',
  assetBundlePatterns: ['**/*'],
  android: {
    package: 'com.menis10tec.chatstamp',
    versionCode: 14,
    allowBackup: false,
    icon: './assets/icon.png',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      monochromeImage: './assets/monochrome-icon.png',
      backgroundColor: '#FFFFFF'
    },
    locales: {
      en: './android/app/src/main/res/values/strings.xml',
      he: './android/app/src/main/res/values-he/strings.xml'
    },
    blockedPermissions: [
      'android.permission.MANAGE_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.ACCESS_MEDIA_LOCATION',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.READ_MEDIA_AUDIO',
      'android.permission.READ_MEDIA_IMAGES',
      'android.permission.READ_MEDIA_VIDEO',
      'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
      'android.permission.RECORD_AUDIO',
      'android.permission.INTERNET',
      'android.permission.ACCESS_NETWORK_STATE',
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.MODIFY_AUDIO_SETTINGS',
      'android.permission.VIBRATE',
      'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
      'com.google.android.finsky.permission.BIND_GET_INSTALL_REFERRER_SERVICE'
    ],
    intentFilters: [
      {
        action: 'SEND',
        category: ['DEFAULT'],
        data: [
          { mimeType: 'application/zip' },
          { mimeType: 'application/x-zip-compressed' }
        ]
      },
      {
        action: 'SEND_MULTIPLE',
        category: ['DEFAULT'],
        data: [
          { mimeType: 'application/zip' },
          { mimeType: 'application/x-zip-compressed' }
        ]
      },
      {
        action: 'VIEW',
        category: ['DEFAULT', 'BROWSABLE'],
        data: [
          { scheme: 'content', mimeType: 'application/zip' },
          { scheme: 'content', mimeType: 'application/x-zip-compressed' },
          { scheme: 'file', mimeType: 'application/zip' },
          { scheme: 'file', mimeType: 'application/x-zip-compressed' }
        ]
      }
    ]
  },
  plugins: [
    './plugins/withChatStampAndroidRelease',
    ['expo-video', { supportsBackgroundPlayback: false, supportsPictureInPicture: false }],
    ['expo-audio', { recordAudioAndroid: false, microphonePermission: false, enableBackgroundRecording: false, enableBackgroundPlayback: false }],
    'expo-image',
    [
      'expo-font',
      {
        fonts: [
          './node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialCommunityIcons.ttf',
          './node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialIcons.ttf'
        ]
      }
    ]
  ]
};

export default config;
