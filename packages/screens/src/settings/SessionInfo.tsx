import { CLIENT_URLS, requirePorts, toggleDebugMode, URLS } from '@session/app'
import { ELEMENT } from '@session/test-ids'
import {
  offScaleText,
  PressArea,
  SessionTokenLogo,
  Text,
  useModals,
  useToast,
  XStack,
  YStack,
} from '@session/ui'
import { useRef, useState } from 'react'

import { confirmLink } from './confirmLink'

/**
 * The desktop client's `SessionInfo` measurements, none of them on a scale: the logo 20 high, 5
 * between it and the line under it, 10 between the version and the commit, both at 13, and at half
 * strength until the pointer is on one.
 */
const LOGO_HEIGHT = 20
const LOGO_GAP = 5
const STAMP_GAP = 10
const STAMP_SIZE = 13
const RESTING = 0.5

/** How many presses on the commit turn debug mode over: the client's ten. */
const PRESSES_FOR_DEBUG = 10

/**
 * The foot of the settings page: the network's logo, then which build this is.
 *
 * The logo leaves for the token site, and the version for its release page, both through the
 * usual confirmation. Ten presses on the commit turn debug mode over, as the client's do.
 */
export function SessionInfo() {
  const modals = useModals()
  const toasts = useToast()
  const { version, commit } = requirePorts().build
  const presses = useRef(0)
  // The client's logo brightens from the muted text to the body text under the pointer. A fill,
  // so it is told rather than styled: a hover style reaches the frame, not the drawing inside it.
  const [logoHovered, setLogoHovered] = useState(false)

  return (
    <YStack alignItems="center" gap={LOGO_GAP}>
      <PressArea
        accessibilityLabel={URLS.token}
        testID={ELEMENT.settings.tokenLogo}
        onPress={() => {
          confirmLink(modals, URLS.token)
        }}
      >
        {() => (
          <YStack
            cursor="pointer"
            onMouseEnter={() => {
              setLogoHovered(true)
            }}
            onMouseLeave={() => {
              setLogoHovered(false)
            }}
          >
            <SessionTokenLogo
              size={LOGO_HEIGHT}
              color={logoHovered ? '$textPrimary' : '$textSecondary'}
            />
          </YStack>
        )}
      </PressArea>

      <XStack gap={STAMP_GAP}>
        <PressArea
          testID={ELEMENT.settings.version}
          onPress={() => {
            confirmLink(modals, CLIENT_URLS.release(version))
          }}
        >
          {() => (
            <Text
              {...offScaleText(STAMP_SIZE)}
              opacity={RESTING}
              hoverStyle={{ opacity: 1 }}
              cursor="pointer"
            >
              {`v${version}`}
            </Text>
          )}
        </PressArea>
        {commit === null ? null : (
          <PressArea
            testID={ELEMENT.settings.commit}
            onPress={() => {
              presses.current += 1
              if (presses.current < PRESSES_FOR_DEBUG) return
              presses.current = 0
              // English, because the catalogue has no string for either: the client's are dev
              // strings that never reached it.
              toasts.show(toggleDebugMode() ? 'Debug mode enabled' : 'Debug mode disabled', {
                id: 'debug-mode',
              })
            }}
          >
            {() => (
              <Text
                {...offScaleText(STAMP_SIZE)}
                opacity={RESTING}
                hoverStyle={{ opacity: 1 }}
                cursor="pointer"
              >
                {commit}
              </Text>
            )}
          </PressArea>
        )}
      </XStack>
    </YStack>
  )
}
