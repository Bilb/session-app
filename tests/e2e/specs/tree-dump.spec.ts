import { test } from '@playwright/test'
import { ELEMENT } from '@session/test-ids'

import { openFirstConversation } from '../harness/attachments'
import { MobileApp } from '../harness/MobileApp'
import { parseNativeTree, walk, type NativeNode } from '../harness/nativeTree'

// Throwaway: every footer control under 44pt the audit's walk meets on an iPhone, with its line.
const IDS = /message-attachment-(view-list|view-gallery|action)/
const chain = (n: NativeNode) => {
  const out: string[] = []
  for (let at: NativeNode | null = n; at !== null && out.length < 8; at = at.parent)
    out.push(`${at.tag.replace('XCUIElementType', '')}[${at.attributes['name'] ?? ''}|${at.attributes['label'] ?? ''}] ${at.attributes['x']},${at.attributes['y']} ${at.attributes['width']}x${at.attributes['height']}`)
  return out.join(' < ')
}
test('walks the showcase on a phone @ios', async () => {
  const app = await MobileApp.launch('ios', 'alice', { form: 'phone', env: { EXPO_PUBLIC_SESSION_FAKE_FIXTURE: 'showcase' } })
  const driver = (app as unknown as { driver: { getPageSource(): Promise<string> } }).driver
  try {
    await openFirstConversation(app)
    for (let step = 0; step < 30; step++) if (!(await app.scroll(ELEMENT.conversation.screen, -1))) break
    const seen = new Set<string>()
    for (let step = 0; step < 40; step++) {
      const root = parseNativeTree(await driver.getPageSource())
      for (const n of walk(root)) {
        const name = n.attributes['name'] ?? ''
        if (!IDS.test(name) || n.attributes['visible'] !== 'true') continue
        const w = Number(n.attributes['width']), h = Number(n.attributes['height'])
        if (w >= 44 && h >= 44) continue
        const line = `step ${String(step)} ${chain(n)}`
        if (!seen.has(line)) { seen.add(line); console.log(`small ${line}`) }
      }
      if (!(await app.scroll(ELEMENT.conversation.screen, 1, 0.6))) break
    }
    console.log(`small done, ${String(seen.size)} found`)
  } finally {
    await app.close()
  }
})
