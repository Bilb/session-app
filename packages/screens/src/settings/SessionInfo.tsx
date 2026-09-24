import { CLIENT_URLS, enableDebugMode, requirePorts, toggleDebugMode, URLS } from '@session/app'
import { tr } from '@session/localization'
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

/** The phones' logo, 24 high on both, and the iOS client's taps and the most time between them. */
const PHONE_LOGO_HEIGHT = 24
const TAPS_FOR_DEBUG = 9
const TAP_WINDOW_MS = 500

/**
 * The foot of the settings page: the network's logo, then which build this is.
 *
 * Drawn as each client draws it: the desktop's version and commit side by side, the phones' one
 * line. Which is decided as the account controls are, by whether there is a share sheet -- a tablet
 * is a phone here, whatever its layout.
 */
export function SessionInfo() {
  return requirePorts().share.shareText === null ? <DesktopSessionInfo /> : <PhoneSessionInfo />
}

/**
 * The phones' footer: the logo, then "Version 1.2.3 (45 - abcdef12)" -- the iOS client's line, which
 * the product owner asked for, built on the catalogue's `updateVersion` as the Android client's is.
 *
 * Nine taps turn debug mode on and leave it on, as the iOS client's do, each within half a second of
 * the last or the count starts again. No toast, as there: what says it worked is the Developer
 * Settings row appearing.
 */
function PhoneSessionInfo() {
  const modals = useModals()
  const { version, commit, buildNumber } = requirePorts().build
  const taps = useRef({ count: 0, at: 0 })
  const detail = [buildNumber, commit].filter((part) => part !== null).join(' - ')

  return (
    <YStack alignItems="center" gap={LOGO_GAP}>
      <PressArea
        accessibilityLabel={URLS.token}
        testID={ELEMENT.settings.tokenLogo}
        onPress={() => {
          confirmLink(modals, URLS.token)
        }}
      >
        {() => <SessionTokenLogo size={PHONE_LOGO_HEIGHT} color="$textSecondary" />}
      </PressArea>
      <PressArea
        testID={ELEMENT.settings.version}
        onPress={() => {
          const now = Date.now()
          const held = now - taps.current.at <= TAP_WINDOW_MS ? taps.current.count : 0
          taps.current = { count: held + 1, at: now }
          if (taps.current.count < TAPS_FOR_DEBUG) return
          taps.current = { count: 0, at: 0 }
          enableDebugMode()
        }}
      >
        {() => (
          <Text size="$label" tone="secondary" textAlign="center">
            {tr('updateVersion', { version: detail === '' ? version : `${version} (${detail})` })}
          </Text>
        )}
      </PressArea>
    </YStack>
  )
}

/**
 * The desktop client's `SessionInfo`: the logo, then the version and the commit.
 *
 * The logo leaves for the token site, and the version for its release page, both through the
 * usual confirmation. Ten presses on the commit turn debug mode over, as the client's do.
 */
function DesktopSessionInfo() {
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
              toasts.show(toggleDebugMode() ? tr('debugModeEnabled') : tr('debugModeDisabled'), {
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
