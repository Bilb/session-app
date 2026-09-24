import { describe, expect, it } from 'vitest'

import { FACE_WEIGHTS } from '#src/faceWeights'

describe('FACE_WEIGHTS', () => {
  /** Roboto's drawn weights: asking for any other gets a synthesised one. */
  const ROBOTO_DRAWN = ['100', '300', '400', '500', '700', '900']

  it('asks Roboto only for weights it has', () => {
    for (const weight of Object.values(FACE_WEIGHTS.roboto)) expect(ROBOTO_DRAWN).toContain(weight)
  })

  it('keeps regular and bold the same in every face', () => {
    for (const face of Object.values(FACE_WEIGHTS)) {
      expect(face.regular).toBe(FACE_WEIGHTS.roboto.regular)
      expect(face.bold).toBe(FACE_WEIGHTS.roboto.bold)
    }
  })
})
