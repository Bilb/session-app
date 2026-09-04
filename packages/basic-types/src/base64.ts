import type { Base64String } from './brandedStrings'

export function asBase64(value: string): Base64String {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw new Error('expected base64 string')
  }
  return value as Base64String
}
