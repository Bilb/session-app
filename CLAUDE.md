# session-app

One shared UI and one set of shared screens across an Expo app (`apps/mobile`, Android + iOS,
phone + tablet) and an Electron app (`apps/desktop`, Linux/macOS/Windows). libsession-util
(`client` branch, `libsession-util/` submodule) is the backbone: it owns the database, polling,
sending, receiving, attachments and retries, and pushes whole-state events. Apps render what
libsession says the state is and forward actions to it.

`docs/ARCHITECTURE.md` has the map. There is no web app: desktop means Electron.

## Boundaries

`pnpm boundaries` (dependency-cruiser) is the authority; the ESLint zone matrix says the same
things while you type. Both enforce: nothing imports `apps/*`; `ui` imports no sibling but
theme-tokens/test-ids/basic-types; `screens` imports ui/state/app/client/localization/test-ids;
`tamagui` only in `packages/ui`; `react-native` only in ui and apps/mobile; `expo-*` only in
apps/mobile; `electron` only in desktop main and preload; `react-router` only in the desktop nav
driver; no node builtins in shared packages; the Nitro module only from
`packages/client/src/*.native.*`; the addon only from desktop main; the fake only from tests and
dev entries. When a rule fires, fix the design — not the config.

## Hard rules

- UI components come only from `@session/ui`. Never tamagui, react-native primitives or HTML
  elements in `packages/screens` or in an app.
- Ports: module-scope `setPorts()` / `requirePorts()` for non-React consumers, installed by a
  side-effecting import at each app's entry; React context for render-scoped ports (NavPort);
  `.native.tsx` pairs with a shared `.types.ts` for file-level splits. New port =
  `turbo gen port`.
- Navigation: build paths with `routes.ts` only. Route params are extracted at the route file
  and passed as props — a screen never reads a router. Every route gets a route-contract row.
- Every interactive element takes its `testID` from `@session/test-ids`. An element a test cannot
  address is a missing testID: fix the component, never reach for xpath. Address by id, then
  assert the copy.
- No `.js`/`.jsx` extensions in import paths. No inline `import('x').T` types — top-level
  `import type` instead.
- The fake mirrors the real bridge. Any bridge change updates `packages/client/src/fake` and
  the contract scenarios **in the same PR**.
- Tamagui: a missing token resolves to 0 silently, so token names must exist; `defaultFont`
  must be set; the space scale has half-steps — use them. No hex outside `@session/theme-tokens`.

## Tests required, in the same PR

| change            | test                                               |
| ----------------- | -------------------------------------------------- |
| bridge capability | contract scenario + fake update + codec round-trip |
| screen            | route-contract row + fast-tier e2e smoke           |
| ui component      | render test                                        |
| state projection  | reducer unit test                                  |
| bug fix           | the test that would have caught it                 |

## Native rebuild triggers

- `bridge.proto` changed → `turbo codegen && turbo build:native` (generated output is
  committed; CI's `codegen:check` fails otherwise)
- shim C++ changed → `turbo build:native`
- `*.nitro.ts` changed → `turbo codegen`, then rebuild the mobile dev client
- `libsession-util/` submodule bumped → the `build-native` skill's procedure: rebuild all three
  targets and run the contract suite against the real addon before committing

## Commands

```
pnpm install
turbo dev                      # or dev:mobile / dev:desktop / dev:desktop:fake
turbo lint typecheck test
pnpm boundaries
turbo test:e2e:fast            # Electron + the fake; e2e workflows are manual dispatch in CI
turbo gen package|screen|port|bridge-capability
```

## Conventions

English everywhere — commits, PRs, comments, docs. Commit subjects are imperative; no AI
attribution or co-author trailers. Branch off `main` and open a PR; never push to `main`.
Comments explain a constraint or a choice; they never restate the code.
