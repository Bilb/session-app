import { describe, expect, it } from 'vitest'

import { hexToOklch } from './oklch'
import { coverage, maxChroma, sample } from './coverage'

/**
 * A coverage floor rather than a pass/fail on any one palette.
 *
 * The sweep tests assert that specific, chosen inputs work. This asserts something the sweeps
 * cannot: that the rules hold across the *space*, so a change that quietly shrinks the range of
 * workable themes shows up as a number moving rather than as a bug reported months later.
 *
 * The thresholds sit a few points under the measured values. They are a ratchet against regression,
 * not a target -- tightening them every time the number improves would make the suite brittle for
 * no gain.
 */

const SAMPLES = 2000

/**
 * Drawn once and shared.
 *
 * Every draw runs the whole derivation, so sampling per test made this the slowest thing in the
 * suite and it timed out on CI's slower runners at the default five seconds. Nothing here needs its
 * own draw: the seed is fixed, so a second call returns the same samples anyway -- which is the
 * property the determinism test exists to prove, and it can prove it with far fewer.
 */
const SAMPLED = sample(SAMPLES)

describe('knob-space coverage', () => {
  const c = coverage(SAMPLED)

  it('holds up across bases the system says it can support', () => {
    // Measured ~95%. Nothing is promised about bases `baseFits` rejects; those are covered by the
    // graceful-degradation test in sweep.test.ts instead.
    //
    // Ratcheted up from 0.85 after dropping the danger-versus-warning separation requirement, which
    // turned out to cost ten points of headline coverage for a guarantee the words beside these
    // colours already provide. Worth protecting rather than leaving as slack.
    expect(c.fittingValid / c.fitting).toBeGreaterThan(0.9)
  })

  it('is near-total once the base is also near-neutral', () => {
    // Measured ~97% (light 93%, dark 98%). The residue is almost all light bases, where the
    // surfaces step down into a narrow band and semantic colours have less room to work in.
    const low = SAMPLED.filter((s) => s.fits && hexToOklch(s.knobs.background).c <= 0.06)
    const valid = low.filter((s) => s.failed.length === 0).length
    expect(valid / low.length).toBeGreaterThan(0.94)
  })

  it('reports the same numbers every run', () => {
    // The seeded generator is the point: a figure quoted in a review has to be reproducible. Two
    // small independent draws prove that as well as two large ones and cost a fraction as much.
    expect(coverage(sample(200)).valid).toBe(coverage(sample(200)).valid)
  })

  it('knows what chroma sRGB can actually hold', () => {
    // Which is what makes a fixed slider maximum wrong: the ceiling swings by an order of magnitude
    // across lightness and hue, and is near zero at both ends of the range.
    expect(maxChroma(0.5, 300)).toBeGreaterThan(0.2)
    expect(maxChroma(0.97, 60)).toBeLessThan(0.02)
    expect(maxChroma(0.1, 240)).toBeLessThan(0.02)
  })
})
