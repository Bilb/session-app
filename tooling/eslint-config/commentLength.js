/** Prettier's print width, which the comments are held to as well. */
const LIMIT = 100

/** An address cannot be broken across lines, so a line carrying one may run long. */
const URL = /\bhttps?:\/\/\S+/

/**
 * Refuses a comment line longer than the print width.
 *
 * Prettier wraps code but never a comment, and nothing else measured them: a sentence edited into
 * the middle of a paragraph, or a block of comments indented one level deeper, simply ran past the
 * edge. Every line a comment occupies is measured whole, so a trailing comment counts with the code
 * before it.
 *
 * @type {import('eslint').Rule.RuleModule}
 */
export const commentLength = {
  meta: {
    type: 'layout',
    docs: { description: `Disallow comment lines longer than ${String(LIMIT)} columns` },
    schema: [],
    messages: {
      tooLong:
        'This comment line is {{length}} columns, over the {{limit}} the code is printed at. ' +
        'Rewrap the paragraph: prettier does not wrap comments.',
    },
  },
  create(context) {
    const source = context.sourceCode
    return {
      Program() {
        const reported = new Set()
        for (const comment of source.getAllComments()) {
          for (let line = comment.loc.start.line; line <= comment.loc.end.line; line += 1) {
            const text = source.lines[line - 1] ?? ''
            if (text.length <= LIMIT || URL.test(text) || reported.has(line)) continue
            reported.add(line)
            context.report({
              loc: { start: { line, column: LIMIT }, end: { line, column: text.length } },
              messageId: 'tooLong',
              data: { length: String(text.length), limit: String(LIMIT) },
            })
          }
        }
      },
    }
  },
}
