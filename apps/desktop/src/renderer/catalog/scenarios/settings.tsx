import { AttachmentCacheSection, RecoveryPasswordPage } from '@session/screens'
import { defineStory, type AnyStory } from '@session/ui/catalog'

/** A phone's width, as the settings row's own story draws at. */
const SECTION_WIDTH = 390

/**
 * The attachment cache's figures against the showcase, whose prepared downloads give it a usage. A
 * right-to-left page sets each size at the leading edge, still number first.
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
    sensitive: { rtl: true },
    variants: { words: { view: 'words' }, qr: { view: 'qr' } },
    render: ({ view }) => <RecoveryPasswordPage initialView={view} />,
  }),
]
