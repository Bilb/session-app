import { routes, useNav } from '@session/app'
import { useSessionActions } from '@session/state'
import { ELEMENT } from '@session/test-ids'
import { Button, Input, Screen, Text, YStack } from '@session/ui'
import { useState } from 'react'

/**
 * Starting a conversation from an account ID.
 *
 * The only way to write to somebody who has not written first — until this existed, sending
 * could only happen by replying to a message request, which is half of a messenger.
 *
 * There is no QR scanner and no contact list yet, so this is a field and a button. libsession
 * validates the id and says what is wrong with it, which is a better message than anything
 * this screen could invent.
 */
export function NewConversationScreen() {
  const actions = useSessionActions()
  const nav = useNav()
  const [accountId, setAccountId] = useState('')
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)

  function start(): void {
    if (accountId.trim().length === 0 || busy) return
    setBusy(true)
    setFailed(null)
    actions
      .startConversation(accountId)
      .then((id) => {
        // Replace rather than push: coming back to a filled-in form after opening the
        // conversation it created is not somewhere anybody wants to be.
        nav.replace(routes.conversation(id))
      })
      .catch((error: unknown) => {
        setFailed(error instanceof Error ? error.message : String(error))
        setBusy(false)
      })
  }

  return (
    <Screen padded testID={ELEMENT.newConversation.screen}>
      <YStack gap="$1.5">
        <Text size="$6" weight="bold">
          New conversation
        </Text>
        <Text tone="secondary" size="$3">
          Paste the account ID of whoever you want to write to.
        </Text>

        <Input
          value={accountId}
          onChangeText={setAccountId}
          placeholder="05…"
          autoCapitalize="none"
          testID={ELEMENT.newConversation.accountIdInput}
          onSubmit={start}
        />

        <Button testID={ELEMENT.newConversation.start} disabled={busy} onPress={start}>
          {busy ? 'Opening…' : 'Start'}
        </Button>

        {failed === null ? null : (
          <Text tone="danger" size="$2" testID={ELEMENT.newConversation.error}>
            {failed}
          </Text>
        )}
      </YStack>
    </Screen>
  )
}
