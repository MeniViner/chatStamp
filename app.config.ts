const config = {
  name: 'WhatsApp Media TimeFixer',
  slug: 'whatsapp-media-timefixer',
  version: '0.1.0',
  orientation: 'portrait',
  scheme: 'watimefixer',
  userInterfaceStyle: 'automatic',
  assetBundlePatterns: ['**/*'],
  android: {
    package: 'com.local.whatsappmediatimefixer',
    permissions: [
      'READ_MEDIA_IMAGES',
      'READ_MEDIA_VIDEO',
      'READ_EXTERNAL_STORAGE',
      'WRITE_EXTERNAL_STORAGE'
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
    [
      'expo-font',
      {
        fonts: [
          './node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialCommunityIcons.ttf',
          './node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialIcons.ttf'
        ]
      }
    ],
    [
      'expo-media-library',
      {
        photosPermission: 'Allow WhatsApp Media TimeFixer to save selected photos with corrected dates.',
        savePhotosPermission: 'Allow WhatsApp Media TimeFixer to save selected media to your Gallery.',
        isAccessMediaLocationEnabled: true
      }
    ]
  ]
};

export default config;
