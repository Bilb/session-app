import { ELEMENT } from '@session/test-ids'

import type { Expected, ExpectedNode } from './node'

/** The ids an attachment's row carries; the control's names what it currently means. */
export const ATTACHMENT_ROW_IDS = {
  row: ELEMENT.conversation.attachment,
  name: ELEMENT.conversation.attachmentName,
  caption: ELEMENT.conversation.attachmentState,
  lead: ELEMENT.conversation.attachmentLead,
  thumbnail: ELEMENT.conversation.attachmentImage,
  download: ELEMENT.conversation.attachmentDownload,
  export: ELEMENT.conversation.attachmentExport,
} as const

export type FileRowState = 'idle' | 'fetching' | 'ready' | 'failed' | 'unavailable'

export interface FileRowSituation {
  filename: string
  /** The format line under the lead square, `''` where there is none. */
  format: string
  caption: string
  state: FileRowState
  /** What a press on the row says it does; absent where the row presses nothing. */
  rowVerb?: string | undefined
  /** Whether the lead square takes a press of its own. */
  leadOpens?: boolean | undefined
  /** What the lead square's press says it does; absent while it does nothing. */
  leadVerb?: string | undefined
  /** What the trailing control is announced as, the progress ring included. */
  controlName?: string | undefined
}

export interface FileRowParts {
  row: Expected
  lead: Expected
  name: Expected
  caption: Expected
  control: Expected
  /** What the row offers a screen reader on native, each verb once, its activation first. */
  verbs: string[]
}

const NO_ROLE: ExpectedNode = { role: 'none', name: null, focusable: false }

/**
 * A file row and its parts. On the desktop the lead square and the control are the buttons and the
 * row is none, since ARIA would make a button's children presentational. On native the row is the
 * one accessibility element, whose actions are its parts' verbs, and its parts have no role.
 */
export function fileRow(s: FileRowSituation): FileRowParts {
  const held = s.state === 'fetching'
  const leadOpens = s.leadOpens === true
  const controlActs =
    s.controlName !== undefined && s.state !== 'fetching' && s.state !== 'unavailable'
  // A row with no press of its own takes the first verb it offers as its activation.
  const activate =
    s.rowVerb ?? (leadOpens ? s.leadVerb : undefined) ?? (controlActs ? s.controlName : undefined)
  const operable = activate !== undefined
  const verbs = [
    ...new Set(
      [
        s.rowVerb,
        leadOpens ? s.leadVerb : undefined,
        controlActs ? s.controlName : undefined,
      ].filter((verb) => verb !== undefined),
    ),
  ]

  const leadDesktop: ExpectedNode | null = !leadOpens
    ? null
    : s.leadVerb !== undefined
      ? { role: 'button', name: s.filename, hint: s.leadVerb, disabled: false, focusable: true }
      : held
        ? { role: 'button', name: s.filename, hint: null, disabled: true, focusable: true }
        : NO_ROLE

  const control: Expected =
    s.state === 'unavailable'
      ? { desktop: null, native: null }
      : {
          desktop: {
            role: 'button',
            name: s.controlName ?? null,
            disabled: held,
            focusable: true,
          },
          native: NO_ROLE,
        }

  return {
    row: {
      desktop: NO_ROLE,
      native: {
        role: operable || held ? 'button' : 'none',
        name: [s.filename, s.format, s.caption].filter((part) => part !== '').join(', '),
        hint: activate ?? null,
        // Android keeps a disabled state that is dropped rather than cleared, so it is asserted.
        disabled: !operable && held,
        busy: held,
        focusable: true,
      },
    },
    lead: { desktop: leadDesktop, native: leadOpens ? NO_ROLE : null },
    name: {
      desktop: { role: 'text', name: s.filename },
      native: { role: 'text', name: s.filename },
    },
    caption: {
      desktop: { role: 'text', name: s.caption },
      native: { role: 'text', name: s.caption },
    },
    control,
    verbs,
  }
}
