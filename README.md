# session-app

Session, rebuilt so that one set of screens serves every platform.

libsession-util does the work - the database, polling, sending, receiving, attachments, retries -
and pushes whole state outward. The apps render what it says the state is and forward what the
user did back to it. That is the whole idea, and everything else here follows from it: if the
clients hold no logic worth duplicating, there is no reason to write them three times.

So there are two apps and neither is where the interesting code lives. `apps/mobile` is Expo,
Android and iOS, phone and tablet. `apps/desktop` is Electron, Linux, macOS and Windows. Both are
adapters: route files, OS integration, boot order. There is no web app - desktop means Electron.

## Reading order

Four documents, none of which repeats another:

| document                                     | what it is                                                                      |
| -------------------------------------------- | ------------------------------------------------------------------------------- |
| [docs/STATUS.md](docs/STATUS.md)             | where the build actually is, what is missing, what to do next. The mutable one. |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | how it is put together and why, with a decision log. The timeless one.          |
| [CLAUDE.md](CLAUDE.md)                       | the rules - boundaries, ports, testIDs, fake parity. Short, and load-bearing.   |
| [.claude/skills/](.claude/skills/)           | the procedures: adding a bridge capability, a screen, a component, a test.      |

Start with STATUS. It tells you which of the rest you need.

Each package with anything surprising in it has its own README -
[bridge-core](packages/bridge-core/README.md) for the C++ shim,
[bridge-node](packages/bridge-node/README.md) for the Electron addon,
[bridge-rn](packages/bridge-rn/README.md) for the Nitro module.

## Getting it running

```
pnpm install
pnpm dev:desktop              # the fastest loop: seeded conversations, no network, no C++
```

`dev:desktop` runs the whole app against a working fake libsession. It is not a stub - it
delivers between accounts, routes a first message into the request list, and marks in-flight sends
`interrupted` across a restart - so most UI work never needs the real thing. Everything else, up to
and including a native build on a device, is in STATUS.

```
pnpm lint && pnpm typecheck && pnpm test
pnpm boundaries               # who may import whom, and the authority on it
```

## What is where

```
libsession-util/    the submodule everything stands on, pinned
packages/bridge-*   the protocol as types, the C++ shim generated against them, two transports
packages/client     the one interface every consumer sees, and the fake
packages/state      libsession's events, projected. No optimistic writes.
packages/ui         the components. Nothing else may import tamagui.
packages/screens    the screens both apps draw
packages/app        ports, routes, boot
```

The arrows between those are enforced rather than described: `pnpm boundaries` is the authority,
and ARCHITECTURE explains why each one is drawn where it is.
