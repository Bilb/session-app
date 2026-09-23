import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Only the chrome decides how much room a step gets.
 *
 * The two onboarding layouts inset differently: the phone pads the step by
 * `HORIZONTAL_CONTENT_INSET`, and the wide design does not pad it at all because the column is already
 * `COLUMN_WIDTH` and centred in what is left. A screen that writes the phone's figure directly
 * therefore looks right on a phone and wrong on Desktop, where it alone draws 70 narrower and 25
 * lower than every other step. `LoadAccountScreen` is the one exposed to this, since it turns
 * `padContent` off to pad one of its two panes and not the other.
 *
 * A pane that has to apply the padding itself asks for `useStepPadding()`, which is the same
 * figures behind the same media query. Nothing else in onboarding should need the constant, and
 * it lives in `chromeMetrics` with every other figure that has a different answer per layout.
 */
describe('the step inset', () => {
  const dir = join(import.meta.dirname, '../../src/onboarding')

  it('is written down only in the metrics module', () => {
    const offenders = readdirSync(dir)
      .filter((name) => /\.tsx?$/.test(name) && name !== 'chromeMetrics.ts')
      .filter((name) => /\bCONTENT_INSET\b/.test(readFileSync(join(dir, name), 'utf8')))

    expect(offenders).toEqual([])
  })
})
