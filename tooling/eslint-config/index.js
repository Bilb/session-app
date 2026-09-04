import js from '@eslint/js'
import importX from 'eslint-plugin-import-x'
import tseslint from 'typescript-eslint'

import {
  desktopMainZone,
  desktopRendererZone,
  mobileAppZone,
  sharedZone,
  uiZone,
  universalZone,
} from './zones.js'

export { desktopMainZone, desktopRendererZone, mobileAppZone, sharedZone, uiZone, universalZone }

/**
 * The repo-wide base, plus this package's zone.
 *
 * The zone is passed in rather than appended by the caller so that it lands before the
 * test-file override: a zone spread after it would silently switch the import rules back on
 * for tests, which is where the fake is supposed to be used.
 *
 * @param {{ tsconfigRootDir: string, zone?: import('eslint').Linter.RulesRecord }} options
 */
export function baseConfig({ tsconfigRootDir, zone }) {
  return tseslint.config(
    { ignores: ['dist/**', 'out/**', 'build/**', 'coverage/**', '**/gen/**', '**/generated/**'] },
    js.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,
    {
      languageOptions: {
        parserOptions: { projectService: true, tsconfigRootDir },
      },
      plugins: { 'import-x': importX },
      settings: {
        'import-x/resolver': { typescript: { alwaysTryTypes: true } },
      },
      rules: {
        '@typescript-eslint/no-unused-vars': [
          'error',
          { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
        ],
        '@typescript-eslint/consistent-type-imports': [
          'error',
          { fixStyle: 'separate-type-imports' },
        ],
        '@typescript-eslint/no-floating-promises': 'error',
        '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: false }],
        '@typescript-eslint/await-thenable': 'error',
        '@typescript-eslint/no-unnecessary-type-assertion': 'error',
        '@typescript-eslint/no-explicit-any': 'warn',
        '@typescript-eslint/no-unsafe-argument': 'warn',
        '@typescript-eslint/no-unsafe-assignment': 'warn',
        '@typescript-eslint/no-unsafe-call': 'warn',
        '@typescript-eslint/no-unsafe-member-access': 'warn',
        '@typescript-eslint/no-unsafe-return': 'warn',

        // Walking into node_modules makes this rule parse react-native's Flow entry point.
        'import-x/no-cycle': ['error', { ignoreExternal: true }],
        'import-x/no-self-import': 'error',
        'import-x/no-duplicates': 'error',
        // TypeScript resolves without extensions; ".js" is not this repo's convention.
        'import-x/extensions': ['error', 'never', { json: 'always' }],

        'no-restricted-syntax': [
          'error',
          {
            selector: 'TSImportType',
            message:
              "Add a top-level `import type { T } from '...'` instead of an inline import() type.",
          },
        ],
      },
    },
    {
      // Platform variants have no tsconfig that owns them: apps/mobile typechecks the
      // .native ones through moduleSuffixes, and the desktop renderer the plain ones.
      files: ['**/*.native.ts', '**/*.native.tsx', '**/*.web.ts', '**/*.web.tsx'],
      extends: [tseslint.configs.disableTypeChecked],
    },
    {
      // Config files sit outside every tsconfig's `include`, so the project service has no
      // types for them. They are plain ESM and there is nothing type-aware worth asserting.
      files: ['**/*.config.{js,mjs,cjs,ts}', '**/*.cjs'],
      extends: [tseslint.configs.disableTypeChecked],
    },
    ...(zone ? [{ rules: zone }] : []),
    {
      files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx'],
      rules: {
        '@typescript-eslint/no-non-null-assertion': 'off',
        // The zone matrix is editor feedback for production code. Tests legitimately reach
        // for the fake and for platform modules, and dependency-cruiser — which is the
        // authority — already encodes which of those are allowed and where.
        'no-restricted-imports': 'off',
      },
    },
  )
}
