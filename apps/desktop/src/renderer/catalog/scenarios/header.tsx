import { NavProvider, type NavPort } from '@session/app'
import {
  BackButton,
  ConversationHeader,
  DETAIL_PANE,
  PaneProvider,
  RequestsScreen,
  SOLE_PANE,
} from '@session/screens'
import { ELEMENT } from '@session/test-ids'
import { YStack } from '@session/ui'
import { defineStory, type AnyStory } from '@session/ui/catalog'

/** The catalog goes nowhere: the back button only has to draw. */
const STILL: NavPort = { push: () => {}, replace: () => {}, back: () => {} }

interface HeaderRow {
  pane: 'beside the list' | 'alone'
  title: string
}

/** A standard account ID, so the avatar's colour is one a real conversation would have. */
const ACCOUNT_ID = '05b2c7e1d4a8f3906e5c1b7d2a4f8e3c9b6d1a5e7f2c4b8d3a9e6f1c5b7d2a4e8f'

/** Room for the bar and a row or two under it: the bar is what this page is for. */
const REQUESTS_HEIGHT = 200

const LONG_NAME = 'Alexandria Montgomery-Fitzwilliam from the conference last spring'

/**
 * The conversation's top bar beside the list, where it takes the list's recessed surface and has no
 * back button, and alone as a phone draws it, with the back button. The long name has to truncate
 * with the title still centred between the two ends. A right-to-left page swaps the ends.
 *
 * Requests draws the same bar with its title at the start, as the list's is: beside the list it has
 * the list's height and surface, and alone it has the back button.
 */
export const HEADER_SCENARIOS: readonly AnyStory[] = [
  defineStory<HeaderRow>({
    component: 'conversationHeader',
    story: 'panes',
    width: 480,
    sensitive: { rtl: true, responsive: true },
    variants: {
      'beside the list': { pane: 'beside the list', title: 'Alice' },
      'beside the list, long name': { pane: 'beside the list', title: LONG_NAME },
      alone: { pane: 'alone', title: 'Alice' },
      'alone, long name': { pane: 'alone', title: LONG_NAME },
    },
    render: ({ pane, title }) => (
      <NavProvider nav={STILL}>
        <PaneProvider value={pane === 'alone' ? SOLE_PANE : DETAIL_PANE}>
          <ConversationHeader
            id={ACCOUNT_ID}
            title={title}
            back={<BackButton testID={ELEMENT.conversation.back} />}
          />
        </PaneProvider>
      </NavProvider>
    ),
  }),
  defineStory<Pick<HeaderRow, 'pane'>>({
    component: 'requestsScreen',
    story: 'top bar',
    width: 480,
    sensitive: { rtl: true },
    variants: {
      'beside the list': { pane: 'beside the list' },
      alone: { pane: 'alone' },
    },
    render: ({ pane }) => (
      <NavProvider nav={STILL}>
        <PaneProvider value={pane === 'alone' ? SOLE_PANE : DETAIL_PANE}>
          <YStack height={REQUESTS_HEIGHT}>
            <RequestsScreen />
          </YStack>
        </PaneProvider>
      </NavProvider>
    ),
  }),
]
