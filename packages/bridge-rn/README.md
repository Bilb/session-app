# `@session/bridge-rn`

The Nitro module: `session-bridge-core` behind a JSI HybridObject, loaded in the mobile app. Like
the addon, it holds no logic - what it owns is the hop from Core's loop onto the JavaScript
thread. Nitro's void callbacks are bound to the runtime's dispatcher, so calling the sink from
Core's loop arrives on the JS thread in order, which is the same guarantee the addon gets from a
thread-safe function.

It is linked in exactly one place: `packages/client/src/nativeTransport.native.ts`. Everything
above a `BridgeTransport` is meant to be unable to tell which one it has.

## Building

```
pnpm --filter @session/bridge-rn build:libsession:android   # once per ABI, slow
cd apps/mobile && npx expo prebuild --platform android
cd android && ./gradlew :app:assembleDebug -PreactNativeArchitectures=x86_64 --no-configuration-cache
```

libsession is cross-compiled separately rather than from inside the Gradle CMake project. That is
not a preference: session-deps hands its CMake-based dependencies the NDK compiler without the NDK
target, so building in place produces a simdutf for the host and the link fails on libstdc++
symbols that do not exist on Android. `patches/` carries the fix for that and it is applied by the
build; `docs/STATUS.md` says what is waiting on upstream.

`--no-configuration-cache` is Gradle 9 against Expo, which still calls `node` at configuration
time. Nothing to do with this module.

## Four things that are easy to get wrong

Each of these builds and then fails at runtime, which is the expensive kind:

- **`JNI_OnLoad`.** Nitrogen generates the registration and the `initialize` that performs it, but
  not the entry point that calls it. Without `android/OnLoad.cpp` the library loads, says so, and
  `createHybridObject` fails with "not yet been registered".
- **The virtual base constructor.** `HybridObject` is a virtual base, so the most-derived class is
  what constructs it. A defaulted constructor compiles and fails at the first create.
- **A `ReactPackage`.** Autolinking looks for one to decide a package is linkable, and a pure-C++
  module has no reason to have one. Without `SessionBridgeRNPackage.kt` the module is skipped in
  silence and shows up much later as "SessionBridge does not exist".
- **Namespaces.** Nitro puts the implementation in `margelo::nitro::session::bridge::rn`, so an
  unqualified `session::bridge::ClientBridge` resolves inside that namespace and never reaches the
  shim, with an error that reads as if the header were missing.

## iOS

Written, unbuilt: this work has been on Linux, where there is no Xcode. See `ios/README.md`.
