import { requirePorts } from '@session/app'
import { tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import { Button, Icon, Modal, Text, XStack, YStack } from '@session/ui'
import { useState } from 'react'

import { LocalizedText } from '../LocalizedText'

/**
 * The two documents, and the two hardcoded addresses they live at.
 *
 * Not in the catalogue, and not configurable: the legacy clients carry the same two literals. A URL
 * that a translation could change is a phishing surface, and this is the one screen reached before
 * anybody has decided to trust the app.
 */
const LINKS = [
  { url: 'https://getsession.org/terms-of-service', testID: ELEMENT.onboarding.openTerms },
  { url: 'https://getsession.org/privacy-policy', testID: ELEMENT.onboarding.openPrivacy },
] as const

/**
 * The footer of the landing screen: what using this commits you to.
 *
 * **The whole sentence is one control and it opens a dialog offering both documents.** That is the
 * newer of the two patterns in the product -- the older one made each document's name its own tap
 * target and opened a dialog about that one link. The newer one is better for a phone, where two
 * three-word targets inside a paragraph are hard to hit, and it is better for translation, where
 * every language reorders those names and some do not keep them as contiguous runs at all.
 *
 * It asks before it leaves rather than launching a browser, which is worth keeping for the same
 * reason the URLs are hardcoded: nobody here has chosen to trust this app yet. The dialog shows the
 * addresses themselves, so what you are agreeing to visit is legible before you go.
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
          size="$label"
          textAlign="center"
        />
      </Button>

      {/* A modal over the page rather than a panel under the sentence. Inline, it pushed the
          screen around and read as part of it; this is a question being asked, and the thing it is
          asking about should still be visible behind it. */}
      <Modal
        open={open}
        onClose={() => {
          setOpen(false)
        }}
      >
        <YStack
          width="100%"
          maxWidth={360}
          gap="$1.5"
          padding="$2"
          borderRadius="$3"
          borderWidth={1}
          borderColor="$bordersColor"
          backgroundColor="$backgroundTertiary"
          testID={ELEMENT.onboarding.openUrlDialog}
        >
          <XStack alignItems="flex-start" gap="$1">
            <YStack flex={1} alignItems="center" gap="$0.5">
              <Text weight="bold">{tr('urlOpen')}</Text>
              {/* The plural wording, because the dialog offers both links rather than confirming
                  one. The catalogue has it as the "alternative" description. */}
              <Text size="$label" textAlign="center">
                {tr('urlOpenDescriptionAlternative')}
              </Text>
            </YStack>
            <Button
              variant="ghost"
              size="xs"
              circular
              accessibilityLabel={tr('close')}
              testID={ELEMENT.onboarding.openUrlCancel}
              onPress={() => {
                setOpen(false)
              }}
              icon={<Icon name="x" size="$4" color="$textPrimary" />}
            />
          </XStack>

          {/* The addresses themselves, each opening immediately. Showing the URL rather than the
              document's name is the point of the dialog: it is the last moment before leaving, and
              the thing worth reading is where you are going. */}
          <YStack borderRadius="$2" backgroundColor="$backgroundSecondary" overflow="hidden">
            {LINKS.map((link, index) => (
              <XStack
                key={link.url}
                role="button"
                alignItems="center"
                gap="$1"
                padding="$1.5"
                cursor="pointer"
                pressStyle={{ backgroundColor: '$backgroundTertiary' }}
                borderTopWidth={index === 0 ? 0 : 1}
                borderColor="$separatorColor"
                testID={link.testID}
                onPress={() => {
                  leaveFor(link.url)
                }}
              >
                {/* Wraps rather than truncates: half an address is worse than a tall row, because
                    the half that gets cut is the part that says which site it is. */}
                <Text flex={1} size="$label" weight="bold">
                  {link.url}
                </Text>
                <Icon name="externalLink" size="$4" color="$textPrimary" />
              </XStack>
            ))}
          </YStack>
        </YStack>
      </Modal>
    </YStack>
  )
}
