import { StartupFailedScreen } from '@session/screens'
import type { StartupFailureKind } from '@session/state'
import { YStack } from '@session/ui'
import { defineStory, type AnyStory } from '@session/ui/catalog'

/** A phone's width, where the explanation and the reason wrap the most. */
const SCREEN_WIDTH = 390

/** Tall enough for the longest explanation, the reason and all three buttons. */
const SCREEN_HEIGHT = 640

interface FailedStart {
  error: string
  kind: StartupFailureKind
}

/**
 * One row per explanation the screen can give, with the refusal each comes from. The unreadable
 * row's reason is the longest the bridge words, and the explanation the longest in the set.
 */
export const STARTUP_FAILED_SCENARIOS: readonly AnyStory[] = [
  defineStory<FailedStart>({
    component: 'startupFailed',
    story: 'kinds',
    width: SCREEN_WIDTH,
    sensitive: { rtl: true },
    variants: {
      unreadable: {
        error:
          'setAttachmentCacheLimit: the bridge has no database open: database disk image is malformed',
        kind: 'unreadable',
      },
      keyMissing: {
        error: 'the database key is missing, but a database exists',
        kind: 'unreadable',
      },
      transient: {
        error: 'setAttachmentCacheLimit: the bridge has no database open: database is locked',
        kind: 'transient',
      },
      noBridge: {
        error: 'the bridge could not start: rawKeyHex must be 64 hex characters',
        kind: 'noBridge',
      },
    },
    render: (failed) => (
      <YStack height={SCREEN_HEIGHT}>
        <StartupFailedScreen {...failed} />
      </YStack>
    ),
  }),
]
