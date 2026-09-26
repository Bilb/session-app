import { tr } from '@session/localization'
import { useSessionActions, type CacheSettings } from '@session/state'
import { ELEMENT } from '@session/test-ids'
import { Text, YStack } from '@session/ui'
import { useEffect, useState } from 'react'

import { formatBytes } from './formatBytes'
import { PENDING_COPY } from './pendingCopy'

/** Where libsession keeps what it downloads, and how much of the disk it may use for it. */
export function AttachmentCacheSection() {
  const actions = useSessionActions()
  const [settings, setSettings] = useState<CacheSettings | null>(null)

  useEffect(() => {
    let live = true
    void actions.getCacheSettings().then((read) => {
      if (live) setSettings(read)
    })
    return () => {
      live = false
    }
  }, [actions])

  return (
    <YStack paddingVertical="$md" gap="$xs">
      <Text tone="secondary" size="$caption">
        {PENDING_COPY.attachmentCache}
      </Text>

      {/* Empty against the fake, which writes nothing to disk. */}
      {settings === null || settings.cacheDir.length === 0 ? null : (
        <Text size="$label" numberOfLines={1} testID={ELEMENT.settings.cacheFolder}>
          {settings.cacheDir}
        </Text>
      )}

      <Text size="$label" testID={ELEMENT.settings.cacheLimit}>
        {settings === null ? tr('loading') : limitLabel(settings.limitBytes)}
      </Text>
    </YStack>
  )
}

function limitLabel(bytes: number | undefined): string {
  return bytes === undefined ? PENDING_COPY.attachmentCacheNoLimit : formatBytes(bytes)
}
