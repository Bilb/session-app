import { tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import { Screen, SessionBrand, Text, YStack } from '@session/ui'
import { useEffect, useState } from 'react'

/**
 * How long a wait has to run before it is worth saying anything about it.
 *
 * iOS's number, and the idea is the one worth copying rather than the value: a launch that takes a
 * moment should look like a launch, not like something going wrong. Under this, all anybody sees is
 * the logo -- which is what the platform's own launch screen was already showing, so the two run
 * together and nothing appears to happen at all.
 */
const SAY_SOMETHING_AFTER_MS = 5_000

/** And this much longer before admitting it might be a while. Also iOS's. */
const ADMIT_ITS_LONG_AFTER_MS = 15_000

/**
 * What both apps show before the first state has arrived.
 *
 * Shared because the alternative is each app guessing while it waits, and the guesses differ:
 * anything drawn here is drawn without knowing whether there is an account, so a list or onboarding
 * would be a decision made on missing information and corrected a frame later.
 *
 * **It says nothing for the first five seconds**, which is the iOS pattern -- `LoadingViewController`
 * shows its logo and holds everything else back behind the same two thresholds. A permanent
 * "Loading" makes every launch look slow; a logo that sits there briefly looks like starting up.
 *
 * The theme here is necessarily the default rather than the person's own: a theme preference lives
 * in libsession's globals, and this screen is what is on the screen *because* libsession has not
 * answered yet. iOS has the same constraint and answers it by forcing classic dark. Ours is the
 * same colour by a different route -- `DEFAULT_THEME` -- which is worth knowing before someone
 * wonders why this screen ignores a theme setting.
 */
export function StartingScreen() {
  const [waited, setWaited] = useState(0)

  useEffect(() => {
    const started = Date.now()
    // Measured against the clock rather than counted, so a machine that was busy elsewhere does not
    // come back believing it has been waiting for less time than it has.
    const timer = setInterval(() => {
      setWaited(Date.now() - started)
    }, 500)
    return () => {
      clearInterval(timer)
    }
  }, [])

  return (
    <Screen testID={ELEMENT.starting.screen}>
      <YStack flex={1} alignItems="center" justifyContent="center" gap="$3">
        <SessionBrand size={64} color="var(--primaryColor)" />

        {waited < SAY_SOMETHING_AFTER_MS ? null : (
          <YStack alignItems="center" gap="$1" maxWidth={280}>
            {/* What libsession is doing while this screen is up: opening and migrating its
                database. The same string the iOS screen uses for the same wait. */}
            <Text textAlign="center" testID={ELEMENT.starting.slowMessage}>
              {tr('databaseOptimizing')}
            </Text>
            {waited < ADMIT_ITS_LONG_AFTER_MS ? null : (
              <Text tone="secondary" size="$caption" textAlign="center">
                {tr('waitFewMinutes')}
              </Text>
            )}
          </YStack>
        )}
      </YStack>
    </Screen>
  )
}
