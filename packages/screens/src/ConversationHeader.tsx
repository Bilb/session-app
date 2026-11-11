import { ELEMENT } from '@session/test-ids'
import { Avatar, BarTitle } from '@session/ui'
import type { ReactNode } from 'react'

import { PaneTopBar } from './shell/PaneTopBar'

/** The avatar's diameter: the back button's 40 points, so the two ends of the bar match. */
const HEADER_AVATAR = '2xl'

/**
 * The conversation's top bar: the way back where there is one, the name in the middle, and the
 * conversation's avatar at the end, as all three current clients draw it.
 *
 * TODO: the avatar opens the conversation's settings once that screen exists. A contact's
 * conversation adds a call button before it once calls exist (never a message request's), and the
 * name gets a line under it once there is something to say there: muted, a group's member count,
 * or the disappearing-messages timer.
 */
export function ConversationHeader({
  id,
  title,
  back,
}: {
  id: string
  title: string
  /** The screen's own back button, so the screen still shows it has a way out. */
  back: ReactNode
}) {
  return (
    <PaneTopBar
      centred
      testID={ELEMENT.conversation.header}
      leading={back}
      title={
        <BarTitle centred testID={ELEMENT.conversation.headerName}>
          {title}
        </BarTitle>
      }
      trailing={
        <Avatar
          id={id}
          name={title}
          size={HEADER_AVATAR}
          testID={ELEMENT.conversation.headerAvatar}
        />
      }
    />
  )
}
