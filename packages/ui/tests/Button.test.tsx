import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { pressArea } from '@session/expectations'
import { ELEMENT } from '@session/test-ids'

import { Button } from '#src/Button'
import { Icon } from '#src/Icon'

import { byId, declared, nodeOf } from '@session/render-tier'
import { renderInUI } from './support/render'

const ID = ELEMENT.settings.back

/** The frame the variant styles, inside the PressArea that is the button. */
function frame(): HTMLElement {
  const element = byId(ID).firstElementChild
  if (!(element instanceof HTMLElement)) throw new Error('The Button drew no frame')
  return element
}

describe('a Button', () => {
  it('is one named button on the web, its PressArea, with no role on its frame', () => {
    renderInUI(
      <Button onPress={() => {}} testID={ID}>
        Continue
      </Button>,
    )
    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(nodeOf(ID)).toMatchObject(pressArea({ name: 'Continue' }).desktop!)
    expect(frame().hasAttribute('role')).toBe(false)
  })

  it('names an icon on its own by its accessibility label', () => {
    renderInUI(
      <Button
        onPress={() => {}}
        icon={<Icon name="copy" size="sm" />}
        accessibilityLabel="Copy"
        testID={ID}
      />,
    )
    expect(nodeOf(ID)).toMatchObject(pressArea({ name: 'Copy' }).desktop!)
  })
})

describe('a loading Button', () => {
  it('keeps its name on the control, since Android does not read a transparent label', () => {
    renderInUI(
      <Button loading onPress={() => {}} testID={ID}>
        Saving
      </Button>,
    )
    expect(byId(ID).getAttribute('aria-label')).toBe('Saving')
    expect(nodeOf(ID)).toMatchObject(
      pressArea({ name: 'Saving', disabled: true, busy: true }).desktop!,
    )
  })
})

describe('a danger Button', () => {
  it('draws its outline in its label’s red, so it reads as one colour at rest', () => {
    renderInUI(
      <Button variant="danger" onPress={() => {}} testID={ID}>
        Delete
      </Button>,
    )
    expect(declared(frame())).toMatchObject({
      'border-top-color': 'var(--dangerText)',
      color: 'var(--dangerText)',
    })
  })
})
