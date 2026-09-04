---
name: new-screen
description: Add a screen that both apps render, wired into the route registry and both routers. Use when building any new screen or route in session-app.
---

# Adding a screen

A screen lives in `@session/screens` and is rendered by both apps. What differs between platforms
is the route file that reaches it, never the screen.

## The screen

`packages/screens/src/<Name>Screen.tsx`.

- **Route params arrive as props.** `function ConversationScreen({ conversationId }: {...})`.
  Reading them from a router inside the screen is the one import that pins it to a platform.
- Data comes from `@session/state` hooks. Actions go through `useSessionActions()`.
- Navigation goes through `useNav()` and paths built by `routes.*`.
- Every interactive element takes its `testID` from `@session/test-ids`; add entries there first.
- Anything OS-shaped — a file picker, a notification — goes through a port from `@session/app`.
- Responsive behaviour comes from `useMedia()`, not from per-app forks. If a screen needs a
  second pane, that belongs in `AdaptiveShell`.

Export it from `packages/screens/src/index.ts`.

## The route, in three places

1. **`packages/app/src/nav/routes.ts`** — a builder returning an absolute path.
2. **`apps/desktop/src/renderer/App.tsx`** — a `<Route path="..." />`. The contract test
   scrapes this file as text, so the string matters.
3. **`apps/mobile/app/<path>.tsx`** — a file, because expo-router's routes _are_ the
   filesystem. It extracts params and renders the screen, and does nothing else.

## The contract row

Add to `ROUTES` in `packages/app/src/nav/routes.contract.test.ts`:

```ts
{ path: routes.thing('id'), desktop: 'thing/:id', mobile: 'thing/[id].tsx' }
```

That test is what notices when one of the three declarations moves without the others.

## The smoke test

A `sessionTest` in `tests/e2e/specs/` that reaches the screen and asserts one thing about it.
Use the `shared-test` skill.

## Check

```
pnpm typecheck && pnpm test && pnpm boundaries
```

The mobile typecheck is the one that catches a screen reaching for something the native side
does not have.
