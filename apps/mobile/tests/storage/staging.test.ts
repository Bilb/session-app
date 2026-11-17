import { describe, expect, it, vi } from 'vitest'

const deleted: string[] = []
const entries = ['a.jpg', 'b.mov'].map((name) => ({
  name,
  delete: () => {
    deleted.push(name)
  },
}))
let list = () => entries
const root = { uri: 'file:///roots/staged/', list: () => list(), delete: vi.fn() }
const removeIfPresent = vi.fn()

vi.mock('expo-crypto', () => ({ randomUUID: () => 'id' }))
vi.mock('#src/storage/roots', () => ({
  File: class {},
  moveInto: vi.fn(),
  removeIfPresent,
  stagedDirectory: () => root,
}))

const { sweepStaged } = await import('#src/storage/staging')

describe('the launch sweep of staged picks', () => {
  it('empties the root and leaves the root, which the native module protected', () => {
    sweepStaged()
    expect(deleted).toEqual(['a.jpg', 'b.mov'])
    expect(root.delete).not.toHaveBeenCalled()
    expect(removeIfPresent).not.toHaveBeenCalled()
  })

  it('lets the app start when the root cannot be read', () => {
    list = () => {
      throw new Error('unreadable')
    }
    expect(() => {
      sweepStaged()
    }).not.toThrow()
  })
})
