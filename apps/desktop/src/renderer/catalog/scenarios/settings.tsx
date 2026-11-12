import {
  AttachmentCacheSection,
  KeyboardShortcutsPage,
  RecoveryPasswordPage,
} from '@session/screens'
import { defineStory, type AnyStory } from '@session/ui/catalog'

/** Made up, never an account's: the fake's thirteen words and a 16-byte seed. */
const CATALOG_SECRET = {
  words:
    'letters mumble ordeal jaded womanly framed jailed sifting january nurse gutter estate jaded'.split(
      ' ',
    ),
  seedHex: '0123456789abcdef0123456789abcdef',
}

/** A phone's width, as the settings row's own story draws at. */
const SECTION_WIDTH = 390

/**
 * The attachment cache's figures against the showcase, whose prepared downloads give it a usage. A
 * right-to-left page sets each size at the leading edge, still number first.
 *
 * The keyboard shortcuts as a Mac and a PC name them. Right to left, the rows mirror and each key
 * combination keeps its order.
 */
export const SETTINGS_SCENARIOS: readonly AnyStory[] = [
  defineStory<Record<string, never>>({
    component: 'settings',
    story: 'attachmentCache',
    width: SECTION_WIDTH,
    sensitive: { rtl: true },
    variants: { resting: {} },
    render: () => <AttachmentCacheSection />,
  }),
  // The fake's words and seed, never an account's. Both views, since the page cannot be pressed
  // here; at a phone's width, where the Hide row's description wraps beside its button.
  defineStory<{ view: 'words' | 'qr' }>({
    component: 'settings',
    story: 'recoveryPassword',
    width: SECTION_WIDTH,
    sensitive: { rtl: true, theme: true },
    variants: { words: { view: 'words' }, qr: { view: 'qr' } },
    render: ({ view }) => <RecoveryPasswordPage secret={CATALOG_SECRET} initialView={view} />,
  }),
  defineStory<{ names: 'mac' | 'pc' }>({
    component: 'settings',
    story: 'keyboardShortcuts',
    width: SECTION_WIDTH,
    sensitive: { rtl: true },
    variants: { mac: { names: 'mac' }, pc: { names: 'pc' } },
    render: ({ names }) => <KeyboardShortcutsPage names={names} />,
  }),
]
