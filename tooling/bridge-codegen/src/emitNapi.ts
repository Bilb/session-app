import { BANNER, cppType, forEachDeclaration, member, NAMESPACE } from '#src/cpp'
import type { Field, Model, Struct } from '#src/model'

/**
 * node-addon-api conversions for the protocol types, the desktop twin of jsi.hpp.
 *
 * Properties are set by name on every call: the addon targets N-API 8, and a reference to a
 * string cannot be held before N-API 10, so there is nothing to intern them into. An unset optional
 * is omitted, never written as `undefined`. Reading is strict about shape and throws
 * `std::invalid_argument` naming the field, so the addon can answer the request with that text
 * instead of crashing.
 */
export function emitNapi(model: Model, source: string): string {
  const key = (name: string) => `"${name}"`
  const codec = (type: string) => `Codec<${type}>`

  const body = forEachDeclaration(model, {
    enum: ({ enum: e }) => {
      const T = `${NAMESPACE}::${e.name}`
      const traits = `${NAMESPACE}::EnumTraits<${T}>`
      return `template <>
struct Codec<${T}> {
    static constexpr std::string_view name = "${e.name}";
    static Napi::Value to(Napi::Env env, ${T} value) {
        auto text = ${traits}::to_string(value);
        return Napi::String::New(env, text.data(), text.size());
    }
    static ${T} from(const Napi::Value& value, std::string_view where) {
        std::string text = ${codec('std::string')}::from(value, where);
        auto parsed = ${traits}::parse(text);
        if (!parsed)
            throw std::invalid_argument(std::string{where} + ": \\"" + text + "\\" is not a ${e.name}");
        return *parsed;
    }
};
`
    },

    struct: ({ struct: s }) => emitStruct(s),

    union: ({ union: u }) => {
      const T = `${NAMESPACE}::${u.name}`
      const arms = u.members
        .map((m) => {
          const d = model.declarations.find((x) => x.kind === 'struct' && x.struct.name === m)
          if (!d || d.kind !== 'struct' || d.struct.tag === undefined)
            throw new Error(`${u.name}: member is not tagged`)
          return `        if (tag == "${d.struct.tag}")
            return ${codec(`${NAMESPACE}::${m}`)}::from(value, where);`
        })
        .join('\n')
      return `template <>
struct Codec<${T}> {
    static constexpr std::string_view name = "${u.name}";
    static Napi::Value to(Napi::Env env, const ${T}& value) {
        return std::visit(
                [env](const auto& member) -> Napi::Value {
                    return Codec<std::decay_t<decltype(member)>>::to(env, member);
                },
                value);
    }
    static ${T} from(const Napi::Value& value, std::string_view where) {
        Napi::Object obj = object(value, where);
        std::string tag = ${codec('std::string')}::from(obj.Get(${key('type')}), "${u.name}.type");
${arms}
        throw std::invalid_argument(std::string{where} + ": unknown type \\"" + tag + "\\"");
    }
};
`
    },
  })

  function emitStruct(s: Struct): string {
    const T = `${NAMESPACE}::${s.name}`
    const read = (f: Field) =>
      f.optional
        ? `optional<${cppType(f.type)}>(obj.Get(${key(f.name)}), "${s.name}.${f.name}")`
        : `${codec(cppType(f.type))}::from(obj.Get(${key(f.name)}), "${s.name}.${f.name}")`
    const construct = s.fields.length
      ? `        return ${T}(\n${s.fields.map((f) => `                ${read(f)}`).join(',\n')});`
      : `        return ${T}{};`
    const writes: string[] = []
    if (s.tag !== undefined) {
      writes.push(
        `        obj.Set(${key('type')}, Napi::String::New(env, ${T}::type_tag.data(), ${T}::type_tag.size()));`,
      )
    }
    for (const f of s.fields) {
      const converted = `${codec(cppType(f.type))}::to(env, ${f.optional ? '*' : ''}value.${member(f)})`
      writes.push(
        f.optional
          ? `        if (value.${member(f)})\n            obj.Set(${key(f.name)}, ${converted});`
          : `        obj.Set(${key(f.name)}, ${converted});`,
      )
    }
    return `template <>
struct Codec<${T}> {
    static constexpr std::string_view name = "${s.name}";
    static Napi::Value to(Napi::Env env, const ${T}& value) {
        ${s.fields.length ? '' : '(void)value;\n        '}Napi::Object obj = Napi::Object::New(env);
${writes.join('\n')}
        return obj;
    }
    static ${T} from(const Napi::Value& value, std::string_view where) {
        ${s.fields.length ? 'Napi::Object obj = object(value, where);' : 'object(value, where);'}
${construct}
    }
};
`
  }

  return `${BANNER(source)}
#pragma once

#include <napi.h>

#include <array>
#include <cstddef>
#include <optional>
#include <stdexcept>
#include <string>
#include <string_view>
#include <type_traits>
#include <variant>
#include <vector>

#include "types.hpp"

namespace session_bridge::node {

template <class T>
struct Codec;

inline std::string describe(const Napi::Value& value) {
    if (value.IsUndefined()) return "undefined";
    if (value.IsNull()) return "null";
    if (value.IsString()) return "a string";
    if (value.IsNumber()) return "a number";
    if (value.IsBoolean()) return "a boolean";
    if (value.IsArray()) return "an array";
    if (value.IsObject()) return "an object";
    return "a value of another type";
}

inline Napi::Object object(const Napi::Value& value, std::string_view where) {
    if (!value.IsObject() || value.IsArray())
        throw std::invalid_argument(std::string{where} + ": expected an object, got " + describe(value));
    return value.As<Napi::Object>();
}

template <class T>
inline std::optional<T> optional(const Napi::Value& value, std::string_view where) {
    if (value.IsUndefined() || value.IsNull())
        return std::nullopt;
    return Codec<T>::from(value, where);
}

template <>
struct Codec<std::string> {
    static constexpr std::string_view name = "string";
    static Napi::Value to(Napi::Env env, const std::string& value) {
        return Napi::String::New(env, value);
    }
    static std::string from(const Napi::Value& value, std::string_view where) {
        if (!value.IsString())
            throw std::invalid_argument(std::string{where} + ": expected a string, got " + describe(value));
        return value.As<Napi::String>().Utf8Value();
    }
};

template <>
struct Codec<double> {
    static constexpr std::string_view name = "number";
    static Napi::Value to(Napi::Env env, double value) {
        return Napi::Number::New(env, value);
    }
    static double from(const Napi::Value& value, std::string_view where) {
        if (!value.IsNumber())
            throw std::invalid_argument(std::string{where} + ": expected a number, got " + describe(value));
        return value.As<Napi::Number>().DoubleValue();
    }
};

template <>
struct Codec<bool> {
    static constexpr std::string_view name = "boolean";
    static Napi::Value to(Napi::Env env, bool value) {
        return Napi::Boolean::New(env, value);
    }
    static bool from(const Napi::Value& value, std::string_view where) {
        if (!value.IsBoolean())
            throw std::invalid_argument(std::string{where} + ": expected a boolean, got " + describe(value));
        return value.As<Napi::Boolean>().Value();
    }
};

template <class T>
struct Codec<std::vector<T>> {
    static constexpr std::string_view name = "array";
    static Napi::Value to(Napi::Env env, const std::vector<T>& value) {
        Napi::Array array = Napi::Array::New(env, value.size());
        for (std::size_t i = 0; i < value.size(); i++)
            array.Set(static_cast<uint32_t>(i), Codec<T>::to(env, value[i]));
        return array;
    }
    static std::vector<T> from(const Napi::Value& value, std::string_view where) {
        if (!value.IsArray())
            throw std::invalid_argument(std::string{where} + ": expected an array, got " + describe(value));
        Napi::Array array = value.As<Napi::Array>();
        std::vector<T> out;
        const uint32_t length = array.Length();
        out.reserve(length);
        for (uint32_t i = 0; i < length; i++)
            out.push_back(Codec<T>::from(array.Get(i), where));
        return out;
    }
};

${body}
/// A protocol value as a JavaScript value.
template <class T>
inline Napi::Value to_napi(Napi::Env env, const T& value) {
    return Codec<T>::to(env, value);
}

/// A JavaScript value as a protocol value. Throws std::invalid_argument naming the field that
/// did not fit.
template <class T>
inline T from_napi(const Napi::Value& value) {
    return Codec<T>::from(value, Codec<T>::name);
}

}  // namespace session_bridge::node
`
}
