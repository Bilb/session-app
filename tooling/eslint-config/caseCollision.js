import { readdirSync } from 'node:fs'
import { basename, dirname, isAbsolute } from 'node:path'

const SOURCE_EXTENSION = /\.(d\.ts|[cm]?[jt]sx?)$/

/** A name as an import specifier sees it: extensionless, since the resolver supplies that part. */
function specifierOf(name) {
  return name.replace(SOURCE_EXTENSION, '')
}

/**
 * Refuses a file whose name matches a sibling's once the extension is dropped and case is ignored,
 * while being spelled differently.
 *
 * On a case-insensitive filesystem, the macOS default, `./Sheet` then resolves to whichever of
 * `Sheet.tsx` and `sheet.ts` the resolver tries first - `.ts` before `.tsx` - and nothing on Linux,
 * where CI runs, can notice.
 *
 * @type {import('eslint').Rule.RuleModule}
 */
export const caseCollision = {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow sibling files whose import paths differ only in case' },
    schema: [],
    messages: {
      collides:
        '`{{name}}` and `{{other}}` differ only in case, so on a case-insensitive filesystem ' +
        '(macOS by default) an import of one can resolve to the other. Rename one of them after ' +
        'what it holds.',
    },
  },
  create(context) {
    const file = context.physicalFilename
    // Text piped in on stdin has no directory to compare against.
    if (!isAbsolute(file)) return {}

    return {
      Program(node) {
        const name = basename(file)
        const own = specifierOf(name)
        for (const other of readdirSync(dirname(file))) {
          const theirs = specifierOf(other)
          if (theirs !== own && theirs.toLowerCase() === own.toLowerCase()) {
            context.report({ node, messageId: 'collides', data: { name, other } })
          }
        }
      },
    }
  },
}
