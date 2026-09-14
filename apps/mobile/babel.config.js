module.exports = function babelConfig(api) {
  api.cache(true)

  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'react' }]],
    plugins: [
      [
        '@tamagui/babel-plugin',
        {
          components: ['tamagui', '@session/ui'],
          // The same file the desktop build reads, so a token added once exists on both.
          config: '../../packages/ui/src/config.ts',
          logTimings: true,
        },
      ],
      // Last, and it has to stay last: it rewrites the worklets every other plugin has finished
      // with. react-native-reanimated is what drives the keyboard avoidance off the JS thread,
      // and it does nothing at all without this.
      'react-native-worklets/plugin',
    ],
    env: {
      production: {
        plugins: [
          // testID is automation-only and never announced by a screen reader, but there is
          // no reason to ship it. QA builds keep it, which is what the e2e suite drives.
          ['react-remove-properties', { properties: ['testID'] }],
        ],
      },
    },
  }
}
