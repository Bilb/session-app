---
name: run
description: Launch the desktop or mobile app, or the e2e suite. Use when asked to run, start, or see session-2 working.
---

# Running session-2

Both apps run on the fake libsession today. It seeds two accounts with a short history, so
there is something on screen immediately and no network is involved.

## Desktop

```
pnpm --filter @s2/desktop dev
```

`SESSION_FAKE=1` is set by the script. Without it the app refuses to start rather than
pretending — there is no real bridge yet.

To run the built app the way the tests do:

```
pnpm --filter @s2/desktop build
cd apps/desktop && SESSION_FAKE=1 pnpm exec electron out/main/index.js
```

**If it starts under plain Node instead of Electron**, `ELECTRON_RUN_AS_NODE=1` is set in the
environment — many terminals set it. Prefix with `env -u ELECTRON_RUN_AS_NODE`.

## Mobile

```
pnpm --filter @s2/mobile dev
```

Needs a dev client rather than Expo Go once the Nitro module exists. `expo prebuild` generates
the native projects; they are gitignored.

## The e2e suite

```
pnpm --filter @s2/desktop build
cd tests/e2e && env -u ELECTRON_RUN_AS_NODE xvfb-run -a pnpm exec playwright test --project desktop
```

Drop `xvfb-run` on a machine with a display. Add `--headed` to watch it.

## Everything CI runs

```
pnpm lint && pnpm lint:manifests && pnpm typecheck && pnpm test && pnpm boundaries && pnpm knip
```
