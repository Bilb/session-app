import { BANNER, cppType, fieldType, forEachDeclaration, member, NAMESPACE } from '#src/cpp'
import type { Field, Model, Struct } from '#src/model'

/**
 * `createFromAscii` reads bytes as code points, so a tag with anything else would come out wrong.
 */
function assertAscii(text: string, where: string): void {
  // eslint-disable-next-line no-control-regex
  if (!/^[\x00-\x7f]*$/.test(text)) throw new Error(`${where}: "${text}" is not ASCII`)
}

/**
 * `margelo::nitro::JSIConverter` specialisations, so Nitro can carry the protocol types through a
 * HybridObject method or callback without nitrogen generating a struct of its own. Shaped after
 * nitrogen's output with one deliberate difference: an unset optional is omitted from the object
 * rather than written as `undefined`, which is what exactOptionalPropertyTypes on the other side
 * means.
 */
export function emitJsi(model: Model, source: string): string {
  const prop = (name: string) => `PropNameIDCache::get(runtime, "${name}")`
  const conv = (type: string) => `JSIConverter<${type}>`
  const ascii = (text: string) => `${NAMESPACE}::ascii(runtime, ${text})`

  const body = forEachDeclaration(model, {
    enum: ({ enum: e }) => {
      const T = `${NAMESPACE}::${e.name}`
      const traits = `${NAMESPACE}::EnumTraits<${T}>`
      for (const m of e.members) assertAscii(m, `${e.name}.${m}`)
      return `template <>
struct JSIConverter<${T}> final {
    static inline ${T} fromJSI(jsi::Runtime& runtime, const jsi::Value& arg) {
        std::string text = ${conv('std::string')}::fromJSI(runtime, arg);
        auto parsed = ${traits}::parse(text);
        if (!parsed) [[unlikely]]
            throw std::invalid_argument("Cannot convert \\"" + text + "\\" to ${e.name}");
        return *parsed;
    }
    static inline jsi::Value toJSI(jsi::Runtime& runtime, ${T} arg) {
        return ${ascii(`${traits}::to_string(arg)`)};
    }
    static inline bool canConvert(jsi::Runtime& runtime, const jsi::Value& value) {
        return value.isString() &&
               ${traits}::parse(${conv('std::string')}::fromJSI(runtime, value)).has_value();
    }
};
`
    },

    struct: ({ struct: s }) => emitStruct(s),

    union: ({ union: u }) => {
      const T = `${NAMESPACE}::${u.name}`
      const members = u.members.map((m) =>
        model.declarations.find((d) => d.kind === 'struct' && d.struct.name === m),
      )
      const arms = members
        .map((d) => {
          if (!d || d.kind !== 'struct' || d.struct.tag === undefined)
            throw new Error(`${u.name}: member is not tagged`)
          return `        if (tag == "${d.struct.tag}")
            return ${conv(`${NAMESPACE}::${d.struct.name}`)}::fromJSI(runtime, arg);`
        })
        .join('\n')
      const tags = members
        .map((d) => (d && d.kind === 'struct' ? `tag == "${d.struct.tag}"` : 'false'))
        .join(' || ')
      return `template <>
struct JSIConverter<${T}> final {
    static inline ${T} fromJSI(jsi::Runtime& runtime, const jsi::Value& arg) {
        jsi::Object obj = arg.asObject(runtime);
        std::string tag = ${conv('std::string')}::fromJSI(runtime, obj.getProperty(runtime, ${prop('type')}));
${arms}
        throw std::invalid_argument("${u.name}: unknown type \\"" + tag + "\\"");
    }
    static inline jsi::Value toJSI(jsi::Runtime& runtime, const ${T}& arg) {
        return std::visit(
                [&runtime](const auto& value) -> jsi::Value {
                    return JSIConverter<std::decay_t<decltype(value)>>::toJSI(runtime, value);
                },
                arg);
    }
    static inline bool canConvert(jsi::Runtime& runtime, const jsi::Value& value) {
        if (!value.isObject())
            return false;
        jsi::Value type = value.getObject(runtime).getProperty(runtime, ${prop('type')});
        if (!type.isString())
            return false;
        std::string tag = type.getString(runtime).utf8(runtime);
        return ${tags};
    }
};
`
    },
  })

  function emitStruct(s: Struct): string {
    const T = `${NAMESPACE}::${s.name}`
    const read = (f: Field) => {
      const value = `obj.getProperty(runtime, ${prop(f.name)})`
      return f.optional
        ? `${NAMESPACE}::optional_from_jsi<${cppType(f.type)}>(runtime, ${value})`
        : `${conv(fieldType(f))}::fromJSI(runtime, ${value})`
    }
    const construct = s.fields.length
      ? `        return ${T}(\n${s.fields.map((f) => `                ${read(f)}`).join(',\n')});`
      : `        return ${T}{};`
    const writes: string[] = []
    if (s.tag !== undefined) {
      assertAscii(s.tag, `${s.name}.type`)
      writes.push(`        obj.setProperty(runtime, ${prop('type')}, ${ascii(`${T}::type_tag`)});`)
    }
    for (const f of s.fields) {
      const value = `${conv(cppType(f.type))}::toJSI(runtime, ${f.optional ? '*' : ''}arg.${member(f)})`
      writes.push(
        f.optional
          ? `        if (arg.${member(f)})\n            obj.setProperty(runtime, ${prop(f.name)}, ${value});`
          : `        obj.setProperty(runtime, ${prop(f.name)}, ${value});`,
      )
    }
    const canConvert =
      s.tag === undefined
        ? `        return value.isObject();`
        : `        if (!value.isObject())
            return false;
        jsi::Value type = value.getObject(runtime).getProperty(runtime, ${prop('type')});
        return type.isString() && type.getString(runtime).utf8(runtime) == ${T}::type_tag;`
    const fromParams = s.fields.length
      ? 'jsi::Runtime& runtime, const jsi::Value& arg'
      : 'jsi::Runtime&, const jsi::Value&'
    const canParams =
      s.tag === undefined
        ? 'jsi::Runtime&, const jsi::Value& value'
        : 'jsi::Runtime& runtime, const jsi::Value& value'
    return `template <>
struct JSIConverter<${T}> final {
    static inline ${T} fromJSI(${fromParams}) {
${s.fields.length ? '        jsi::Object obj = arg.asObject(runtime);\n' : ''}${construct}
    }
    static inline jsi::Value toJSI(jsi::Runtime& runtime, const ${T}& arg) {
        ${s.fields.length ? '' : '(void)arg;\n        '}jsi::Object obj(runtime);
${writes.join('\n')}
        return obj;
    }
    static inline bool canConvert(${canParams}) {
${canConvert}
    }
};
`
  }

  return `${BANNER(source)}
#pragma once

#if __has_include(<NitroModules/JSIConverter.hpp>)
#include <NitroModules/JSIConverter.hpp>
#include <NitroModules/NitroDefines.hpp>
#include <NitroModules/PropNameIDCache.hpp>
#else
#error NitroModules cannot be found. This header is for the Nitro module only.
#endif

#include <jsi/jsi.h>

#include <cstring>
#include <optional>
#include <stdexcept>
#include <string>
#include <string_view>
#include <type_traits>
#include <variant>
#include <vector>

#include "types.hpp"

namespace session_bridge {

/// A tag or enum spelling as a JavaScript string, straight from the constexpr table: the
/// generator has checked these are ASCII, so no std::string is built in between.
inline facebook::jsi::Value ascii(facebook::jsi::Runtime& runtime, std::string_view text) {
    return facebook::jsi::String::createFromAscii(runtime, text.data(), text.size());
}

/// Unset is null or undefined, matching napi.hpp. Nitro's own optional takes only undefined and
/// throws on null, which would make the two platforms disagree.
template <class T>
inline std::optional<T> optional_from_jsi(
        facebook::jsi::Runtime& runtime, const facebook::jsi::Value& value) {
    if (value.isUndefined() || value.isNull())
        return std::nullopt;
    return margelo::nitro::JSIConverter<T>::fromJSI(runtime, value);
}

}  // namespace session_bridge

namespace margelo::nitro {

/// Binary as a Uint8Array in both directions, as napi.hpp carries it.
///
/// Copied on the way in rather than held: the view's memory is JavaScript's, and the shim's work
/// happens on another thread where that is not safe to assume.
template <>
struct JSIConverter<std::vector<std::byte>> final {
    static inline std::vector<std::byte> fromJSI(
            facebook::jsi::Runtime& runtime, const facebook::jsi::Value& value) {
        if (!canConvert(runtime, value))
            throw std::invalid_argument("expected a Uint8Array");
        auto view = value.getObject(runtime);
        auto buffer = view.getProperty(runtime, PropNameIDCache::get(runtime, "buffer"))
                              .getObject(runtime)
                              .getArrayBuffer(runtime);
        const auto offset = static_cast<size_t>(
                view.getProperty(runtime, PropNameIDCache::get(runtime, "byteOffset")).asNumber());
        const auto length = static_cast<size_t>(
                view.getProperty(runtime, PropNameIDCache::get(runtime, "byteLength")).asNumber());
        const auto* first = reinterpret_cast<const std::byte*>(buffer.data(runtime)) + offset;
        return {first, first + length};
    }

    static inline facebook::jsi::Value toJSI(
            facebook::jsi::Runtime& runtime, const std::vector<std::byte>& value) {
        auto buffer = ArrayBuffer::allocate(value.size());
        std::memcpy(buffer->data(), value.data(), value.size());
        return uint8_array(runtime).callAsConstructor(
                runtime, JSIConverter<std::shared_ptr<ArrayBuffer>>::toJSI(runtime, buffer));
    }

    static inline bool canConvert(
            facebook::jsi::Runtime& runtime, const facebook::jsi::Value& value) {
        return value.isObject() &&
               value.getObject(runtime).instanceOf(runtime, uint8_array(runtime));
    }

  private:
    static inline facebook::jsi::Function uint8_array(facebook::jsi::Runtime& runtime) {
        return runtime.global().getPropertyAsFunction(runtime, "Uint8Array");
    }
};

/// The same wire shape as plain bytes; the difference is what holds them on this side.
template <>
struct JSIConverter<::session_bridge::SecretBytes> final {
    static inline ::session_bridge::SecretBytes fromJSI(
            facebook::jsi::Runtime& runtime, const facebook::jsi::Value& value) {
        return ::session_bridge::SecretBytes{
                JSIConverter<std::vector<std::byte>>::fromJSI(runtime, value)};
    }

    static inline facebook::jsi::Value toJSI(
            facebook::jsi::Runtime& runtime, const ::session_bridge::SecretBytes& value) {
        auto bytes = value.bytes();
        return JSIConverter<std::vector<std::byte>>::toJSI(
                runtime, std::vector<std::byte>{bytes.begin(), bytes.end()});
    }

    static inline bool canConvert(
            facebook::jsi::Runtime& runtime, const facebook::jsi::Value& value) {
        return JSIConverter<std::vector<std::byte>>::canConvert(runtime, value);
    }
};

${body}
}  // namespace margelo::nitro
`
}
