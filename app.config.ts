const config = {
  name: 'chatStamp',
  slug: 'chatstamp',
  version: '0.1.0',
  orientation: 'portrait',
  scheme: 'chatstamp',
  userInterfaceStyle: 'automatic',
  assetBundlePatterns: ['**/*'],
  android: {
    package: 'com.local.chatstamp',
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
          { mimeType: 'application/x-zip-compressed' },
          { mimeType: 'application/octet-stream' },
          { mimeType: '*/*' }
        ]
      },
      {
        action: 'SEND_MULTIPLE',
        category: ['DEFAULT'],
        data: [
          { mimeType: 'application/zip' },
          { mimeType: 'application/x-zip-compressed' },
          { mimeType: 'application/octet-stream' },
          { mimeType: '*/*' }
        ]
      },
      {
        action: 'VIEW',
        category: ['DEFAULT', 'BROWSABLE'],
        data: [
          { scheme: 'content', mimeType: 'application/zip' },
          { scheme: 'content', mimeType: 'application/x-zip-compressed' },
          { scheme: 'content', mimeType: 'application/octet-stream' },
          { scheme: 'content', mimeType: '*/*' },
          { scheme: 'file', mimeType: 'application/zip' },
          { scheme: 'file', mimeType: 'application/x-zip-compressed' },
          { scheme: 'file', mimeType: 'application/octet-stream' },
          { scheme: 'file', mimeType: '*/*' }
        ]
      }
    ]
  },
  plugins: [
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
