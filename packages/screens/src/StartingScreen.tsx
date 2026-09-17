import { requirePorts } from '@session/app'
import { tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import { Button, Modal, Screen, SessionBrand, Text, YStack } from '@session/ui'
import { useEffect, useState } from 'react'

import { LocalizedText } from './LocalizedText'

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
 * And this much longer before saying so over the top of the screen.
 *
 * A failure that *throws* lands on the failure screen, which is the path that matters. This covers
 * only what a catch site cannot: a start that never comes back at all, where there is no error to
 * catch and the screen is indistinguishable from a database that is simply large.
 *
 * Twice the previous threshold rather than another five seconds, because a dialog thrown over a
 * launch that was going to finish is worse than silence. Nothing dismisses it: this screen is gone
 * by then, and the dialog with it.
 */
const SAY_SO_IN_A_DIALOG_AFTER_MS = 30_000

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
  /** Dismissed rather than answered: the copy's own first suggestion is to keep waiting. */
  const [dismissed, setDismissed] = useState(false)
  const close = requirePorts().window.close

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
        <SessionBrand size={64} color="$primaryColor" />

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

      <Modal
        open={waited >= SAY_SO_IN_A_DIALOG_AFTER_MS && !dismissed}
        onClose={() => {
          setDismissed(true)
        }}
        title={tr('databaseOptimizing')}
        closeLabel={tr('cancel')}
        testID={ELEMENT.starting.slowDialog}
        closeTestID={ELEMENT.starting.slowDialogClose}
        actions={
          close === null ? undefined : (
            <Button
              variant="ghost"
              testID={ELEMENT.startupFailed.quit}
              onPress={() => {
                close()
              }}
            >
              {tr('quit')}
            </Button>
          )
        }
      >
        <LocalizedText text={tr('databaseErrorTimeout')} />
      </Modal>
    </Screen>
  )
}
