# Where session-app is

This file is the mutable one: what exists today and what comes next. `ARCHITECTURE.md` is the
timeless one - how the thing is built and why. `CLAUDE.md` is the rule list. Read all three
before changing anything; they do not repeat each other.

Last updated 2026-09-04, at commit `46eceb4`.

## State

On `feat/message-sending`, off `feat/network-receive`. Working tree clean. `origin` is
`session-foundation/session-app`, so the branch-and-pull-request rule in `CLAUDE.md` applies.

Everything green: `pnpm format:check`, `pnpm lint` (16), `pnpm lint:manifests`,
`pnpm boundaries`, `pnpm typecheck` (16), `pnpm test` (68 tests), `pnpm knip`,
`pnpm codegen:check`, `pnpm dedupe --check` - the whole of `ci.yml`.

The walking skeleton works end to end. `tests/e2e` drives the built Electron app through
Playwright: it reads a seeded conversation list, opens a conversation, sends a message and
sees it arrive - through the fake libsession, the real protobuf codec, and the MessagePort
bridge. Only the C++ is missing from that path.

## What exists

| package                                        | state                                                                               |
| ---------------------------------------------- | ----------------------------------------------------------------------------------- |
| `libsession-util/`                             | submodule, `client` at `e19ebd5c` - the SHA session-cli pins                        |
| `@session/basic-types` `@session/theme-tokens` | copied from session-pkgs, trimmed                                                   |
| `@session/localization`                        | copied, plus a markup parser for the `<b>`/`<br/>` in the catalogue                 |
| `@session/test-ids`                            | the element registry                                                                |
| `@session/proto`                               | the wire schema, `sessionbridge.v1`, codecs committed                               |
| `@session/client`                              | the SessionClient facade, and the fake                                              |
| `@session/client-contract`                     | 9 behavioural scenarios, running against the fake                                   |
| `@session/state`                               | the projection store, 9 reducer tests                                               |
| `@session/ui`                                  | tamagui config, 4 themes x 7 accents, a handful of components                       |
| `@session/app`                                 | ports, nav port, route registry, route-contract test                                |
| `@session/screens`                             | list, conversation, new conversation, requests, settings, onboarding, AdaptiveShell |
| `apps/desktop`                                 | Electron, runs, drawn by the e2e suite                                              |
| `apps/mobile`                                  | Expo, runs on an Android emulator and an iOS simulator                              |
| `bridge-core`                                  | the C++ shim: all nine callbacks, most of the command set                           |
| `bridge-node`                                  | the N-API addon, loaded by the desktop main process                                 |
| `tests/e2e`                                    | harness + the walking-skeleton spec                                                 |

Six skills in `.claude/skills/`: `port-feature`, `libsession-bridge`, `new-screen`,
`ui-component`, `shared-test`, `run`.

## What does not exist yet

- iOS device builds and a release-shaped xcframework. The simulator works; only one slice has
  ever been built, and nothing has been signed with a real identity.
- Attachment commands (`AttachmentData`, `SaveAttachment`) and push are not in the shim's
  dispatch yet. They answer with an error naming themselves rather than silently doing nothing.
- Attachments. Onboarding is one button and restoring from a recovery phrase has no screen.
- Anything a message can be beyond text: no reactions, replies, edits, deletes or read receipts.
- The `e2e-full` workflow is a stub.

## Next steps, in order

1. **Features, via the `port-feature` skill.** The loop is closed on all three platforms - an
   account is created, the network attaches, messages arrive and messages send - so what is
   left is one feature at a time rather than another layer.

## Open questions that need a person

- **Background and push.** The requirement is both slow-path OS wakeups and push-triggered
  fetch, on all three platforms. `PollOnce` / `SetPushToken` / `HandlePushPayload` are in the
  schema. Three questions need raising with the libsession team before the iOS side can be
  designed: a supported one-shot poll entry point; decrypting a push envelope without opening
  the database (for the notification service extension); and whether an extension and the app
  can hold the same database at once.
- **`device::Type`** for the new clients - device records are user-visible on linked devices,
  so this is an upstream conversation.
