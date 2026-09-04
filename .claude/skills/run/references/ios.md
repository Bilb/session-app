# iOS

Builds and runs, on a simulator, against real libsession. Done on a remote Mac — Xcode 26.2,
macOS 15.7 — because the machine most of this repository was built on is Linux, where none of it
is possible.

Device builds and a release-shaped xcframework are untried. Everything below has been run.

## Building

```sh
pnpm --filter @session/bridge-rn build:libsession:ios     # libsession + the shim, one slice
cd apps/mobile && npx expo prebuild --platform ios
cd ios && pod install
xcodebuild -workspace Session.xcworkspace -scheme Session -configuration Debug \
  -destination "platform=iOS Simulator,name=iPhone 17 Pro" \
  -derivedDataPath build/dd \
  CODE_SIGN_IDENTITY="-" CODE_SIGNING_REQUIRED=NO CODE_SIGNING_ALLOWED=YES
```

The signing flags are not decoration — see [traps.md](traps.md). `CODE_SIGNING_ALLOWED=NO` is the
obvious thing to pass for a simulator and it breaks the keychain.

The first `build:libsession:ios` takes a long time: it cross-compiles libsession and every
dependency. After that it is incremental and quick.

Needs `protobuf@21` from brew. bridge-core checks and says so.

## Simulators

```sh
xcrun simctl list devices available
xcrun simctl boot "iPhone 17 Pro"
```

**Do not wait with `simctl bootstatus -b`.** It is documented as exiting when the device is ready
and it does not reliably do so — it hung here on an already-booted device and left processes
behind. Wait on something that proves the device is serving requests:

```sh
for i in $(seq 30); do
  xcrun simctl spawn "$UDID" /usr/bin/true >/dev/null 2>&1 && break
  sleep 4
done
```

That check matters for its own sake: a device can report `Booted` and not be working. The tell is
`simctl spawn` failing with `NSPOSIXErrorDomain code=2` and `get_app_container` printing nothing.
`simctl shutdown` then `boot` clears it.

Address the device by UDID rather than by name once you have it — names are ambiguous across
runtimes.

## Install, launch, look

```sh
D=build/dd/Build/Products/Debug-iphonesimulator
xcrun simctl install "$UDID" "$D/Session.app"
xcrun simctl launch "$UDID" org.getsession.session2      # prints the pid
xcrun simctl io "$UDID" screenshot ~/shot.png
```

A screenshot is the fastest way to read a JavaScript error: React Native's LogBox renders it in
full, and the log will only tell you `RCTLogBoxView` became the key window.

## Logs

```sh
xcrun simctl spawn "$UDID" log show --last 5m --style compact --predicate 'process == "Session"'
```

The predicate is essential. Without it the output is thousands of lines from `storekitd`,
`videosubscriptionsd` and friends, none of it yours.

## The app's own storage

```sh
C=$(xcrun simctl get_app_container "$UDID" org.getsession.session2 data)
ls -la "$C/Documents/session/"
```

`session.db` with its `-shm` and `-wal` is the proof that the bridge carried a command down and an
answer back. `Documents/session` holding only `attachments` means the transport was built and
`init` never completed — read the LogBox.

## Resetting state

```sh
xcrun simctl uninstall "$UDID" org.getsession.session2
xcrun simctl erase "$UDID"                               # the whole device
```
