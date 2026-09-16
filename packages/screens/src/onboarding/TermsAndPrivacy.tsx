import { tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import { Button, Icon, Modal, Text, XStack, YStack } from '@session/ui'
import { Fragment, useState } from 'react'

import { LocalizedText } from '../LocalizedText'
import { useConfirmUrl } from './ConfirmUrl'

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
 * target and confirmed one link at a time. The newer one is better on a phone, where two
 * three-word targets inside a paragraph are hard to hit, and better for translation, where every
 * language reorders those names and some do not keep them as contiguous runs at all.
 *
 * Not muted, and not selectable. It is a control, so dragging across it should do nothing; and the
 * whole sentence is primary text with the two document names bold, which is how the designs draw
 * it -- the emphasis is the only thing in it anybody is looking for.
 */
export function TermsAndPrivacy() {
  const [open, setOpen] = useState(false)
  const confirm = useConfirmUrl()

  return (
    <YStack>
      <Button
        variant="simple"
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
          size="$label"
          textAlign="center"
          userSelect="none"
        />
      </Button>

      <Modal
        open={open}
        onClose={() => {
          setOpen(false)
        }}
        title={tr('urlOpen')}
        closeLabel={tr('close')}
        testID={ELEMENT.onboarding.openUrlDialog}
        closeTestID={ELEMENT.onboarding.openUrlCancel}
      >
        <Text size="$body" textAlign="center">
          {tr('urlOpenDescriptionAlternative')}
        </Text>

        {/* The addresses themselves, each opening its own confirmation. Showing the URL rather than
            the document's name is the point: this is the last moment before leaving, and where you
            are going is the thing worth reading. */}
        {/**
         * **The client's own numbers, and they are not the base dialog's.** `MutipleLinksModal` is
         * a separate modal there with a separate rhythm: the box is padded 16 down and 12 across,
         * the rows are bare inside it, and 16 separates each row from the divider between them. So
         * the inset belongs to the box and not to the row, which is the opposite of what this had
         * -- rows padded 1.5 inside an unpadded box, which drew them hard against its edges.
         *
         * The two margins are the same story: the shared `Modal` gaps its children by 8 and leaves
         * 4 under the last one, which is right for a dialog whose final child is a full-width row
         * of buttons. This one ends in a box, and the client gives it 16 above and 24 below.
         */}
        <YStack
          marginTop={8}
          marginBottom={20}
          borderRadius={11}
          backgroundColor="$backgroundTertiary"
          paddingVertical={16}
          paddingHorizontal={12}
          gap={16}
        >
          {LINKS.map((link, index) => (
            <Fragment key={link.url}>
              {index === 0 ? null : <YStack height={1} backgroundColor="$separatorColor" />}
              <XStack
                role="button"
                alignItems="center"
                cursor="pointer"
                testID={link.testID}
                onPress={() => {
                  setOpen(false)
                  confirm(link.url)
                }}
              >
                {/* 16 bold, and it wraps rather than truncating -- the end of a URL is where a
                    deceptive one hides what it really is, so it is the view that gives way. The
                    text takes the width and pushes the icon to the trailing edge, which is why
                    there is no gap between them to set. */}
                <Text flex={1} size="$bodyLarge" weight="bold" userSelect="none">
                  {link.url}
                </Text>
                <Icon name="externalLink" size={20} color="$textPrimary" />
              </XStack>
            </Fragment>
          ))}
        </YStack>
      </Modal>
    </YStack>
  )
}
