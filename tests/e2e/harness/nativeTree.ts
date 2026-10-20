/** One element of an Appium page source: its tag, its attributes, and where it sits. */
export interface NativeNode {
  tag: string
  attributes: Readonly<Record<string, string>>
  parent: NativeNode | null
  children: NativeNode[]
}

const ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
}

function unescape(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (whole, entity: string) => {
    if (entity.startsWith('#x') || entity.startsWith('#X'))
      return String.fromCodePoint(Number.parseInt(entity.slice(2), 16))
    if (entity.startsWith('#')) return String.fromCodePoint(Number.parseInt(entity.slice(1), 10))
    return ENTITIES[entity] ?? whole
  })
}

const TAG = /<(\/?)([\w.$:-]+)((?:\s+[\w.:-]+="[^"]*")*)\s*(\/?)>/g
const ATTRIBUTE = /([\w.:-]+)="([^"]*)"/g

/**
 * The page source both drivers answer with, as a tree. Their XML is flat attributes on nested
 * tags with no text content, which is all this reads; the declaration and comments are skipped.
 */
export function parseNativeTree(xml: string): NativeNode {
  const root: NativeNode = { tag: '#root', attributes: {}, parent: null, children: [] }
  let open = root
  for (const [, closing, tag = '', attributes = '', selfClosing] of xml.matchAll(TAG)) {
    if (closing === '/') {
      open = open.parent ?? root
      continue
    }
    const node: NativeNode = {
      tag,
      attributes: Object.fromEntries(
        [...attributes.matchAll(ATTRIBUTE)].map(([, name = '', value = '']) => [
          name,
          unescape(value),
        ]),
      ),
      parent: open,
      children: [],
    }
    open.children.push(node)
    if (selfClosing !== '/') open = node
  }
  return root
}

/** Every node under `root`, in document order, which is the order a driver's find answers in. */
export function* walk(root: NativeNode): Generator<NativeNode> {
  for (const child of root.children) {
    yield child
    yield* walk(child)
  }
}
