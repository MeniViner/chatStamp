const config = {
  name: 'chatStamp',
  slug: 'chatstamp',
  version: '0.1.1',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'chatstamp',
  userInterfaceStyle: 'automatic',
  assetBundlePatterns: ['**/*'],
  android: {
    package: 'com.menis.chatstamp',
    versionCode: 2,
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
    permissions: [
      'MANAGE_EXTERNAL_STORAGE',
      'WRITE_EXTERNAL_STORAGE'
    ],
    blockedPermissions: [
      'android.permission.ACCESS_MEDIA_LOCATION',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.READ_MEDIA_AUDIO',
      'android.permission.READ_MEDIA_IMAGES',
      'android.permission.READ_MEDIA_VIDEO',
      'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
      'android.permission.RECORD_AUDIO'
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
    'expo-video',
    'expo-audio',
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
