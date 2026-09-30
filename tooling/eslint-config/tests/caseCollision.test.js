import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { RuleTester } from 'eslint'
import { afterAll, describe, it } from 'vitest'

import { caseCollision } from '#src/caseCollision'

RuleTester.describe = describe
RuleTester.it = it

// Built at run time: committed fixtures that collide would break a checkout on macOS.
const root = mkdtempSync(join(tmpdir(), 'case-collision-'))
afterAll(() => rmSync(root, { recursive: true, force: true }))

function directoryOf(...names) {
  const dir = mkdtempSync(join(root, 'dir-'))
  for (const name of names) {
    if (name.endsWith('/')) mkdirSync(join(dir, name))
    else writeFileSync(join(dir, name), '')
  }
  return dir
}

const collides = (name, other) => ({ messageId: 'collides', data: { name, other } })

const helperBesideComponent = directoryOf('Sheet.tsx', 'sheet.ts')
const variants = directoryOf('Icon.tsx', 'Icon.native.tsx', 'Icon.types.ts', 'icon.test.ts')
const folderBesideFile = directoryOf('Chat.tsx', 'chat/')
const sameSpelling = directoryOf('routes.ts', 'routes.d.ts')

new RuleTester().run('case-collision', caseCollision, {
  valid: [
    { code: '', filename: join(variants, 'Icon.tsx') },
    { code: '', filename: join(variants, 'Icon.native.tsx') },
    { code: '', filename: join(sameSpelling, 'routes.ts') },
    { code: '', filename: '<input>' },
  ],
  invalid: [
    {
      code: '',
      filename: join(helperBesideComponent, 'Sheet.tsx'),
      errors: [collides('Sheet.tsx', 'sheet.ts')],
    },
    {
      code: '',
      filename: join(helperBesideComponent, 'sheet.ts'),
      errors: [collides('sheet.ts', 'Sheet.tsx')],
    },
    {
      code: '',
      filename: join(folderBesideFile, 'Chat.tsx'),
      errors: [collides('Chat.tsx', 'chat')],
    },
  ],
})
