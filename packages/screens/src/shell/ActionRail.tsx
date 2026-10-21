import { isRtlLocale, tr } from '@session/localization'
import { useAccount, useAppearance, useNetworkStatus, useSessionActions } from '@session/state'
import { ELEMENT } from '@session/test-ids'
import {
  appearanceFrom,
  Avatar,
  Icon,
  isDarkTheme,
  logical,
  MIN_HIT_TARGET,
  oppositePolarity,
  RailButton,
  Screen,
  SIZE_SCALE,
  StatusDot,
  Tooltip,
  useTokenColor,
  useTopBarControlsPadding,
  YStack,
} from '@session/ui'

import { useOpenSettings } from '../settings/SettingsRootPage'
import { pathStatusLabel, pathStatusTone } from '../pathStatus'
import { PENDING_COPY } from '../pendingCopy'
import { useLocale } from '../useLocale'

/** The legacy desktop's `--actions-panel-width`. */
const RAIL_WIDTH_PX = 80
/** The legacy desktop's `AvatarSize.S`. Off the size ladder, which has 32 and 40. */
const AVATAR_PX = 36
/** The settings badge on the avatar: a 15 px gear in a disc 2.5 px wider all round. */
const GEAR_DISC_PX = SIZE_SCALE.md
const GEAR_GLYPH_PX = 15
/** How far the badge hangs below the avatar: the legacy desktop's -10% of its side. */
const GEAR_DROP_PX = -AVATAR_PX * 0.1
/** The path light's hit area: its 12 px dot inside the legacy desktop's 22 px of padding. */
const PATH_SIDE_PX = SIZE_SCALE['4xl']
/** The theme toggle's: a 20 px glyph inside the legacy desktop's 15 px of padding. */
const THEME_SIDE_PX = 50

/** The avatar, with the gear that says it opens settings. */
function SettingsAvatar() {
  const account = useAccount()
  const openSettings = useOpenSettings()
  const ring = useTokenColor('$bordersColor')
  const label = tr('sessionSettings')
  return (
    <Tooltip label={label} testID={ELEMENT.rail.tooltip('avatar')}>
      <RailButton
        sidePx={AVATAR_PX}
        accessibilityLabel={label}
        onPress={openSettings}
        testID={ELEMENT.rail.avatar}
      >
        {/* The badge's own containing block, so it is placed against the avatar whatever the
            button around it does. */}
        <YStack width={AVATAR_PX} height={AVATAR_PX} position="relative">
          <Avatar
            id={account?.sessionId ?? ''}
            name={account?.displayName ?? ''}
            size={AVATAR_PX}
          />
          <YStack
            position="absolute"
            bottom={GEAR_DROP_PX}
            width={GEAR_DISC_PX}
            height={GEAR_DISC_PX}
            borderRadius="$full"
            alignItems="center"
            justifyContent="center"
            backgroundColor="$primaryColor"
            boxShadow={`0px 0px 3px 2px ${ring}`}
            pointerEvents="none"
            {...logical({ insetEnd: 0 })}
          >
            <Icon name="settings" size={GEAR_GLYPH_PX} color="$onAccent" />
          </YStack>
        </YStack>
      </RailButton>
    </Tooltip>
  )
}

/**
 * The onion path's light.
 *
 * TODO: open the path screen on a press, as the legacy desktop's light does. There is no path
 * screen yet: it needs the nodes of the current path, which libsession's `get_path_to` has and the
 * bridge does not carry. Until then the light is a status that names itself, with no press.
 */
function PathLight() {
  const status = useNetworkStatus()
  const label = pathStatusLabel(status)
  return (
    <Tooltip label={label} testID={ELEMENT.rail.tooltip('path-status')}>
      <RailButton sidePx={PATH_SIDE_PX} accessibilityLabel={label} testID={ELEMENT.rail.pathStatus}>
        <StatusDot tone={pathStatusTone(status)} />
      </RailButton>
    </Tooltip>
  )
}

/**
 * Light or dark within the theme's family, keeping the accent, as the legacy desktop's toggle
 * does. Named for the mode the glyph shows: moon and Dark Mode while dark, sun and Light Mode
 * while light.
 */
function ThemeToggle() {
  const actions = useSessionActions()
  const { theme, accent } = appearanceFrom(useAppearance())
  const dark = isDarkTheme(theme)
  const label = dark ? tr('darkMode') : PENDING_COPY.lightMode
  return (
    <Tooltip label={label} testID={ELEMENT.rail.tooltip('theme-toggle')}>
      <RailButton
        sidePx={THEME_SIDE_PX}
        accessibilityLabel={label}
        onPress={() => {
          void actions.setAppearance({ theme: oppositePolarity(theme), accent })
        }}
        testID={ELEMENT.rail.themeToggle}
      >
        <Icon name={dark ? 'moon' : 'sunMedium'} size="md" color="$textSecondary" />
      </RailButton>
    </Tooltip>
  )
}

/**
 * The column down the start edge of a wide layout: the account at the top, the app's ambient
 * status at the bottom. What the legacy desktop's rail holds today, less its debug button.
 *
 * Its own safe area, since it is against the display's edge where the list used to be: the top,
 * the bottom and the side it sits on. In a resizable iPad window the window's controls sit in its
 * top corner, over the avatar, so the column starts below them there.
 */
export function ActionRail() {
  const rtl = isRtlLocale(useLocale())
  const controls = useTopBarControlsPadding()
  const underControls = (rtl ? controls.right : controls.left) !== undefined
  const rule = useTokenColor('$bordersColor')

  return (
    <Screen
      edges={['top', 'bottom', rtl ? 'right' : 'left']}
      avoidsKeyboard={false}
      testID={ELEMENT.rail.screen}
    >
      <YStack
        flex={1}
        width={RAIL_WIDTH_PX}
        alignItems="center"
        paddingVertical="$lg"
        {...(underControls ? { paddingTop: MIN_HIT_TARGET } : {})}
        {...logical({ borderEndWidth: 1, borderEndColor: rule })}
      >
        <YStack alignItems="center" gap="$lg">
          <SettingsAvatar />
        </YStack>
        <YStack flex={1} />
        <YStack alignItems="center" gap="$lg">
          {/* TODO: the update indicator goes here, above the path light, as in the design. It
              waits on its glyphs being chosen and on a desktop updater, which needs packaging. */}
          <PathLight />
          <ThemeToggle />
        </YStack>
      </YStack>
    </Screen>
  )
}
