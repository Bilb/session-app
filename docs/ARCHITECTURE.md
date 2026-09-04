# session-app

One shared UI across an Expo app (Android and iOS, phone and tablet) and an Electron app
(Linux, macOS, Windows). libsession-util's `client` branch is the backbone: it owns the
database, polling, sending, receiving, attachments and retries. The apps render what it says
the state is and forward actions to it.

There is no web app. Desktop means Electron.

## The shape of it

```
libsession-util (C++, submodule)
        │  frames: commands in, responses and events out — one ordered stream
        ▼
@session/client ── the SessionClient interface, one facade, three implementations
        │        Nitro module (mobile) · addon behind preload (desktop) · the fake
        ▼
@session/state ── a projection of libsession's events. No optimistic writes.
        │
        ▼
@session/screens ── the screens, and AdaptiveShell which decides how many panes fit
        │            drawn with @session/ui (tamagui) · addressed by @session/test-ids
        ▼
apps/mobile · apps/desktop ── route files, OS ports, boot order. Adapters, nothing more.
```

Who may import whom is in `tooling/depcruise-config/root.cjs` and enforced by
`pnpm boundaries`. The short version: `ui` imports no sibling but tokens and ids; `screens`
imports ui, state, app, client and localization; nothing imports an app.

## The bridge

`packages/proto/proto/sessionbridge/v1` holds the schema. Three decisions in it are worth
knowing before changing anything:

**Responses ride the same stream as events.** libsession's contract is that a display can be
built by asking once and then applying events. That only holds if a `conversation_list_replaced`
produced _before_ the answer to `getConversations` is also applied before it. A promise
resolving on one channel while events arrive on another gives no such guarantee across IPC or
JSI, and the failure would be a stale row appearing on a race nobody can reproduce. One FIFO
stream carries libsession's own ordering through to TypeScript; the facade still hands callers
promises, resolved from `Response` frames.

**Every event carries whole state.** Never an id to go and fetch. That is what makes a display
bindable, applying the same event twice harmless, and startup race-free.

**Progress has sharp edges, kept sharp.** The first report of an attachment transfer is `0/0`
and means _started_. `result` absent means still going. `result === 0` means accepted and is
the only thing that means finished — `done === total` does not. Reports for one index are
ordered and exactly one carries a result; different indexes interleave.

64-bit fields decode as `bigint` and become `number` at the facade (`packages/client/src/convert.ts`).
Every one of them is a unix-millisecond timestamp, a sqlite rowid or a byte count, all far
inside 2^53. `jstype = JS_NUMBER` is not the way to say this — protobuf-es ignores it.

### The shim

`packages/bridge-core` is one C++ `ClientBridge` compiled against the client-branch headers, with
a Nitro module in front of it on mobile and an N-API addon in the Electron main process. It
registers every libsession callback at construction, serialises each into an `Event` frame, and
hands them to a sink that only enqueues. It sets **no libsession dispatcher**: handlers run inline
on Core's loop doing nothing but encode-and-enqueue, and the platform adapter owns the hop onto the
JS thread. `packages/client/src/fake/fakeBridge.ts` is the protocol written out in TypeScript and
is the reference to match.

Conversation-scoped commands build a `Conversation` on the stack per call. That is safe because the
handler form copies the client pointer and the id into its lambda — the `wait` form captures
`this`, which is one more reason the shim never uses it.

`packages/bridge-node` is the addon in front of it. It owns exactly one thing: the hop from
Core's loop onto the JavaScript thread, through a thread-safe function with an unbounded queue, so
that a frame produced on the loop is never dropped and producing one never blocks. N-API rather
than NAN, so one build loads in both Node and Electron — which is what lets the addon be tested
under vitest without an Electron process at all.

Two commands in the schema have no libsession counterpart and answer with an error rather than
something that half works. `approveConversation`: approval is not a flag anyone sets, it is
recorded by messages flowing, so writing to someone is what approves them. `pollOnce`: Core owns
its poll ticker and exposes no one-shot entry point. Both are open questions in `STATUS.md`.

