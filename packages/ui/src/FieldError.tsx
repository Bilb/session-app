import { Text } from './Text'

export interface FieldErrorProps {
  /** Whether there is currently something to say. Nothing is drawn when false. */
  showing: boolean
  /** The message, already chosen from the catalogue by whoever knows which refusal this was. */
  message: string
  testID?: string
}

/**
 * What a field says when it has been refused.
 *
 * **Centred under the field**, as both clients set it: the field is the full width of the column
 * and the message is usually much shorter, so left-aligned it reads as a label for the field
 * rather than as a complaint about what is in it.
 *
 * Takes the message rather than choosing it, because which refusal this was is the screen's to
 * know -- too short, too long, or the bridge declining to say. What is shared is how it looks.
 *
 * **It does not reserve its own height.** The layout above it does, so the control below does not
 * move when a message arrives, and a message box that reserved height too would reserve it twice.
 */
export function FieldError({ showing, message, testID }: FieldErrorProps) {
  if (!showing) return null
  return (
    <Text
      tone="danger"
      size="$label"
      weight="bold"
      textAlign="center"
      {...(testID === undefined ? {} : { testID })}
    >
      {message}
    </Text>
  )
}
