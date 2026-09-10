import { baseConfig, universalZone } from '@session/eslint-config'

export default [
  ...baseConfig({ tsconfigRootDir: import.meta.dirname, zone: universalZone }),
  // Generator input rather than code, and outside the tsconfig for that reason: each file is a
  // construct the generator has to refuse, and one of them is a circular alias TypeScript
  // refuses first. Linting them would only report that they are not in a project.
  { ignores: ['tests/fixtures/invalid/**'] },
]
