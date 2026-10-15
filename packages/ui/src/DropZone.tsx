import { useEffect, useRef, type ElementRef } from 'react'
import { YStack } from 'tamagui'

import type { DropZoneProps } from './DropZone.types'

export type { DropZoneProps }

function carriesFiles(event: DragEvent): boolean {
  return event.dataTransfer?.types.includes('Files') ?? false
}

/**
 * Where files can be dropped: the whole of what it wraps, not only the composer.
 *
 * Counted rather than toggled, because the browser sends a leave for every child the pointer
 * crosses, each just after the enter of the next one. A flag would flicker the overlay off and on
 * across every bubble in the transcript.
 */
export function DropZone({ enabled, onActive, onDrop, children, overlay }: DropZoneProps) {
  const zone = useRef<ElementRef<typeof YStack>>(null)
  // Read through refs so the listeners are bound once, not once per render of the screen.
  const handlers = useRef({ onActive, onDrop })
  handlers.current = { onActive, onDrop }

  useEffect(() => {
    // tamagui hands back the DOM node on the web.
    const element = zone.current as unknown as HTMLElement | null
    if (!enabled || element === null) return
    let depth = 0

    const enter = (event: DragEvent) => {
      if (!carriesFiles(event)) return
      event.preventDefault()
      depth += 1
      if (depth === 1) handlers.current.onActive(true)
    }
    const over = (event: DragEvent) => {
      if (!carriesFiles(event)) return
      // Without this the browser refuses the drop and opens the file in place of the app.
      event.preventDefault()
      if (event.dataTransfer !== null) event.dataTransfer.dropEffect = 'copy'
    }
    const leave = (event: DragEvent) => {
      if (!carriesFiles(event)) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) handlers.current.onActive(false)
    }
    const drop = (event: DragEvent) => {
      if (!carriesFiles(event)) return
      event.preventDefault()
      depth = 0
      handlers.current.onActive(false)
      handlers.current.onDrop(Array.from(event.dataTransfer?.files ?? []))
    }

    element.addEventListener('dragenter', enter)
    element.addEventListener('dragover', over)
    element.addEventListener('dragleave', leave)
    element.addEventListener('drop', drop)
    return () => {
      element.removeEventListener('dragenter', enter)
      element.removeEventListener('dragover', over)
      element.removeEventListener('dragleave', leave)
      element.removeEventListener('drop', drop)
      if (depth > 0) handlers.current.onActive(false)
    }
  }, [enabled])

  return (
    <YStack ref={zone} flex={1} position="relative">
      {children}
      {overlay === undefined || overlay === null ? null : (
        <YStack position="absolute" top={0} right={0} bottom={0} left={0} pointerEvents="none">
          {overlay}
        </YStack>
      )}
    </YStack>
  )
}
