# iOS

**None of this runs on the machine this repository has been built on.** It is Linux; iOS needs
Xcode. Nothing in `packages/bridge-rn/ios` has ever been compiled, and the podspec has never seen
`pod install`.

Say so and stop, rather than working out the same thing over twenty minutes. Everything below is
written from the tooling's documented behaviour, not from having run it here, and the first person
on a Mac should expect to correct it.

## Before any of it

Two builds that do not exist yet:

```sh
pnpm --filter @session/bridge-rn build:libsession      # needs an ios variant; today it is Android only
cd apps/mobile && npx expo prebuild --platform ios && pod install --project-directory=ios
```

libsession's iOS artifact is an xcframework from its own `utils/ios.sh`, for the same reason
Android's comes from `utils/android.sh`: its dependencies have to be cross-compiled by libsession's
build rather than by whichever project embeds it. It goes in `packages/bridge-rn/ios/` and is not
committed.

## Simulators

```sh
xcrun simctl list devices available
xcrun simctl boot "iPhone 16"
xcrun simctl bootstatus "iPhone 16" -b          # bounded, and exits when booted
```

`bootstatus -b` is the iOS equivalent of polling `sys.boot_completed`, and it terminates on its
own — prefer it to a loop.

## Install, launch, look

```sh
xcrun simctl install booted path/to/Session.app
xcrun simctl launch --console-pty booted org.getsession.session2
xcrun simctl io booted screenshot "$SCRATCH/screen.png"
```

`--console-pty` puts the app's stdout in the terminal, which is the closest thing to logcat.
For a filtered stream:

```sh
xcrun simctl spawn booted log stream --level debug --predicate 'process == "Session"'
```

## The app's own storage

```sh
xcrun simctl get_app_container booted org.getsession.session2 data
```

That prints the container; `session.db` will be under it, wherever the app's paths resolve to.
The Android note applies unchanged — the database and its `-wal` existing is the proof that the
bridge carried a command down and an answer back.

## Resetting state

```sh
xcrun simctl uninstall booted org.getsession.session2
xcrun simctl erase booted                        # the whole simulator
```

## What to expect to go wrong first

The four runtime traps in [traps.md](traps.md) are all platform-neutral C++ or autolinking
problems and Android has already paid for them. The iOS-specific ones will be the podspec's
header search paths and the xcframework's architectures, neither of which anyone has exercised.
