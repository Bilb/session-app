import { ELEMENT } from '@session/test-ids'

import { ScrollToLatest, type ScrollToLatestProps } from '../../ScrollToLatest'
import { defineStory } from '../story'
import { noop } from './shared'

export const scrollToLatest = defineStory<ScrollToLatestProps>({
  component: 'scrollToLatest',
  story: 'states',
  width: 120,
  forced: ['hover', 'press', 'focus'],
  sensitive: { rtl: true },
  variants: {
    toLatest: {
      returnsToReply: false,
      accessibilityLabel: 'Scroll to latest message',
      onPress: noop,
      testID: ELEMENT.conversation.scrollToLatest,
    },
    backToReply: {
      returnsToReply: true,
      accessibilityLabel: 'Back to reply',
      onPress: noop,
      testID: ELEMENT.conversation.scrollToLatest,
    },
  },
  render: (props) => <ScrollToLatest {...props} />,
})
