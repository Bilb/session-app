import { useNav } from '@session/app'
import { tr } from '@session/localization'
import type { ElementId } from '@session/test-ids'
import { backChevron, BarButton } from '@session/ui'

import { useShowsBack } from './shell/pane'

/**
 * The way back, drawn the same way everywhere.
 *
 * Three screens grew one of these independently and two of them said "Back" in a language the
 * third would not have. A chevron says it in none, which is the point: it is the affordance every
 * platform already uses for this, and it does not have to be translated, wrapped or measured
 * against a title beside it.
 *
 * `tr('back')` has not gone away, it has moved to the accessibility label - the word is still what
 * a screen reader should say, and an icon-only control that announces nothing is a control some
 * people cannot use.
 *
 * A bar button, so on iOS 26 it sits on glass like the system's own back, and elsewhere is the
 * desktop's circle, as onboarding's back already is.
 */
export function BackButton({ testID }: { testID: ElementId }) {
  const nav = useNav()
  const showsBack = useShowsBack()

  if (!showsBack) return null
  return (
    <BarButton
      icon={backChevron()}
      accessibilityLabel={tr('back')}
      testID={testID}
      onPress={() => nav.back()}
    />
  )
}
