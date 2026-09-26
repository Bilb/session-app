import { tr } from '@session/localization'
import { useSessionActions, type CacheSettings } from '@session/state'
import { ELEMENT, type ElementId } from '@session/test-ids'
import { Text, XStack, YStack } from '@session/ui'
import { useEffect, useState } from 'react'

import { formatBytes } from './formatBytes'
import { PENDING_COPY } from './pendingCopy'

function limitLabel(bytes: number | undefined): string {
  return bytes === undefined ? PENDING_COPY.attachmentCacheNoLimit : formatBytes(bytes)
}

function CacheFigure({
  label,
  value,
  testID,
}: {
  label: string
  value: string
  testID: ElementId
}) {
  return (
    <XStack alignItems="center" gap="$sm" justifyContent="space-between">
      <Text size="$label" tone="secondary">
        {label}
      </Text>
      <Text size="$label" testID={testID}>
        {value}
      </Text>
    </XStack>
  )
}

/** Where libsession keeps what it downloads, how much of the disk that takes, and its limit. */
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

      <CacheFigure
        label={PENDING_COPY.attachmentCacheUsage}
        value={settings === null ? tr('loading') : formatBytes(settings.usageBytes)}
        testID={ELEMENT.settings.cacheUsage}
      />
      <CacheFigure
        label={PENDING_COPY.attachmentCacheLimit}
        value={settings === null ? tr('loading') : limitLabel(settings.limitBytes)}
        testID={ELEMENT.settings.cacheLimit}
      />
    </YStack>
  )
}
