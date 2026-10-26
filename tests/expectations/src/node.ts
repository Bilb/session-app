/** A role in the vocabulary every driver maps its own tree onto. */
export type ExpectedRole = 'button' | 'image' | 'text' | 'link' | 'textbox' | 'progressbar' | 'none'

/**
 * What one element is to a screen reader and a driver. A field left out is not asserted; `null`
 * asserts there is none.
 */
export interface ExpectedNode {
  role: ExpectedRole
  name: string | null
  hint?: string | null | undefined
  disabled?: boolean | undefined
  busy?: boolean | undefined
  focusable?: boolean | undefined
}

export type Platform = 'desktop' | 'native'

/** `null` on a platform: deliberately absent from that platform's tree. */
export type Expected = Record<Platform, ExpectedNode | null>
