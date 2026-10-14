import { describe, expect, it } from 'vitest'

import { addressShape, renderAddress } from '#src/address'

describe('addressShape', () => {
  it.each([
    ['127.0.0.1', 'v4', 'loopback'],
    ['10.1.2.3', 'v4', 'private'],
    ['172.20.0.1', 'v4', 'private'],
    ['192.168.1.20', 'v4', 'private'],
    ['169.254.3.4', 'v4', 'private'],
    ['100.72.0.1', 'v4', 'cgnat'],
    ['0.0.0.0', 'v4', 'unspecified'],
    ['144.76.164.202', 'v4', 'public'],
    ['::1', 'v6', 'loopback'],
    ['::', 'v6', 'unspecified'],
    ['fd12:3456::1', 'v6', 'private'],
    ['fe80::1%en0', 'v6', 'private'],
    ['2a01:4f8:1c1c::1', 'v6', 'public'],
    ['::ffff:192.168.0.4', 'v6-mapped', 'private'],
    ['[::ffff:144.76.164.202]', 'v6-mapped', 'public'],
  ])('%s is %s %s', (host, family, kind) => {
    expect(addressShape(host)).toEqual({ family, class: kind })
  })

  it('is undefined for a name', () => {
    expect(addressShape('seed1.getsession.org')).toBeUndefined()
    expect(addressShape('300.1.1.1')).toBeUndefined()
  })
})

describe('renderAddress', () => {
  it('writes the class and port, never the octets', () => {
    expect(renderAddress('144.76.164.202', 22021)).toBe('v4 public:22021')
    expect(renderAddress('::ffff:10.0.0.2')).toBe('v6-mapped private')
  })
})
