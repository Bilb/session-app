import { BANNER, doc, fieldType, forEachDeclaration, member } from '#src/cpp'
import type { Model } from '#src/model'
import { snake } from '#src/names'

/**
 * Plain C++ for the protocol: no JSI, no N-API, nothing the shim cannot include on every platform.
 *
 * A struct with fields has exactly one constructor, taking all of them, and no default constructor.
 * That is the whole enforcement story on the C++ side: a field added to the TypeScript is a field
 * the shim fails to compile until it supplies. Designated initialisers would not do this - gcc
 * never warns on an omitted member and clang only from 19 - so positional it is.
 *
 * A single-field constructor is explicit, so that a payload cannot quietly become the frame that
 * wraps it: `Response` and `ResponseFrame` are one field apart and mean different things.
 */
export function emitTypes(model: Model, source: string): string {
  const body = forEachDeclaration(model, {
    enum: ({ enum: e }) => {
      const members = e.members.map((m) => `    ${snake(m)},`).join('\n')
      const names = e.members.map((m) => `"${m}"`).join(', ')
      return `${doc(e.doc)}enum class ${e.name} {
${members}
};

template <>
struct EnumTraits<${e.name}> {
    static constexpr std::string_view name = "${e.name}";
    static constexpr std::array<std::string_view, ${e.members.length}> names{${names}};

    static constexpr std::string_view to_string(${e.name} value) {
        return names[static_cast<std::size_t>(value)];
    }

    static constexpr std::optional<${e.name}> parse(std::string_view text) {
        for (std::size_t i = 0; i < names.size(); i++)
            if (names[i] == text)
                return static_cast<${e.name}>(i);
        return std::nullopt;
    }
};
`
    },

    struct: ({ struct: s }) => {
      const lines: string[] = []
      lines.push(`${doc(s.doc)}struct ${s.name} {`)
      if (s.tag !== undefined) {
        lines.push(`    static constexpr std::string_view type_tag = "${s.tag}";`)
        if (s.fields.length) lines.push('')
      }
      for (const field of s.fields) {
        lines.push(doc(field.doc, '    ') + `    ${fieldType(field)} ${member(field)};`)
      }
      if (s.fields.length) {
        const params = s.fields.map((f) => `${fieldType(f)} ${member(f)}_`).join(', ')
        const inits = s.fields.map((f) => `${member(f)}{std::move(${member(f)}_)}`).join(', ')
        lines.push('')
        const explicitly = s.fields.length === 1 ? 'explicit ' : ''
        lines.push(`    ${explicitly}${s.name}(${params}) :`)
        lines.push(`            ${inits} {}`)
      }
      lines.push('};\n')
      return lines.join('\n')
    },

    union: ({ union: u }) => {
      const members = u.members.map((m) => `        ${m}`).join(',\n')
      return `${doc(u.doc)}using ${u.name} = std::variant<
${members}>;
`
    },
  })

  return `${BANNER(source)}
#pragma once

#include <array>
#include <cstddef>
#include <optional>
#include <string>
#include <string_view>
#include <utility>
#include <variant>
#include <vector>

/// One flat namespace, deliberately: session::bridge would declare a top-level 'session', and
/// Apple's <sys/sysctl.h> already declares 'struct session' there. These headers reach the
/// CocoaPods module umbrella through the Nitro spec, where that header is visible, and the
/// collision is a module that cannot be built rather than a line that can be fixed locally.
namespace session_bridge {

/// Name table for every string-union enum; specialised below, one per enum.
template <class E>
struct EnumTraits;

${body}
}  // namespace session_bridge
`
}
