import { describe, expect, it } from 'vitest'

import type { ComposerNoticeProps } from '#src/ComposerNotice'
import type { DropOverlayProps } from '#src/DropOverlay'
import type { StagedTrayProps } from '#src/StagedTray'

/** Held by `tsc`: each assignment is refused only while the prop takes registry ids alone. */
describe('the staging components’ test ids', () => {
  it('come from the registry', () => {
    const adHoc = 'not-in-the-registry'
    // @ts-expect-error -- an id the registry does not have
    const tray: StagedTrayProps['testID' | 'clearTestID' | 'addTestID'] = adHoc
    // @ts-expect-error -- an id the registry does not have
    const notice: ComposerNoticeProps['testID' | 'dismissTestID'] = adHoc
    // @ts-expect-error -- an id the registry does not have
    const overlay: DropOverlayProps['testID'] = adHoc
    expect([tray, notice, overlay]).toHaveLength(3)
  })
})
