# Where session-app is

This file is the mutable one: what exists today and what comes next. `ARCHITECTURE.md` is the
timeless one — how the thing is built and why. `CLAUDE.md` is the rule list. Read all three
before changing anything; they do not repeat each other.

Last updated 2026-09-04, at commit `809dab2`.

## State

Ten commits on `main`. Working tree clean. **No git remote yet** — when one is added, the
branch-and-pull-request rule in `CLAUDE.md` starts applying; until then `main` is all there is.

Everything green: `pnpm format:check`, `pnpm lint` (14), `pnpm lint:manifests`,
`pnpm boundaries`, `pnpm typecheck` (16), `pnpm test` (50 tests), `pnpm knip`,
`pnpm codegen:check`, `pnpm dedupe --check` — the whole of `ci.yml`.

The walking skeleton works end to end. `tests/e2e` drives the built Electron app through
Playwright: it reads a seeded conversation list, opens a conversation, sends a message and
sees it arrive — through the fake libsession, the real protobuf codec, and the MessagePort
bridge. Only the C++ is missing from that path.

## What exists

| package                                        | state                                                               |
| ---------------------------------------------- | ------------------------------------------------------------------- |
| `libsession-util/`                             | submodule, `client` at `e19ebd5c` — the SHA session-cli pins        |
| `@session/basic-types` `@session/theme-tokens` | copied from session-pkgs, trimmed                                   |
| `@session/localization`                        | copied, plus a markup parser for the `<b>`/`<br/>` in the catalogue |
| `@session/test-ids`                            | the element registry                                                |
| `@session/proto`                               | the wire schema, `sessionbridge.v1`, codecs committed               |
| `@session/client`                              | the SessionClient facade, and the fake                              |
| `@session/client-contract`                     | 9 behavioural scenarios, running against the fake                   |
| `@session/state`                               | the projection store, 9 reducer tests                               |
| `@session/ui`                                  | tamagui config, 4 themes x 7 accents, a handful of components       |
| `@session/app`                                 | ports, nav port, route registry, route-contract test                |
| `@session/screens`                             | conversation list, conversation, AdaptiveShell                      |
| `apps/desktop`                                 | Electron, runs, drawn by the e2e suite                              |
| `apps/mobile`                                  | Expo, route files in place, typechecks; not yet run on a device     |
| `bridge-core`                                  | the C++ shim: all nine callbacks, most of the command set           |
| `bridge-node`                                  | the N-API addon, loaded by the desktop main process                 |
| `tests/e2e`                                    | harness + the walking-skeleton spec                                 |

Six skills in `.claude/skills/`: `port-feature`, `libsession-bridge`, `new-screen`,
`ui-component`, `shared-test`, `run`.

## What does not exist yet

- `packages/bridge-rn`, the Nitro module. `bridge-core` and `bridge-node` both build, and the
  desktop app loads the addon when `SESSION_FAKE` is unset.
- Attachment commands (`AttachmentData`, `SaveAttachment`), account restore, push and the
  testing-only `DeliverTestMessage` are not in the shim's dispatch yet. They answer with an
  error naming themselves rather than silently doing nothing.
- `apps/mobile` has never been run. It needs `expo prebuild` and a dev client, and the Nitro
  spike is unproven in this exact stack (hoisted pnpm + Expo 57).
- Attachments, onboarding, requests and settings are placeholder screens.
- The `e2e-full` workflow is a stub.

## Next steps, in order

1. **Contract mode B** — run `@session/client-contract` against the real addon, offline, feeding
   inbound messages through libsession's own test path (`DeliverTestMessage` is already in the
   schema for this). This is what proves the fake has not been lying.
2. **`packages/bridge-rn`** — the Nitro module, then run `apps/mobile` on a device. Second
   proof point: the same echo flow, on real bindings.
3. Then features, via the `port-feature` skill.

## Open questions that need a person

- **Background and push.** The requirement is both slow-path OS wakeups and push-triggered
  fetch, on all three platforms. `PollOnce` / `SetPushToken` / `HandlePushPayload` are in the
  schema. Three questions need raising with the libsession team before the iOS side can be
  designed: a supported one-shot poll entry point; decrypting a push envelope without opening
  the database (for the notification service extension); and whether an extension and the app
  can hold the same database at once.
- **`device::Type`** for the new clients — device records are user-visible on linked devices,
  so this is an upstream conversation.
- **Accepting a message request.** `approveConversation` has no libsession counterpart:
  approval is recorded by messages flowing, and writing to someone is what approves them
  (`DM::request` is derived from the client schema's `contacts.approved`, which sending sets).
  Session's UX has an Accept button that sends nothing, so either the conversation layer needs a
  way to accept without answering, or the button has to mean something else. The shim answers
  this command with an error until that is settled.

- **`--with-pic` for libevent in session-deps.** Its dep script overrides the shared configure
  command and drops the flag its siblings keep, so its static archive cannot go into a shared
  object. Nobody has hit it because nobody has built a shared library from this branch on Linux —
  Android's toolchain is always position-independent. One line, and worth sending upstream.

- **Mnemonic handling.** libsession owns the word list, so no TypeScript library is needed,
  but once words cross into JavaScript they cannot be wiped. Keep them out of logs and out of
  the store.

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
