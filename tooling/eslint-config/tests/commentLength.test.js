import { RuleTester } from 'eslint'
import { describe, it } from 'vitest'

import { commentLength } from '#src/commentLength'

RuleTester.describe = describe
RuleTester.it = it

const at = (columns) => 'x'.repeat(columns)
const tooLong = (length) => ({
  messageId: 'tooLong',
  data: { length: String(length), limit: '100' },
})

new RuleTester().run('comment-length', commentLength, {
  valid: [
    { code: `// ${at(97)}` },
    { code: `/**\n * ${at(97)}\n */` },
    // An address is one token, and breaking it would break it.
    { code: `// see https://example.org/${at(120)}` },
    // Code is prettier's to wrap; only lines a comment is on are measured.
    { code: `const s = '${at(120)}'` },
  ],
  invalid: [
    { code: `// ${at(98)}`, errors: [tooLong(101)] },
    { code: `/**\n * ${at(98)}\n * short\n */`, errors: [tooLong(101)] },
    { code: `const a = 1 // ${at(90)}`, errors: [tooLong(105)] },
  ],
})
