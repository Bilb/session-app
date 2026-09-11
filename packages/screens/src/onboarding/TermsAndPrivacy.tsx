import { requirePorts } from '@session/app'
import { tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import { Button, Text, XStack, YStack } from '@session/ui'
import { useState } from 'react'

import { LocalizedText } from '../LocalizedText'

/**
 * The two documents, and the two hardcoded addresses they live at.
 *
 * Not in the catalogue, and not configurable: the legacy clients carry the same two literals. A URL
 * that a translation could change is a phishing surface, and this is the one screen reached before
 * anybody has decided to trust the app.
 */
const TERMS_URL = 'https://getsession.org/terms-of-service'
const PRIVACY_URL = 'https://getsession.org/privacy-policy'

/**
 * The footer of the landing screen: what using this commits you to.
 *
 * **The whole sentence is one control**, which is how the legacy clients do it -- Android renders
 * `onboardingTosPrivacy` as a single borderless button. The alternative, making the two bold runs
 * tappable, cannot survive translation: every language reorders them, and some do not keep them as
 * contiguous runs at all.
 *
 * **It asks before it leaves.** Tapping opens a dialog offering the two documents rather than
 * launching a browser. Worth keeping rather than smoothing away for the same reason the URLs are
 * hardcoded: nobody here has chosen to trust this app yet.
 */
export function TermsAndPrivacy() {
  const [open, setOpen] = useState(false)

  const leaveFor = (url: string) => {
    void requirePorts().linking.openUrl(url)
    setOpen(false)
  }

  return (
    <YStack gap="$1">
      <Button
        variant="ghost"
        size="sm"
        testID={ELEMENT.onboarding.termsOfService}
        onPress={() => {
          setOpen(true)
        }}
      >
        {/* Not the Button's own label, because the sentence carries the emphasis the translators
            put in it and a plain label would flatten it. */}
        <LocalizedText
          text={tr('onboardingTosPrivacy')}
          tone="secondary"
          size="$caption"
          textAlign="center"
        />
      </Button>

      {!open ? null : (
        <YStack
          gap="$1.5"
          padding="$2"
          borderRadius="$2"
          borderWidth={1}
          borderColor="$bordersColor"
          backgroundColor="$backgroundTertiary"
          testID={ELEMENT.onboarding.openUrlDialog}
        >
          <Text weight="semibold">{tr('urlOpen')}</Text>
          <Text tone="secondary" size="$label">
            {tr('urlOpenBrowser')}
          </Text>
          <XStack gap="$1" flexWrap="wrap">
            <Button
              variant="outline"
              size="sm"
              testID={ELEMENT.onboarding.openTerms}
              onPress={() => {
                leaveFor(TERMS_URL)
              }}
            >
              {tr('onboardingTos')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              testID={ELEMENT.onboarding.openPrivacy}
              onPress={() => {
                leaveFor(PRIVACY_URL)
              }}
            >
              {tr('onboardingPrivacy')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              testID={ELEMENT.onboarding.openUrlCancel}
              onPress={() => {
                setOpen(false)
              }}
            >
              {tr('cancel')}
            </Button>
          </XStack>
        </YStack>
      )}
    </YStack>
  )
}
