import { requirePorts } from '@session/app'
import { MAX_ATTACHMENTS_PER_MESSAGE } from '@session/basic-types'
import { tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import {
  Announcement,
  ATTACH_OPENS_MENU,
  Button,
  ComposerNotice,
  Icon,
  Input,
  StagedTile,
  StagedTray,
  XStack,
  YStack,
} from '@session/ui'
import { useRef, useState } from 'react'

import { AttachMenu } from './AttachMenu'
import { PENDING_COPY } from './pendingCopy'
import { refusalAnnouncement, refusalNotices } from './refusalNotices'
import { isFull, sizeOf } from './staging'
import type { StagingState } from './useStaging'

function Notices({ staging }: { staging: StagingState }) {
  const notices = refusalNotices(staging.refused)
  return (
    <>
      <Announcement text={refusalAnnouncement(notices)} announceKey={staging.refusal} />
      {notices.map(({ kind, id, message, detail }) => (
        <ComposerNotice
          key={kind}
          message={message}
          detail={detail}
          dismissLabel={tr('close')}
          onDismiss={() => {
            staging.dismiss(kind)
          }}
          testID={ELEMENT.conversation.composerNotice(id)}
          dismissTestID={ELEMENT.conversation.composerNoticeDismiss(id)}
        />
      ))}
    </>
  )
}

/**
 * The bottom of a conversation: what is staged, why anything was refused, and the line being typed.
 *
 * `attaching` is the feature flag. Off, this is the text composer it always was: no +, no tray.
 */
export function Composer({
  staging,
  attaching,
  onSend,
}: {
  staging: StagingState
  attaching: boolean
  onSend: (body: string) => void
}) {
  const [draft, setDraft] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const picking = useRef(false)
  const full = isFull(staging.files)
  // TODO: send the staged files with the body once `sendMessage` can carry attachments. Until
  // then a message with files staged waits, rather than going out without them.
  const holding = staging.files.length > 0
  const sendable = draft.trim().length > 0 && !holding

  function send(): void {
    const body = draft.trim()
    if (body.length === 0 || holding) return
    // Cleared straight away: libsession stores the row before the promise settles, so the
    // message appears on its own and there is nothing to put back if this fails.
    setDraft('')
    onSend(body)
  }

  function pick(which: 'files' | 'images'): void {
    // One picker at a time: a second press while one is up is refused by the system picker.
    if (picking.current) return
    picking.current = true
    const { files } = requirePorts()
    const limit = MAX_ATTACHMENTS_PER_MESSAGE - staging.files.length
    const chosen =
      which === 'images' ? files.pickImages({ multiple: true, limit }) : files.pickFiles()
    // Closed once the picker is done rather than before it opens: iOS presents the picker over the
    // menu's modal, and one presented while that modal is still dismissing never appears.
    void staging.take(chosen).finally(() => {
      picking.current = false
      setMenuOpen(false)
    })
  }

  function attach(): void {
    if (ATTACH_OPENS_MENU) setMenuOpen(true)
    else pick('files')
  }

  return (
    <YStack padding="$md" gap="$sm" borderTopWidth={1} borderTopColor="$bordersColor">
      {attaching ? <Notices staging={staging} /> : null}
      {attaching && staging.files.length > 0 ? (
        <StagedTray
          countLabel={PENDING_COPY.attachmentsStagedCount(
            staging.files.length,
            MAX_ATTACHMENTS_PER_MESSAGE,
          )}
          clearLabel={tr('clear')}
          onClear={staging.clear}
          addLabel={tr('attachmentsAdd')}
          onAdd={full ? undefined : attach}
          previousLabel={PENDING_COPY.previous}
          nextLabel={tr('next')}
          testID={ELEMENT.conversation.stagedTray}
          clearTestID={ELEMENT.conversation.stagedClear}
          addTestID={ELEMENT.conversation.stagedAdd}
          previousTestID={ELEMENT.conversation.stagedPrevious}
          nextTestID={ELEMENT.conversation.stagedNext}
        >
          {staging.files.map((file, index) => (
            <StagedTile
              key={file.path}
              name={file.name}
              contentType={file.contentType}
              sizeLabel={sizeOf(file)}
              previewUrl={file.previewUrl}
              label={[file.name, sizeOf(file)].filter(Boolean).join(', ')}
              removeLabel={PENDING_COPY.attachmentRemove(file.name)}
              onRemove={() => {
                staging.remove(file.path)
              }}
              testID={ELEMENT.conversation.stagedTile(index)}
              removeTestID={ELEMENT.conversation.stagedRemove(index)}
              previewTestID={ELEMENT.conversation.stagedPreview(index)}
            />
          ))}
        </StagedTray>
      ) : null}
      <XStack gap="$sm" alignItems="center">
        {attaching ? (
          <Button
            variant="tonal"
            size="md"
            circular
            disabled={full}
            icon={<Icon name="plus" size="md" color="$textPrimary" />}
            accessibilityLabel={tr('attachmentsAdd')}
            onPress={attach}
            testID={ELEMENT.conversation.attachButton}
          />
        ) : null}
        <Input
          grow
          value={draft}
          onChangeText={setDraft}
          placeholder={tr('message')}
          onSubmit={send}
          testID={ELEMENT.conversation.composerInput}
        />
        <Button
          size="md"
          onPress={send}
          disabled={!sendable}
          testID={ELEMENT.conversation.sendButton}
        >
          {tr('send')}
        </Button>
      </XStack>
      {attaching && ATTACH_OPENS_MENU ? (
        <AttachMenu
          open={menuOpen}
          onClose={() => {
            setMenuOpen(false)
          }}
          onMedia={() => {
            pick('images')
          }}
          onDocument={() => {
            pick('files')
          }}
        />
      ) : null}
    </YStack>
  )
}
