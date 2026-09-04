# Traps

Everything here was paid for once. They share a shape: each presents as a different problem than
it is, which is why a table is worth more than a paragraph.

## Identifiers, so nothing is guessed

| what               | value                     | from                      |
| ------------------ | ------------------------- | ------------------------- |
| Android package    | `org.getsession.session2` | `apps/mobile/app.json`    |
| Desktop app name   | `session-app`             | `app.setName()` in main   |
| Desktop user data  | `~/.config/session-app/`  | `app.getPath('userData')` |
| Nitro HybridObject | `SessionBridge`           | `SessionBridge.nitro.ts`  |
| Android JNI lib    | `SessionBridgeRN`         | `android/CMakeLists.txt`  |

A QA machine has many Session builds on it — this one has dozens under `~/.config/Session-*` and
two Session packages on the emulator. `grep -i session` finds the wrong one.

## Every platform

| symptom                                               | cause                                                                                                                              |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| A component renders at zero, or a colour is invisible | A tamagui token that does not exist resolves to **0, silently**. `pnpm --filter @session/ui test` is the guard; TypeScript is not. |
| A conversation reads bottom to top                    | libsession answers history newest-first. The shim reverses; anything bypassing it will not.                                        |
| A send never leaves `pending`, offline                | Correct. With no network attached libsession reports `no_network` and the state goes to `failed`, not `sent`.                      |
| The app shows no conversations and no onboarding      | Also correct, today. Both apps pass `deferAccount`, so there is no account and nothing to list until onboarding exists.            |

## Desktop

| symptom                                                     | cause                                                                                                                                                                                                                                                |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Cannot read properties of undefined (reading 'whenReady')` | `ELECTRON_RUN_AS_NODE=1` is exported by many terminals, and Electron then runs the main file under plain Node where `electron.app` is undefined. The dev and e2e scripts clear it; a bare `electron` invocation needs `env -u ELECTRON_RUN_AS_NODE`. |
| Every element is present in the DOM and invisible           | react-native's layout wants every ancestor to be a flex container and a browser's root is not. `#root { display: flex }` in the host page is the whole fix.                                                                                          |
| The app sits on its loading screen with nothing in the logs | The renderer asks for the account before the MessagePort arrives. The preload buffers **both** directions; dropping that first request strands it.                                                                                                   |
| Data appears in `~/.config/Electron`                        | `app.setName()` did not run, or ran too late — `userData` is resolved on first use and then fixed.                                                                                                                                                   |
| `SIGTRAP` on exit, GPU and zygote errors in the log         | Headless noise on a machine with no display. Not a crash worth chasing; filter it out.                                                                                                                                                               |

## Android

| symptom                                                                     | cause                                                                                                                                                                     |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SessionBridge ... has not yet been registered`                             | No `JNI_OnLoad`. Nitrogen generates the registration and the `initialize` that performs it, but not the entry point that calls it — `android/OnLoad.cpp` is ours.         |
| `Cannot default-construct HybridObject!`                                    | `HybridObject` is a virtual base, so the most-derived class has to construct it. A defaulted constructor compiles and fails here.                                         |
| `SessionBridge does not exist`, and the module was never built              | Autolinking looks for a `ReactPackage` before it will link a package, and a pure-C++ Nitro module has no reason to have one. Without it the module is skipped in silence. |
| `Starting an external process ... during configuration time is unsupported` | Gradle 9's configuration cache against Expo, which still calls `node` while configuring. `--no-configuration-cache`. Nothing to do with this repository.                  |
| `undefined symbol: std::__cxx11::...` linking the Nitro module              | A dependency built for the host. libsession must be cross-compiled by its own build — see `packages/bridge-rn/README.md`.                                                 |
| `relocation R_X86_64_PC32 ... recompile with -fPIC`                         | libevent, built without `--with-pic`. `patches/` fixes it and the build applies them; if you cleared the submodule, re-run `scripts/patch-libsession.mjs`.                |
| `2 files found with path 'lib/.../libNitroModules.so'`                      | Our library is repackaging another module's `.so`. The excludes in `android/build.gradle` are the list.                                                                   |
| The header sits under the status bar                                        | A screen not using `@session/ui`'s `Screen`, which is where the safe-area insets are applied.                                                                             |
| Logcat is full of Session errors that are not ours                          | Another Session build is installed and running. Filter by pid, or by the package above.                                                                                   |

## iOS

Nothing here is from experience — see [ios.md](ios.md). The four runtime traps under Android are
platform-neutral C++ and autolinking problems and will apply unchanged; the ones that will be new
are the podspec's header search paths and the xcframework's architectures.

## C++, when changing the shim

| symptom                                                         | cause                                                                                                                                                      |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `invalid application of 'sizeof' to an incomplete type`         | A `unique_ptr` to a forward-declared type needs its constructor and destructor out of line, or the deleter is instantiated where the type is not complete. |
| `'oxenc/common.h' file not found` against a prebuilt libsession | The bundle carries every dependency's code and none of their headers. `packages/bridge-core/CMakeLists.txt` spells out the paths.                          |
| `undefined symbol: session::sqlite::Database::~Database`        | `STATIC_BUNDLE` leaves out session-sqlite, sqlite3mc and utf8proc despite its name. They are named on the link line.                                       |
| `'ms' cannot be used as a function`                             | libsession's headers pull in `using namespace std::literals`, so `ms` is a chrono literal. Name a helper something else.                                   |
| `session::bridge` resolving to nothing in the Nitro module      | Nitro puts the implementation in `margelo::nitro::session::bridge::rn`, so the name resolves inside that namespace. Fully qualify it.                      |
