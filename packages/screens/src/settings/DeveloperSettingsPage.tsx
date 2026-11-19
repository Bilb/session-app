import { FLAGS, flag, flagSource, requirePorts, type FlagName, type FlagSource } from '@session/app'
import { PENDING_COPY, tr } from '@session/localization'
import { useFlagToggles, useSessionActions } from '@session/state'
import { ELEMENT } from '@session/test-ids'
import {
  SettingsGroup,
  SettingsNote,
  SettingsRow,
  SettingsSection,
  Switch,
  YStack,
} from '@session/ui'

/** Every flag in the shared table, in its order. */
const FLAG_NAMES = Object.keys(FLAGS) as FlagName[]

function sourceLabel(source: FlagSource): string {
  if (source === 'toggle') return PENDING_COPY.developerFlagSetHere
  if (source === 'environment') return PENDING_COPY.developerFlagFromEnvironment
  return PENDING_COPY.developerFlagDefault
}

/**
 * Developer Settings: every feature flag with a switch, which wins over the environment and starts
 * at whatever the flag is now, so one turned on by its environment variable shows as on. What is
 * switched here is stored with the account; most flags are read as screens are drawn or as the app
 * starts, so a change applies everywhere after a restart. Shown only in debug mode.
 */
export function DeveloperSettingsPage() {
  const actions = useSessionActions()
  // Read so the page redraws when a switch is stored; the values themselves come from `flag`.
  const toggles = useFlagToggles()
  const restart = requirePorts().window.restart
  const switched = FLAG_NAMES.filter((name) => toggles[name] !== undefined)
  return (
    <YStack padding="$md" gap="$lg" testID={ELEMENT.developerSettings.page}>
      <YStack>
        <SettingsSection label={PENDING_COPY.developerFeatureFlags} />
        <SettingsGroup>
          {FLAG_NAMES.map((name) => (
            <SettingsRow
              key={name}
              label={name}
              subtitle={sourceLabel(flagSource(name))}
              trailing={
                <Switch
                  value={flag(name)}
                  onValueChange={(value) => void actions.setFlagToggle(name, value)}
                  accessibilityLabel={name}
                  testID={ELEMENT.developerSettings.flagSwitch(name)}
                />
              }
              testID={ELEMENT.developerSettings.flag(name)}
            />
          ))}
        </SettingsGroup>
      </YStack>
      <SettingsGroup>
        <SettingsRow
          label={PENDING_COPY.developerResetFlags}
          disabled={switched.length === 0}
          onPress={() => {
            for (const name of switched) void actions.setFlagToggle(name, null)
          }}
          testID={ELEMENT.developerSettings.resetFlags}
        />
        {restart === null ? null : (
          <SettingsRow
            label={tr('restart')}
            onPress={restart}
            testID={ELEMENT.developerSettings.restart}
          />
        )}
      </SettingsGroup>
      <SettingsNote
        text={tr('settingsRestartDescription')}
        testID={ELEMENT.developerSettings.restartNote}
      />
    </YStack>
  )
}
