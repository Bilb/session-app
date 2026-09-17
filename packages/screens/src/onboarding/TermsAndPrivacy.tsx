import { URLS } from '@session/app'
import { tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import { Button, Icon, Modal, Text, XStack, YStack } from '@session/ui'
import { Fragment, useState } from 'react'

import { LocalizedText } from '../LocalizedText'
import { useConfirmUrl } from './ConfirmUrl'

/** The two documents this footer links to, paired with the ids a test addresses them by. */
const LINKS = [
  { url: URLS.termsOfService, testID: ELEMENT.onboarding.openTerms },
  { url: URLS.privacyPolicy, testID: ELEMENT.onboarding.openPrivacy },
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
        // This dialog's own, not the alert's: 20 across rather than 35, and 20 under the box
        // rather than the 4 an actions row wants. See the props.
        sideInset={20}
        bottomInset={20}
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
         * Only the top margin is set here. The 16 the client leaves above the box is this 8 plus
         * the dialog's own 8 between children; the room below it belongs to the dialog, which is
         * told to leave 20 rather than the 4 an actions row wants -- a margin here and a padding
         * there would add to the same gap from two places.
         */}
        <YStack
          marginTop={8}
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
