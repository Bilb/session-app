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
#include <span>
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

/// Bytes that are wiped when they go.
///
/// For the fields the protocol marks \`SecretBytes\` rather than \`Uint8Array\` -- a seed, a recovery
/// phrase -- so that the wiping is a property of the type and not of whoever remembered. Ordinary
/// binary stays a plain \`std::vector<std::byte>\`; there is no cost to paying for this only where
/// it is wanted.
///
/// Copying is deleted rather than allowed: a copy is a second place the secret lives, and the
/// whole point is to know where it is. Moving leaves the source empty.
class SecretBytes {
  public:
    SecretBytes() = default;
    explicit SecretBytes(std::vector<std::byte> bytes) : _bytes{std::move(bytes)} {}
    ~SecretBytes() { wipe(); }

    SecretBytes(const SecretBytes&) = delete;
    SecretBytes& operator=(const SecretBytes&) = delete;

    SecretBytes(SecretBytes&& other) noexcept : _bytes{std::move(other._bytes)} { other.clear(); }
    SecretBytes& operator=(SecretBytes&& other) noexcept {
        if (this != &other) {
            wipe();
            _bytes = std::move(other._bytes);
            other.clear();
        }
        return *this;
    }

    std::span<const std::byte> bytes() const { return _bytes; }
    std::size_t size() const { return _bytes.size(); }
    bool empty() const { return _bytes.empty(); }

    /// Zeroes the storage and then releases it.
    ///
    /// Written through a volatile pointer because a compiler is entitled to delete a write to
    /// memory nothing reads again, which is exactly what this is -- \`std::fill\` here would be
    /// correct C++ and might emit nothing at all.
    void wipe() {
        volatile auto* p = reinterpret_cast<volatile unsigned char*>(_bytes.data());
        for (std::size_t i = 0; i < _bytes.size(); i++)
            p[i] = 0;
        clear();
    }

  private:
    void clear() {
        _bytes.clear();
        _bytes.shrink_to_fit();
    }

    std::vector<std::byte> _bytes;
};

${body}
}  // namespace session_bridge
`
}
