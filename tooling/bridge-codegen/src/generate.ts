import { emitJsi } from '#src/emitJsi'
import { emitNapi } from '#src/emitNapi'
import { emitTypes } from '#src/emitTypes'
import { extractModel } from '#src/model'

export interface GenerateOptions {
  /** The module whose exports name the roots. */
  entryFile: string
  /** Exported type names to start from; everything reachable from them is generated. */
  roots: string[]
  /** How the generated banner names the source, e.g. `packages/bridge-types/src`. */
  sourceLabel: string
}

export type GeneratedFiles = Record<'types.hpp' | 'jsi.hpp' | 'napi.hpp', string>

export function generate(options: GenerateOptions): GeneratedFiles {
  const model = extractModel({ entryFile: options.entryFile, roots: options.roots })
  return {
    'types.hpp': emitTypes(model, options.sourceLabel),
    'jsi.hpp': emitJsi(model, options.sourceLabel),
    'napi.hpp': emitNapi(model, options.sourceLabel),
  }
}
