export type Base64String = string & { __brand: 'b64' }
export type HexString = string & { __brand: 'hex' }
export type UnknownString = string & { __brand: 'other' }

export type SeedNodeURL = `http${string}`