## The fake, and why it is not a stub

`@session/client/fake` is a working libsession: it delivers between accounts on a manual clock,
routes a first message into the request list, moves a row between lists on approval, and marks
anything in flight `interrupted` across a restart. Both apps run on it today.

`@session/client-contract` is the behavioural suite both implementations must satisfy. It runs
against the fake on every push and will run against the addon offline, feeding messages through
libsession's own test path rather than a network. It has already earned its keep: it caught the
fake calling a `pending` send uninterrupted after a restart.

**Any change to the bridge updates the fake and the contract in the same pull request.** A fake
nobody checks is a fake that quietly stops predicting anything.

## State

`applyEvent` is a pure function from `(state, event)` to state, tested by replaying event logs.
Two rules in it are invisible until they are not:

- An approved conversation must leave the list it came from. Approval arrives as an _update_,
  not a removal and an addition, so a projection that only inserts shows the row twice.
- A message event for a conversation whose history was never loaded is dropped. A window built
  from one event looks complete and is not.

Sending adds no optimistic row. libsession stores the message before the call resolves and
announces it, so there is nothing to reconcile and nothing to put back on failure.

## Screens, and how one UI fits three shapes

`AdaptiveShell` is the only place that decides how many panes are on screen: one below 700px,
list and detail above it, a wider list above 1100. The routes are identical either way, so a
link, a notification tap and the back button behave the same on every device.

Route params are extracted at the route file and passed as props. A screen never reads a
router — that would be the one import that pins it to a platform again. `routes.ts` builds
every path, and `routes.contract.test.ts` holds the three declarations of each route together:
the builder, the desktop table it scrapes as text, and the expo-router file it looks for on
disk.

## Ports

libsession hides the data, so the ports are only about the operating system: secure storage for
the database key (libsession takes a key but neither derives nor stores one), file pickers that
return real paths, image dimensions, notifications, clipboard, links, window focus.

They are installed once at boot by a side-effecting import, before anything renders, because
the store and the boot sequence both read them from outside React. `requirePorts()` throws
rather than returning null: a missing port is a mistake in the app's entry file, and failing
there names it.

## Testing

| tier     | what                                                      | when                         |
| -------- | --------------------------------------------------------- | ---------------------------- |
| unit     | projections, route contracts, codec round trips, the fake | every push                   |
| fast e2e | the Electron app on the fake, no network                  | `e2e-fast` workflow, by hand |
| full e2e | real bindings, devnet, device pool                        | `e2e-full` workflow, by hand |

`tests/e2e/harness/ISessionApp.ts` is the platform-neutral driver interface. Its rule: every
member takes and returns primitives, enums or plain data — no Playwright `Locator`, no Appium
element. Anything one platform cannot do belongs somewhere narrower until every platform can.

`sessionTest` is the only way to declare a test and the only thing that opens or closes a
client. Its `clients` descriptor decides the platforms _and_ the tags, so a spec asking for two
clients is tagged `@2-devices` without anyone writing it down.

**One id per element**, in `@session/test-ids`, used as the component's `testID` and as the test's
selector. Verified: `testID` reaches the DOM as `data-testid` untouched through
react-native-web, so the per-platform locator table the appium suite needs does not exist here.
Release builds strip the attribute; QA builds keep it. An element a test cannot address is a
missing entry in the registry plus a missing `testID` on the component — never a reason to
reach for an xpath.

## Things that only running the app finds

- **react-native's layout wants every ancestor to be a flex container.** A browser's root is
  not, so the app rendered a perfectly correct DOM at zero pixels tall. `#root { display: flex }`
  in the host page is the whole fix.
- **`ELECTRON_RUN_AS_NODE=1` is set by many terminals**, and Electron then refuses Chromium's
  flags and runs your main file under plain Node. The harness clears it.
- **The renderer asks for the account before the MessagePort arrives.** Both directions are
  buffered in the preload; dropping that first request strands the app on its loading screen
  with nothing in the logs.