- **Accepting a message request.** `approveConversation` has no libsession counterpart:
  approval is recorded by messages flowing, and writing to someone is what approves them
  (`DM::request` is derived from the client schema's `contacts.approved`, which sending sets).
  Session's UX has an Accept button that sends nothing, so either the conversation layer needs a
  way to accept without answering, or the button has to mean something else. The shim answers
  this command with an error until that is settled.

  Not hypothetical, and not only a contract scenario: `RequestsScreen` draws that button and it
  calls this, so against the real bridge accepting a request does nothing and rejects into a
  `void`. The fake implements it, which is why every loop except mode B looks correct. Whichever
  way it is settled, the button and this command have to be settled together.

- **Three things to send to session-deps and libsession**, all found by building a shared object
  from this branch, which nobody had done. `patches/` carries the first two and both are one-liners.
  1. libevent's dep script overrides the shared configure command and drops `--with-pic`, so its
     archive cannot go into a shared object - the Node addon and the Nitro module both are one.
  2. session-deps does not forward the Android toolchain to its CMake-based dependencies, so they
     get the NDK compiler without the NDK target and build for the host. libsession's own Android
     bundle contains a simdutf full of libstdc++ symbols because of this.
  3. `STATIC_BUNDLE` says "a single static .a containing everything" and leaves out session-sqlite's
     archives, sqlite3mc and utf8proc. `bridge-core` names them on the link line; nothing in the
     bundle says it should have to.

- **Mnemonic handling.** libsession owns the word list, so no TypeScript library is needed,
  but once words cross into JavaScript they cannot be wiped. Keep them out of logs and out of
  the store.

## What contract mode B says

`@session/client-contract` runs against the real addon, offline, in
`packages/bridge-node/src/contract.test.ts`. Nothing reaches a swarm: the harness carries each
message from one client to the other itself, encrypted and fed in the way the swarm's would be,
which is a port of what libsession's own tests do. Eight of the nine scenarios pass.

It has already earned its keep twice. libsession answers history **newest first** and the fake
answered oldest first, which nothing had noticed because nothing had run both - that is a
transcript upside down, and the shim now reverses and `frames.proto` says so. And the contract
asserted a send ends up `sent`, which is only true where there is a swarm; offline it ends up
`failed`, and the scenario was really about the state arriving as an update.

The ninth is skipped with its reason in the test name: `approveConversation` has no libsession
counterpart. `runSessionClientContract` takes an `unsupported` map of title to reason for exactly
this, and the reason is what stops it becoming a way to make a failing implementation look green.

```
pnpm --filter @session/bridge-node build:native:testing
pnpm --filter @session/bridge-node test
```

The test commands are compiled in only by that build. A plain `build:native` leaves them out and
the suite skips itself rather than reporting their absence as a regression.

## All three receive a message from the network

Verified on each platform, over mainnet, end to end: onboarding mints an account, the bridge
attaches, a separate account writes to it, and the message is on screen after navigating in.

| platform | account         | how it was driven                       |
| -------- | --------------- | --------------------------------------- |
| desktop  | `05b7f80e…2d20` | Playwright against the built Electron   |
| Android  | `057fb21c…5d30` | `adb input tap`, ids from uiautomator   |
| iOS      | `05a30bb6…d251` | AppleScript clicks and `simctl openurl` |

The sender is `packages/bridge-node/src/sendTestMessage.test.ts` - a second real bridge rather
than a fixture, so the message is built, encrypted and stored by the same libsession the app
reads. It skips itself unless `SESSION_SEND_TO` is set. qa-seeder was the obvious candidate and
is the wrong tool: it seeds accounts, friendships, groups and pro access, and has no path that
sends a message.

A stranger's first message arrives in **message requests**, because libsession records approval
from messages flowing and nothing has flowed the other way yet. That is why the requests screen
had to exist before any of this was visible.

### What is deliberately not done

- **Poll interval is libsession's default, 20 seconds.** A message can take that long to appear.
  `SetPollInterval` is in the plan and not in the schema, so nothing shortens it yet.
- **devnet refuses rather than half-working.** It takes seed nodes, and a seed node is a public
  key, an address and two ports - not something the schema's `devnet_seed_url` can be turned
  into. How the app learns those is a devnet question rather than a bridge one.
- **Onboarding is one button.** Restore from a recovery phrase is a bridge command already
  (`restoreAccount`) with no screen.
- **There is no contact list and no QR scanner.** Starting a conversation means pasting an
  account ID into the new-conversation screen.

### On reading the account ID

Shown on the settings screen, and logged at hydration. The log reaches the terminal on desktop
(with `--enable-logging`) and logcat on Android, and **on iOS it reaches neither** - React
Native's console there goes to neither the unified log nor the app's stdout, so the screen is
the only way. That is why settings needed a way in at all: it had a route and nothing that
navigated to it.

## All three send a message to the network

Verified on each platform, over mainnet, through the UI: `+`, paste an account ID, `Start`,
type, `Send`. The bubble shows `Sending…`, the label goes away - `sent` has no label, so the
label disappearing is the success - and the message is in the recipient's message requests.

| platform | driven by                                        | arrived at |
| -------- | ------------------------------------------------ | ---------- |
| desktop  | Playwright against the built Electron            | Android    |
| Android  | `adb shell input`                                | desktop    |
| iOS      | AppleScript clicks and the field's Paste callout | Android    |

The command set was already there - `openDm` then `sendMessage`, both through the bridge - so
what this took was three screens' worth of defects, each of which only showed up on a device:

- **The composer sat behind the iOS keyboard.** iOS puts the keyboard over the window without
  changing the layout, so the field took focus and there was nowhere to see what was typed.
  `@session/ui`'s `Screen` avoids the keyboard on iOS now, in the one place every screen shares.
  Android resizes its own window, which is why only one platform had ever shown it.
- **Every row was nameless.** A display name arrives with the other side's profile and
  libsession reports an empty string until then, which every list rendered faithfully as
  nothing at all. `conversationTitle` falls back to the account ID, shortened at both ends.
- **The send state was invisible.** `Sending…` and `Retry` sit inside the outgoing bubble and
  were coloured for the screen behind it: grey on green and green on green. The retry
  affordance for a failed send was there and unreadable.

**A send in the first seconds after launch fails.** The router bootstraps for about ten seconds
after the bridge attaches, and a QUIC handshake started before then times out -
`ERR_HANDSHAKE_TIMEOUT` in the logs, which are libsession's own, forwarded as `LogRecord`
frames. That is what a reported "message status failed" was, and Retry is the answer to it.
Nothing in the app waits for the router, because `networkAttached` goes true when the bridge
attaches rather than when the router is ready: an indicator built on it would say "connected"
through the whole window where sending does not work.

## What runs against the real bridge

**iOS.** Builds and runs on a simulator against real libsession, on a remote Mac - Xcode 26.2,
macOS 15.7. The shared conversation-list screen draws from an encrypted database the app opened
itself, keyed from `expo-secure-store`, and `Documents/session/session.db` is in the container
afterwards. The `run` skill's [ios reference](../.claude/skills/run/references/ios.md) has the
commands.

Four things stood between "written" and "running", and the skill's traps table has them all. The
podspec listed bridge-core's sources with a glob reaching outside the pod directory, which
CocoaPods drops in silence - the shim is a CMake project on iOS too now, which is what it already
was everywhere else. `STATIC_BUNDLE` left out session-sqlite again. expo-modules-jsi does not
compile under Xcode 26 and is patched - still true of 57.0.8 and of the SDK 58 canaries as of
2026-09-06, so there is no release to move to instead. And `expo-secure-store` failed with "a required entitlement
isn't present", which turned out to mean the app was not signed at all: `CODE_SIGNING_ALLOWED=NO`
is the obvious flag for a simulator build and it skips the step that applies entitlements.

**Desktop.** `pnpm dev:desktop:real` loads the addon, and libsession opens an encrypted database
at `~/.config/session-app/session.db` with the key sealed beside it in `db-key.bin`. Verified by
the header not being `SQLite format 3`.

Finding it turned up that the app had no name: `app.getName()` fell back to `Electron`, so its
data went to `~/.config/Electron` beside every other Electron project on the machine, and the
scoped package name grew a second half-used `~/.config/@session/desktop` next to it.
`app.setName('session-app')` now runs before anything resolves a path. Deliberately not
`Session` - the shipped client owns that directory, and a dev build opening the real client's
data would be a bad afternoon. It is a placeholder until somebody decides on branding.

## What runs on a device

`apps/mobile` runs on an Android emulator against real libsession. The shared conversation-list
screen draws from a real, empty, encrypted database that the app opened itself: the key comes from
`expo-secure-store`, the Nitro module carries the frames, and `session.db` is on the device
afterwards. That is the second proof point - the same TypeScript, the real bindings.

It showed two things, both since fixed. The header sat under the status bar - `@session/ui`'s
`Screen` now has a `.native` variant that reads the insets, which is one place for every screen.
And tamagui warned about a token no theme defined; chasing it found that tamagui's own components
ask for a vocabulary of about twenty names Session does not use, so `themes.ts` now maps all of
them onto Session's rather than adding them one warning at a time.

```
pnpm --filter @session/bridge-rn build:libsession:android
cd apps/mobile && npx expo prebuild --platform android
cd android && ./gradlew :app:assembleDebug -PreactNativeArchitectures=x86_64 --no-configuration-cache
```

`--no-configuration-cache` is Gradle 9 against Expo, which still calls `node` at configuration
time. It has nothing to do with this repository.

The `run` skill is the place for all of this now: it holds the recipe for proving the bridge is
alive on either platform, the mechanics per platform, and a traps table with every symptom either
app has produced and what actually caused it.

## The token trap, and what now guards it

A tamagui token that does not exist resolves to **0, in silence**. `padding="$1.5"` on a scale
without a 1.5 loses the padding; `color="$textPrimry"` paints nothing. TypeScript does not help -
every one of those props is typed as a plain string, so a typo compiles.

`packages/ui/src/tokens.contract.test.ts` is the guard, and it covers both halves:

- Every `$name` written anywhere in `ui`, `screens` or either app names something that exists.
  It scrapes the source and checks against the scales and the theme keys, and it names the file
  and the token when it fails.
- Every theme defines the whole of tamagui's own vocabulary, which is the half our source cannot
  show: a built-in asks for `$backgroundFocus` and renders invisibly if nothing answers.

A test rather than a lint rule because the valid list is computed rather than written down - it
comes from the scales and from whatever `@session/theme-tokens` publishes, and a rule would need
that duplicated to read it. The cost is that it fails on push rather than while typing; a rule
that reads a generated list is the way to close that gap if it starts to bite.

## Building the native side

`libsession-util` and `bridge-core` both build here. Two things are worth knowing before the
next person tries:

- **Use gcc, not clang.** libtasn1's gnulib vendoring only skips its own `bool` shim in C23 mode.
  gcc 15 defaults to C23 and builds; clang 21 defaults to C17 and cannot. `ARCHITECTURE.md` has
  the detail.
- **libsession-util's submodule tree is 37 deep.** It is checked out now. On a fresh clone,
  `--reference ~/pro/contribs/libsession-util/.git/modules/<path>` per submodule borrows the
  objects already on disk; a plain recursive init downloads about a gigabyte.

- **gmplib.org drops connections often enough to matter.** It is where gmp comes from and it
  failed about half the times it was asked. Re-running the build picks up where it left off.
- **Nothing linked into the addon may hold absolute relocations**, and libevent's dep script is
  the one that does not pass `--with-pic`. `packages/bridge-node/cmake/cc-pic.sh` puts the flag
  on the compiler instead; it goes away when session-deps closes the gap, which is a one-line
  change upstream and worth raising.

```
pnpm --filter @session/bridge-node build:native
```

## Traps that already cost time

All three are in `ARCHITECTURE.md` under "Things that only running the app finds", but they
are worth repeating because each one presents as something else:

- `#root { display: flex }` is required, or react-native-web renders a correct DOM at zero
  height and every element is invisible to a test.
- `ELECTRON_RUN_AS_NODE=1` is set in this environment. Electron then runs your main file under
  plain Node and refuses Chromium's flags. `env -u ELECTRON_RUN_AS_NODE` before launching.
- The preload buffers both directions of the MessagePort. The renderer asks for the account
  before the port arrives; dropping that request strands the app on its loading screen with
  nothing in the logs.
