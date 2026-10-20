import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { pressArea } from '@session/expectations'
import { ELEMENT } from '@session/test-ids'

import { Button, type ButtonProps } from '#src/Button'
import { Icon } from '#src/Icon'
import { THEME_STATES } from '#src/themes'

import { byId, declared, nodeOf } from '@session/render-tier'
import { renderInUI } from './support/render'

type Variant = NonNullable<ButtonProps['variant']>

// A record, so a variant added to the Button and not here fails to typecheck.
const VARIANTS = Object.keys({
  solid: true,
  outline: true,
  outlineAccent: true,
  ghost: true,
  ghostAccent: true,
  simple: true,
  tonal: true,
  danger: true,
} satisfies Record<Variant, true>) as Variant[]

/**
 * The surface ladder, which body text is derived to clear on every rung, and the overlays laid
 * over it. A state that fills with anything else has to say what its label becomes.
 */
const READS_RESTING_LABEL = new Set(
  [
    'backgroundPrimary',
    'backgroundSecondary',
    'backgroundTertiary',
    'backgroundNested',
    'hoverOverlay',
    'pressedOverlay',
  ].map((token) => `var(--${token})`),
)

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

  describe.each(THEME_STATES)('in %s', (theme) => {
    it.each([
      ['tonal' as const, 'var(--t-radius-sm)'],
      ['solid' as const, 'var(--t-radius-full)'],
      ['outline' as const, 'var(--t-radius-full)'],
    ])('rings a focused %s button in its own shape', (variant, radius) => {
      renderInUI(<Button variant={variant} onPress={() => {}} testID={ID} />, theme)
      expect(declared(byId(ID), ':focus-visible')).toMatchObject({
        'outline-color': 'var(--primaryColor)',
        'border-top-left-radius': radius,
      })
    })

    it('rings a cell inside its edges, in the on-accent ink on a bubble you sent', () => {
      renderInUI(
        <Button variant="simple" borderRadius="$none" onAccent onPress={() => {}} testID={ID} />,
        theme,
      )
      expect(declared(byId(ID), ':focus-visible')).toMatchObject({
        'outline-color': 'var(--onAccent)',
        'outline-offset': '-2px',
      })
    })

    it('rings itself in the on-accent ink on a bubble you sent, and keeps its own fill', () => {
      const { rerender } = renderInUI(
        <Button variant="tonal" onPress={() => {}} testID={ID} />,
        theme,
      )
      const fill = declared(frame())['background-color']
      rerender(<Button variant="tonal" onAccent onPress={() => {}} testID={ID} />)
      expect(declared(byId(ID), ':focus-visible')['outline-color']).toBe('var(--onAccent)')
      expect(declared(frame())['background-color']).toBe(fill)
    })
  })
})

describe('every Button variant', () => {
  it.each(VARIANTS)(
    '%s declares its resting label colour on the frame the label inherits',
    (variant) => {
      renderInUI(
        <Button variant={variant} onPress={() => {}} testID={ID}>
          Continue
        </Button>,
      )
      expect(declared(frame()).color).toMatch(/^var\(--\w+\)$/)
      expect(declared(within(frame()).getByText('Continue')).color).toBe('inherit')
    },
  )

  it('says what its label becomes wherever a hover or press fills off the ladder', () => {
    const filled: string[] = []
    const silent: string[] = []
    for (const variant of VARIANTS) {
      const { unmount } = renderInUI(<Button variant={variant} onPress={() => {}} testID={ID} />)
      for (const state of [':hover', ':active'] as const) {
        const style = declared(frame(), state)
        const fill = style['background-color']
        if (fill === undefined || READS_RESTING_LABEL.has(fill)) continue
        filled.push(`${variant}${state}`)
        if (style.color === undefined) silent.push(`${variant}${state}`)
      }
      unmount()
    }
    expect(filled).toContain('solid:hover')
    expect(silent).toEqual([])
  })
})

describe('a loading Button', () => {
  it('keeps its label laid out but hidden, with the spinner centred over it', () => {
    renderInUI(
      <Button loading onPress={() => {}} testID={ID}>
        Saving
      </Button>,
    )
    const label = within(frame()).getByText('Saving')
    expect(declared(label.parentElement!).opacity).toBe('0')
    const spinner = within(frame()).getByRole('progressbar')
    const over = spinner.closest('[class*="_pos-absolute"]')
    expect(over === null ? {} : declared(over)).toMatchObject({
      position: 'absolute',
      'align-items': 'center',
      'justify-content': 'center',
    })
  })

  it('draws no spinner at rest, and its label at full strength', () => {
    renderInUI(
      <Button onPress={() => {}} testID={ID}>
        Save
      </Button>,
    )
    expect(within(frame()).queryByRole('progressbar')).toBeNull()
    expect(within(frame()).getByText('Save').parentElement).toBe(frame())
  })

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