- **`@tamagui/vite-plugin` peers on vite 8 and electron-vite is on vite 7.** It is an
  optimising compiler, not a requirement. Add it when electron-vite catches up.
- **TypeScript is held at 5.x** because typescript-eslint declares `<6.1.0`, and the typed
  rules are the most valuable ones in a repo whose bridge is entirely async.

## Environment split

Each shared package typechecks with `types: []` and no DOM, so a stray `window` is an error.
The two apps then re-check the same sources: the desktop renderer under a browser lib, the
mobile app under react-native's types with `moduleSuffixes` resolving the `.native` variants.
Every shared file is checked two or three ways per run, with no synthetic profiles to maintain.

## Decision log

Append one paragraph per decision. Undocumented decisions are what rot.

- **2026-09-04 — Responses share the event stream.** Ordering across the boundary is what
  makes hydration race-free; two channels cannot promise it.
- **2026-09-04 — `@session/localization` is consumed as built output.** It wraps a vendored
  submodule whose generated files do not satisfy our strict flags and are not ours to change.
  Building it means consumers read declarations, which `skipLibCheck` covers. It is the only
  package resolved to `dist` rather than `src`.
- **2026-09-04 — dependency-cruiser is the sole boundary authority.** `turbo boundaries` was
  considered and dropped: a second mechanism with its own model, for rules dep-cruiser already
  expresses.
- **2026-09-04 — A Client creates an account unless told not to.** Opening a database is enough
  to mint an identity, so an app that means to offer "create or restore" has already chosen for
  the user by the time it draws anything. `defer_account` is what holds that open, and it is not
  a detail of onboarding: it is a constructor argument, decided before the first frame. The
  desktop app passes it, and `getAccountInfo` answers without an account rather than asking for a
  display name that would throw.

- **2026-09-04 — Nothing linked into the addon may hold absolute relocations.** Obvious in
  hindsight, and it cost a build: libsession's own targets are position-independent, its autotools
  dependencies get there through `--with-pic`, and libevent is the one exception, because its dep
  script overrides the shared configure command and does not carry the flag over. There is no hook
  to add one and session-deps is two submodules down, so the flag goes on the compiler instead —
  `packages/bridge-node/cmake/cc-pic.sh`, to be deleted when upstream closes the gap. The Nitro
  module will want the same thing, which is why our own proto target sets POSITION_INDEPENDENT_CODE
  rather than the addon reaching in to say so.

- **2026-09-04 — The shim's protobuf C++ is generated at build time, not committed.** The
  TypeScript codecs are committed because everything that consumes them is a TypeScript build with
  no toolchain of its own. The C++ classes are the opposite case: the only thing that needs them
  already has CMake and a compiler. Committing them would put a pinned `protoc` on the per-PR job,
  which compiles no C++ at all, and a version drift there would fail `codegen:check` in a job with
  no way to be right.

- **2026-09-04 — The native build uses gcc on Linux, not clang.** libsession's static dependencies
  include libtasn1, whose gnulib vendoring skips its own `bool` shim only when the compiler is in
  C23 mode. gcc 15 defaults to C23; clang 21 still defaults to C17, engages the shim, and cannot
  compile it, because the `HAVE_STDBOOL_H` the shim needs is never defined. Nothing about our own
  code prefers either compiler, and the plan's clang+lld preference predates meeting this.

- **2026-09-04 — Three wire fields were wrong, and the shim is what found them.** `Attachment` had
  `downloaded`, which libsession does not report: what it has is `uploaded` — on the file server —
  and it deliberately records no local path, because the application chose it and a stored copy
  would go stale the moment the file moved. `Attachment.size` is optional upstream, unset until an
  outgoing attachment has uploaded. `Message.unread` had no source at all: unread is a count on the
  conversation, and the field existed only because the fake had found it convenient. A fake with
  nothing to check it against had encoded all three as facts.

- **2026-09-04 — Both e2e workflows are manual.** They need a device pool or a devnet, and a
  pull request should not wait on either.
