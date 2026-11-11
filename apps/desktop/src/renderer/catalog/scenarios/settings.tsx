import { AttachmentCacheSection, KeyboardShortcutsPage } from '@session/screens'
import { defineStory, type AnyStory } from '@session/ui/catalog'

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
  defineStory<{ names: 'mac' | 'pc' }>({
    component: 'settings',
    story: 'keyboardShortcuts',
    width: SECTION_WIDTH,
    sensitive: { rtl: true },
    variants: { mac: { names: 'mac' }, pc: { names: 'pc' } },
    render: ({ names }) => <KeyboardShortcutsPage names={names} />,
  }),
]
