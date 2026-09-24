import { useEffect, useImperativeHandle, useRef, useState, type ReactNode, type Ref } from 'react'
import { FONT_SIZE, LINE_HEIGHT_RATIO, SPACING } from '@session/theme-tokens'
import { YStack } from 'tamagui'

import { FieldError } from './FieldError'
import { Input } from './Input'
import type { InputProps } from './Input.types'

/**
 * Room for two lines of message before anything below the field moves.
 *
 * Two rather than one because the ordinary case already wraps: the recovery phrase's refusal is
 * two lines in English before any translation makes it longer. Past two it grows and pushes what
 * follows down, which is the designs' rule -- a control sliding is acceptable for an unusually
 * long message and not for the ordinary one.
 *
 * Derived rather than written down, because a figure that has to agree with the type ramp and the
 * padding below drifts the moment either moves. A hard-coded 34 was a line and a half, so the
 * control it was holding still moved anyway.
 */
const RESERVED_HEIGHT = Math.round(FONT_SIZE.label * LINE_HEIGHT_RATIO) * 2 + SPACING.sm * 2

export interface InputFieldHandle {
  /**
   * Submits as though the keyboard had, and says whether it passed.
   *
   * For the button that usually sits below one of these: it triggers the same action, so it has to
   * go through the same check, or a field refuses a value typed into it and accepts the same value
   * when the button is pressed instead.
   */
  submit: () => boolean
}

/**
 * `error` and `errorText` are `Input`'s booleans and this derives both, so they are not passable:
 * a caller that set them by hand would be overriding the rule this exists to hold.
 */
export interface InputFieldProps extends Omit<
  InputProps,
  'error' | 'errorText' | 'end' | 'onSubmit'
> {
  ref?: Ref<InputFieldHandle>
  /**
   * Given the text as it stands when the keyboard or `submit` fires -- which can be newer than
   * `value`. Read this rather than the caller's own state.
   */
  onSubmit?: (value: string) => void
  /**
   * Drawn inside the field against its trailing edge, as `Input` takes it.
   *
   * A function where the control has to agree with the field's state -- a reveal toggle turns red
   * with the text around it -- since whether a message is showing is this component's to know.
   */
  end?: ReactNode | ((showing: boolean) => ReactNode)
  /** What to say about this value, or null when it is fine. */
  validate?: (value: string) => string | null
  /**
   * When `validate` runs.
   *
   * **`submit` by default, because most checks are rude while somebody is still typing** -- a URL
   * or an account id is invalid for as long as it is half-entered, and saying so on every
   * keystroke is noise rather than help.
   *
   * `change` is for the field whose message explains something already on screen: a character
   * counter going negative wants its explanation at the same moment, not on submit.
   */
  validateOn?: 'change' | 'submit'
  /**
   * A refusal from somewhere this field cannot see, such as the bridge declining the value.
   *
   * Latched rather than read straight through: it describes an attempt that is over, so it clears
   * on the next keystroke the way a local refusal does. Null when there is none.
   */
  error?: string | null
  /**
   * Hold the message's height open even when there is no message.
   *
   * On wherever something sits below the field and should not move when a message arrives -- a
   * Continue button, most often. Off inside a form of several fields, where a reserved gap under
   * each one reads as loose spacing.
   */
  reserveErrorSpace?: boolean
  errorTestID?: string
}

/**
 * A text field and what it says when it is wrong.
 *
 * **The standard way to take input that can be refused**, rather than an `Input` with the rule
 * rebuilt around it each time. Two things are worth holding in one place: where the message goes
 * -- below the box, centred, every time -- and how a refusal fades.
 *
 * **A refusal fades in stages, which is two facts rather than one.** The border, the text and any
 * icon turn red on a failed submit; typing returns the text and clears the message **but leaves
 * the border red** until the field is submitted again. A single flag cannot express that, so one
 * says the last submit failed and the other says nothing has been typed since. The message
 * clearing on the first keystroke is deliberate: a stale error under a field somebody is actively
 * correcting is confusing.
 *
 * A message from `validate` outranks a latched `error`, because it describes what is on screen and
 * the latched one describes an attempt that is already over.
 */
export function InputField({
  ref,
  validate,
  validateOn = 'submit',
  error = null,
  reserveErrorSpace = false,
  errorTestID,
  end,
  value,
  onChangeText,
  onSubmit,
  ...input
}: InputFieldProps) {
  /** The last submit was refused. Sticky, so the border stays red through a correction. */
  const [sticky, setSticky] = useState(false)
  /** Nothing has been typed since, so the message and the red text still stand. */
  const [showing, setShowing] = useState(false)
  /** What the last submit said, kept because `validate` is not re-run until the next one. */
  const [refused, setRefused] = useState<string | null>(null)

  useEffect(() => {
    if (error === null) return
    setSticky(true)
    setShowing(true)
  }, [error])

  /**
   * The text as last typed, ahead of `value`.
   *
   * Characters and the return key can reach JS in one batch -- a paste, a fast typist, the
   * simulator's typing -- and the submit then runs before the render that would have carried them
   * into `value`. Read from props, the name step submitted an empty name that way.
   */
  const latest = useRef(value)
  latest.current = value

  const live = validateOn === 'change' ? (validate?.(value) ?? null) : null
  const message = live ?? (showing ? (refused ?? error) : null)

  const submit = () => {
    // Checked here rather than by the caller, so every field refuses the same way and a second
    // submit of the same wrong value says so again -- which it would not if the caller passed the
    // message down and it happened not to change.
    const current = latest.current
    const problem = validate?.(current) ?? null
    setRefused(problem)
    if (problem !== null) {
      setSticky(true)
      setShowing(true)
      return false
    }
    onSubmit?.(current)
    return true
  }

  useImperativeHandle(ref, () => ({ submit }))

  return (
    <>
      <Input
        {...input}
        value={value}
        onChangeText={(next) => {
          latest.current = next
          onChangeText(next)
          setShowing(false)
        }}
        onSubmit={submit}
        {...(end === undefined
          ? {}
          : { end: typeof end === 'function' ? end(message !== null) : end })}
        error={live !== null || sticky}
        errorText={message !== null}
      />
      {reserveErrorSpace || message !== null ? (
        <YStack
          {...(reserveErrorSpace ? { minHeight: RESERVED_HEIGHT } : {})}
          paddingTop="$sm"
          paddingBottom="$sm"
        >
          <FieldError
            showing={message !== null}
            message={message ?? ''}
            {...(errorTestID === undefined ? {} : { testID: errorTestID })}
          />
        </YStack>
      ) : null}
    </>
  )
}
