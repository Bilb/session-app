import type { PrimaryColorState, ThemeState } from '@session/theme-tokens'
import { ELEMENT } from '@session/test-ids'
import { useEffect, useState } from 'react'
import { Theme, XStack, YStack } from 'tamagui'

import { InteractionOverride, type ForcedInteraction } from '../interactionOverride'
import { Text } from '../Text'
import { applyDirection } from '../textDirection'
import { registerTheme, themeName } from '../themes'
import type { CatalogPageSpec } from './pages'
import type { ForcedState } from './story'

const REST: ForcedInteraction = { hovered: false, pressed: false, focused: false }
const FORCED: Record<ForcedState, ForcedInteraction> = {
  hover: { hovered: true, pressed: false, focused: false },
  press: { hovered: false, pressed: true, focused: false },
  focus: { hovered: false, pressed: false, focused: true },
}

const SETTLE_POLL_MS = 100
const SETTLE_TRIES = 100

/** Until every picture on the page has decoded and no new one has appeared for one poll. */
async function picturesSettled(): Promise<void> {
  let seen = -1
  for (let attempt = 0; attempt < SETTLE_TRIES; attempt++) {
    const pictures = Array.from(document.images)
    // A source that never answers leaves `decode` pending for good, so each poll waits one round.
    const poll = new Promise((resolve) => setTimeout(resolve, SETTLE_POLL_MS))
    await Promise.race([
      Promise.all(pictures.map((picture) => picture.decode().catch(() => undefined))),
      poll,
    ])
    await poll
    if (pictures.length === seen && pictures.every((picture) => picture.complete)) return
    seen = pictures.length
  }
  const pending = Array.from(document.images).filter((picture) => !picture.complete)
  console.warn(`[catalog] ${String(pending.length)} pictures never loaded`, pending[0]?.src)
}

/** Under the capture window's width, so a page of seven accents wraps rather than clips. */
const PAGE_MAX_WIDTH = 2800

interface SegmentProps {
  page: CatalogPageSpec
  theme: ThemeState
  accent: PrimaryColorState
  title: string
  row: string
  props: never
}

/**
 * One variant in one theme and accent, a cell per drawn state. Top-aligned, so a cell that grows
 * moves none of its neighbours.
 */
function Segment({ page, theme, accent, title, row, props }: SegmentProps) {
  const states = ['rest', ...(page.forced ? (page.story.forced ?? []) : [])] as const
  return (
    <Theme name={themeName(theme, accent)}>
      <YStack backgroundColor="$backgroundPrimary" padding="$md" gap="$xs">
        <Text size="$caption" tone="secondary">
          {title}
        </Text>
        <XStack gap="$sm" alignItems="flex-start">
          {states.map((state) => (
            <YStack key={state} width={page.width} gap="$xs">
              {states.length === 1 ? null : (
                <Text size="$caption" tone="secondary">
                  {state}
                </Text>
              )}
              <InteractionOverride.Provider value={state === 'rest' ? REST : FORCED[state]}>
                <YStack testID={ELEMENT.catalog.cell(page.id, row, `${title}-${state}`)}>
                  {page.story.render(props)}
                </YStack>
              </InteractionOverride.Provider>
            </YStack>
          ))}
        </XStack>
      </YStack>
    </Theme>
  )
}

/** Each theme and accent the page draws, in order, with the title its segment carries. */
function segmentsOf(
  page: CatalogPageSpec,
): { theme: ThemeState; accent: PrimaryColorState; title: string }[] {
  if (page.kind === 'accents')
    return page.accents.flatMap((accent) =>
      page.themes.map((theme) => ({ theme, accent, title: `${accent} · ${theme}` })),
    )
  const accent = page.accents[0] ?? 'green'
  return page.themes.map((theme) => ({
    theme,
    accent,
    title: page.kind === 'width' ? `${theme} · ${String(page.width)}px` : theme,
  }))
}

/**
 * Every combination a catalog page names: a row per variant, each its own capture, with the
 * page's themes and accents side by side in it.
 */
export function CatalogPage({ page }: { page: CatalogPageSpec }) {
  // Registered before the first render: registering a theme wakes every themed component mounted.
  // The direction too, as the app sets it, since what asks `isLayoutRtl()` reads the document.
  useState(() => {
    applyDirection(page.rtl)
    for (const theme of page.themes) for (const accent of page.accents) registerTheme(theme, accent)
    return null
  })
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let cancelled = false
    // Fonts first, then two frames: one to lay out in them, one to paint.
    void Promise.all([document.fonts.ready, picturesSettled()]).then(() =>
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (!cancelled) setReady(true)
        }),
      ),
    )
    return () => {
      cancelled = true
    }
  }, [])

  const segments = segmentsOf(page)
  return (
    <YStack alignItems="flex-start" padding="$md" gap="$sm">
      <YStack testID={ELEMENT.catalog.page} gap="$xs" alignItems="flex-start">
        {Object.entries(page.story.variants).map(([row, props]) => (
          <XStack
            key={row}
            testID={ELEMENT.catalog.row(page.id, row)}
            gap="$xs"
            alignItems="flex-start"
            flexWrap="wrap"
            maxWidth={PAGE_MAX_WIDTH}
          >
            {segments.map(({ theme, accent, title }) => (
              <Segment
                key={title}
                page={page}
                theme={theme}
                accent={accent}
                title={title}
                row={row}
                props={props}
              />
            ))}
          </XStack>
        ))}
      </YStack>
      {ready ? (
        <Text testID={ELEMENT.catalog.ready} size="$caption" tone="secondary">
          {page.id}
        </Text>
      ) : null}
    </YStack>
  )
}
