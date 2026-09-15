import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { generate } from '#src/generate'

const fixtures = join(import.meta.dirname, 'fixtures')
const expected = join(fixtures, 'expected')

/**
 * The generated C++ is committed and CI runs codegen:check against it, so the generator's own
 * regression test is a golden one: the fixture covers every construct once, and this compares
 * what comes out with what was reviewed. `UPDATE_GOLDEN=1 pnpm test` rewrites the expectation
 * after an intentional change.
 */
describe('bridge codegen', () => {
  const files = generate({
    entryFile: join(fixtures, 'sample.ts'),
    roots: ['Frame', 'Request'],
    sourceLabel: 'tests/fixtures/sample.ts',
  })

  for (const name of ['types.hpp', 'jsi.hpp', 'napi.hpp'] as const) {
    it(`emits ${name} as reviewed`, () => {
      const path = join(expected, name)
      if (process.env['UPDATE_GOLDEN'] === '1') writeFileSync(path, files[name])
      expect(files[name]).toBe(readFileSync(path, 'utf8'))
    })
  }

  it('emits dependencies before dependents', () => {
    const types = files['types.hpp']
    expect(types.indexOf('struct Point')).toBeLessThan(types.indexOf('struct Shape'))
    expect(types.indexOf('struct Shape')).toBeLessThan(types.indexOf('using CanvasEvent'))
    expect(types.indexOf('using CanvasEvent')).toBeLessThan(types.indexOf('using Frame'))
  })

  it('gives a struct with fields no default constructor', () => {
    expect(files['types.hpp']).toContain(
      'Shape(::session_bridge::Point origin_, ::session_bridge::Colour colour_, std::optional<std::string> label_, std::vector<::session_bridge::Point> vertices_, std::optional<std::vector<std::string>> tags_, bool filled_)',
    )
    expect(files['types.hpp']).not.toMatch(/Shape\(\)/)
  })

  it('omits an unset optional instead of writing undefined', () => {
    expect(files['jsi.hpp']).toContain('if (arg.label)')
    expect(files['napi.hpp']).toContain('if (value.label)')
    expect(files['jsi.hpp']).not.toContain('jsi::Value::undefined()')
  })

  it('reads null and undefined alike as an unset optional, on both platforms', () => {
    expect(files['jsi.hpp']).toContain('value.isUndefined() || value.isNull()')
    expect(files['napi.hpp']).toContain('value.IsUndefined() || value.IsNull()')
    // Nitro's own optional converter takes undefined and throws on null, so delegating to it is
    // what made the two platforms disagree. Nothing here may go back to it.
    expect(files['jsi.hpp']).not.toContain('JSIConverter<std::optional<')
    expect(files['jsi.hpp']).toContain('::session_bridge::optional_from_jsi<std::string>')
  })

  it('names union members after their tag and the union', () => {
    expect(files['types.hpp']).toContain('struct ShapeAddedCanvasEvent')
    expect(files['types.hpp']).toContain(
      'static constexpr std::string_view type_tag = "shape-added"',
    )
    expect(files['types.hpp']).toContain('struct DrawCommand')
  })

  it('carries doc comments across', () => {
    expect(files['types.hpp']).toContain('/// Colours, spelled the way libsession spells them.')
    expect(files['types.hpp']).toContain(
      '    /// Where it sits.\n    ::session_bridge::Point origin;',
    )
    expect(files['types.hpp']).toContain('/// Draws one shape.\nstruct DrawCommand')
  })

  const rejects: Array<[string, RegExp]> = [
    ['record.ts', /generic types are not supported/],
    ['bigint.ts', /unsupported type 'bigint'/],
    ['inlineUnion.ts', /unsupported type ''a' \| 'b''/],
    ['untagged.ts', /needs a string-literal 'type' property/],
    ['cycle.ts', /part of a cycle/],
    ['aliasCycle.ts', /part of a cycle/],
    ['unionCycle.ts', /part of a cycle/],
    ['collision.ts', /is generated twice/],
    ['aliasCollision.ts', /is generated twice/],
    ['fieldCollision.ts', /both spell session_id/],
    ['badLiteral.ts', /cannot be written as a C\+\+ string literal/],
    ['enumCollision.ts', /both spell deep_red/],
    ['badTag.ts', /does not make a C\+\+ identifier/],
  ]
  for (const [file, message] of rejects) {
    it(`refuses ${file}`, () => {
      expect(() =>
        generate({
          entryFile: join(fixtures, 'invalid', file),
          roots: ['Frame'],
          sourceLabel: file,
        }),
      ).toThrow(message)
    })
  }
})
