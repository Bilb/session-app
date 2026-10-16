import { baseConfig, universalZone } from '@session/eslint-config'

export default [
  ...baseConfig({ tsconfigRootDir: import.meta.dirname, zone: universalZone }),
  {
    // CommonJS, so Metro's `require`-loaded config can use it without a loader.
    files: ['src/**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { require: 'readonly', module: 'writable' },
    },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
]
