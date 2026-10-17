import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

import { DECODE_PLAN_VECTORS, MEDIA_URL_VECTORS, SERVABLE_VECTORS } from '#src/mediaVectors'

/**
 * Writes `mediaVectors.ts` as a C++ header, for the host tests that hold the shim's
 * `parse_media_url`, `servable_content_type` and `decode_plan` to the same tables as the
 * TypeScript.
 *
 * `pnpm --filter @session/client-contract media-vectors:hpp <path>`, which `bridge-rn`'s
 * `tests/cpp/run.sh` runs before it compiles. A header rather than JSON because the shim has no
 * JSON library and a parser written for the test would be one more thing to hold to a table.
 */

const PRINTABLE = /^[ !#-&(-[\]-~]$/

/**
 * A `string_view` of exactly these bytes. With its length, since a run may hold a NUL; and as one
 * literal per byte, since a `\x` escape would otherwise swallow a hex digit after it.
 */
function literal(bytes: Uint8Array): string {
  const chars = [...bytes].map((byte) => {
    const char = String.fromCharCode(byte)
    return PRINTABLE.test(char) ? `"${char}"` : `"\\x${byte.toString(16).padStart(2, '0')}"`
  })
  return `std::string_view{${chars.length === 0 ? '""' : chars.join('')}, ${String(bytes.length)}}`
}

function utf8(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

function optional(type: string | null): string {
  return type === null ? 'std::nullopt' : literal(utf8(type))
}

function header(): string {
  const urls = MEDIA_URL_VECTORS.map(({ url, parsed }) => {
    const at = literal(utf8(url))
    if (parsed === null) return `        {${at}, false, "", 0, 0, ""},`
    if (parsed.kind === 'staged') {
      return `        {${at}, true, "staged", 0, 0, ${literal(utf8(parsed.path))}},`
    }
    return `        {${at}, true, "${parsed.kind}", ${String(parsed.messageId)}.0, ${String(parsed.index)}.0, ""},`
  })
  const servable = SERVABLE_VECTORS.map(
    ({ declared, bytes, served }) =>
      `        {${literal(utf8(declared))}, ${literal(bytes)}, ${optional(served)}},`,
  )
  const plans = DECODE_PLAN_VECTORS.map(
    ({ type, width, height, frames, plan }) =>
      `        {${literal(utf8(type))}, ${String(width)}.0, ${String(height)}.0, ${String(frames)}.0, ${String(plan.edge)}.0, ${String(plan.firstFrameOnly)}, ${String(plan.refused)}, ${String(plan.measured)}},`,
  )
  return `// Generated from packages/client-contract/src/mediaVectors.ts by scripts/writeMediaVectors.ts.
#pragma once

#include <optional>
#include <string_view>
#include <vector>

namespace media_vectors {

struct Url {
    std::string_view url;
    bool parses;
    std::string_view kind;
    double message_id;
    double index;
    std::string_view path;
};

struct Servable {
    std::string_view declared;
    std::string_view bytes;
    std::optional<std::string_view> served;
};

struct DecodePlan {
    std::string_view type;
    double width;
    double height;
    double frames;
    double edge;
    bool first_frame_only;
    bool refused;
    bool measured;
};

inline const std::vector<Url> URLS{
${urls.join('\n')}
};

inline const std::vector<Servable> SERVABLE{
${servable.join('\n')}
};

inline const std::vector<DecodePlan> DECODE_PLANS{
${plans.join('\n')}
};

}  // namespace media_vectors
`
}

const out = process.argv[2]
if (out === undefined) throw new Error('usage: writeMediaVectors.ts <path/to/media_vectors.hpp>')
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, header())
