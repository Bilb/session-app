# Where session-2 is

This file is the mutable one: what exists today and what comes next. `ARCHITECTURE.md` is the
timeless one — how the thing is built and why. `CLAUDE.md` is the rule list. Read all three
before changing anything; they do not repeat each other.

Last updated 2026-09-04, at commit `4535547`.

## State

Eight commits on `main`. Working tree clean. **No git remote yet** — when one is added, the
branch-and-pull-request rule in `CLAUDE.md` starts applying; until then `main` is all there is.

Everything green: `pnpm format:check`, `pnpm lint` (14), `pnpm lint:manifests`,
`pnpm boundaries`, `pnpm typecheck` (16), `pnpm test` (47 tests), `pnpm knip`,
`pnpm codegen:check`, `pnpm dedupe --check` — the whole of `ci.yml`.

The walking skeleton works end to end. `tests/e2e` drives the built Electron app through
Playwright: it reads a seeded conversation list, opens a conversation, sends a message and
sees it arrive — through the fake libsession, the real protobuf codec, and the MessagePort
bridge. Only the C++ is missing from that path.

## What exists

| package                              | state                                                               |
| ------------------------------------ | ------------------------------------------------------------------- |
| `libsession-util/`                   | submodule, `client` at `e19ebd5c` — the SHA session-cli pins        |
| `@s2/basic-types` `@s2/theme-tokens` | copied from session-pkgs, trimmed                                   |
| `@s2/localization`                   | copied, plus a markup parser for the `<b>`/`<br/>` in the catalogue |
| `@s2/test-ids`                       | the element registry                                                |
| `@s2/proto`                          | the wire schema, `sessionbridge.v1`, codecs committed               |
| `@s2/client`                         | the SessionClient facade, and the fake                              |
| `@s2/client-contract`                | 9 behavioural scenarios, running against the fake                   |
| `@s2/state`                          | the projection store, 9 reducer tests                               |
| `@s2/ui`                             | tamagui config, 4 themes x 7 accents, a handful of components       |
| `@s2/app`                            | ports, nav port, route registry, route-contract test                |
| `@s2/screens`                        | conversation list, conversation, AdaptiveShell                      |
| `apps/desktop`                       | Electron, runs, drawn by the e2e suite                              |
| `apps/mobile`                        | Expo, route files in place, typechecks; not yet run on a device     |
| `tests/e2e`                          | harness + the walking-skeleton spec                                 |

Six skills in `.claude/skills/`: `port-feature`, `libsession-bridge`, `new-screen`,
`ui-component`, `shared-test`, `run`.

## What does not exist yet

- `packages/bridge-core` (the C++ shim), `packages/bridge-node` (N-API addon),
  `packages/bridge-rn` (Nitro module). The plan describes all three.
- `apps/mobile` has never been run. It needs `expo prebuild` and a dev client, and the Nitro
  spike is unproven in this exact stack (hoisted pnpm + Expo 57).
- Attachments, onboarding, requests and settings are placeholder screens.
- The `e2e-full` workflow is a stub.

## Next steps, in order

1. **`packages/bridge-core`** — the C++ `ClientBridge`. `packages/client/src/fake/fakeBridge.ts`
   is the protocol written out in TypeScript and is what it has to match. The
   `libsession-bridge` skill has the procedure; `ARCHITECTURE.md` has the threading rules.
   libsession-util's own submodules are not checked out yet — protobuf and session-deps are
   most of a gigabyte, so init them when there is something to compile, with
   `--reference ~/pro/contribs/libsession-util` to borrow the objects already on disk.
2. **`packages/bridge-node`** — N-API addon via cmake-js, loaded in the Electron main process.
   Swap it in at `apps/desktop/src/main/bridge.ts`; nothing above that file changes.
3. **Contract mode B** — run `@s2/client-contract` against the real addon, offline, feeding
   inbound messages through libsession's own test path (`DeliverTestMessage` is already in the
   schema for this). This is what proves the fake has not been lying.
4. **`packages/bridge-rn`** — the Nitro module, then run `apps/mobile` on a device. Second
   proof point: the same echo flow, on real bindings.
5. Then features, via the `port-feature` skill.

## Open questions that need a person

- **Background and push.** The requirement is both slow-path OS wakeups and push-triggered
  fetch, on all three platforms. `PollOnce` / `SetPushToken` / `HandlePushPayload` are in the
  schema. Three questions need raising with the libsession team before the iOS side can be
  designed: a supported one-shot poll entry point; decrypting a push envelope without opening
  the database (for the notification service extension); and whether an extension and the app
  can hold the same database at once.
- **`device::Type`** for the new clients — device records are user-visible on linked devices,
  so this is an upstream conversation.
- **Mnemonic handling.** libsession owns the word list, so no TypeScript library is needed,
  but once words cross into JavaScript they cannot be wiped. Keep them out of logs and out of
  the store.

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
