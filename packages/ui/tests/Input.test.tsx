import { ELEMENT } from '@session/test-ids'
import { describe, expect, it } from 'vitest'

import { Input } from '#src/Input'

import { byId, declared } from '@session/render-tier'
import { renderInUI } from './support/render'

const ID = ELEMENT.onboarding.recoveryPhraseInput

describe('an Input in an error state', () => {
  it('draws its edge in its text’s red, so the field reads as one red', () => {
    renderInUI(<Input value="word" onChangeText={() => {}} error errorText testID={ID} />)
    expect(declared(byId(ID))).toMatchObject({
      'border-top-color': 'var(--dangerColor)',
      color: 'var(--dangerColor)',
    })
  })
})
