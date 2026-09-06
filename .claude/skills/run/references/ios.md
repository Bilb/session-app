# iOS

Builds and runs, on a simulator, against real libsession. Done on a remote Mac - Xcode 26.2,
macOS 15.7 - because the machine most of this repository was built on is Linux, where none of it
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

The signing flags are not decoration - see [traps.md](traps.md). `CODE_SIGNING_ALLOWED=NO` is the
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
and it does not reliably do so - it hung here on an already-booted device and left processes
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

Address the device by UDID rather than by name once you have it - names are ambiguous across
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

## Driving the UI

`simctl` has no tap. Use [idb](https://fbidb.io), which addresses elements through the
accessibility system rather than the screen:

```sh
brew install facebook/fb/idb && pip3 install fb-idb   # needs python 3.10+
idb ui tap conversation-list-settings --match-key AXUniqueId
idb ui set-value new-conversation-account-id --match-key AXUniqueId --value "$ACCOUNT_ID"
idb ui describe-all --key AXUniqueId --key AXLabel --key frame | jq .
```

`AXUniqueId` is what iOS calls `accessibilityIdentifier`, which is what react-native renders a
`testID` as - so every string in `@session/test-ids` is directly addressable, and none of this
needs a coordinate. `set-value` fills a field with no keyboard involved at all. Marker matching is
a substring match, so a full id is unambiguous where a label may not be.

**Untested from here.** These are idb's documented commands and the identifier chain is the one
`@session/test-ids` already relies on for the desktop suite, but nobody has run them against this
app yet. Confirm on the Mac and delete this paragraph.

Nothing below is needed once idb works. It is what the app was actually driven with, and what to
fall back to on a machine without idb.

<details>
<summary>Driving it by coordinates, with AppleScript</summary>

Needs assistive access granted by a person at the machine - System Settings › Privacy & Security
› Accessibility, for `osascript`, and it covers an ssh session too. Everything here is in device
_points_, which is what a screenshot and the layout agree on.

**The window is scaled.** Simulator fits the device into whatever size the window is - 402x874
points into 391x849 here - so nothing derived from the window frame lands where it should. The
device view's own accessibility frame is the mapping:

```sh
osascript -e 'tell application "System Events" to tell process "Simulator" \
  to tell window 1 to get {position, size} of group 1'       # 309, 107, 391, 849
```

Screen x is that x plus point x times 391/402, and the same for y. Twenty points out hits the
label above a field, which looks exactly like a click that did not register.

**Typing needs the hardware keyboard, which is off.** Keystrokes reach Simulator rather than the
device, and some are its own shortcuts - a `keystroke` of an account ID opened the React Native
dev menu. The I/O menu item does not stick because the setting is per device and read at boot:

```sh
xcrun simctl shutdown all && killall Simulator
/usr/libexec/PlistBuddy \
  -c "add :DevicePreferences:$UDID:ConnectHardwareKeyboard bool true" \
  ~/Library/Preferences/com.apple.iphonesimulator.plist   # `set` if the key exists
xcrun simctl boot "$UDID" && open -a Simulator
```

The bare `defaults write com.apple.iphonesimulator ConnectHardwareKeyboard` form stopped working
around Xcode 11; it is `DevicePreferences` keyed by UDID now.

Or go through the pasteboard, which needs no restart:

```sh
printf '%s' "$TEXT" | xcrun simctl pbcopy "$UDID"
```

Then click the field, click it a second time, and the `Paste | AutoFill` callout appears just
above it; click `Paste`. Simulator's own Edit › Paste stays disabled and is not the way in.

</details>

`simctl openurl "$UDID" session:///new` reaches any route in one step and is worth preferring to
a sequence of clicks whichever way you are driving. iOS asks "Open in Session?" first, and that
dialog has to be clicked.

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
`init` never completed - read the LogBox.

## Resetting state

```sh
xcrun simctl uninstall "$UDID" org.getsession.session2
xcrun simctl erase "$UDID"                               # the whole device
```
