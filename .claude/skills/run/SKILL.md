---
name: run
description: Launch the desktop or mobile app, drive a device or emulator, read its logs and screenshots, or run the e2e suite. Use when asked to run, start, see, screenshot or diagnose session-app on any platform.
---

# Running session-app, and watching it run

Two jobs: starting the thing, and finding out what it did. The second is where the time goes,
and the rules below are why.

Both apps run on the fake libsession with no network and a seeded history, which is the loop to
reach for unless the question is specifically about the real bridge. `SESSION_FAKE=1` is what
picks it.

## Five rules for driving a device

Every one of these was learned by losing time to it.

**Bound every wait, and put a `timeout` on every command.** `adb` against a wedged emulator
blocks for ever, and so does a poll loop with no ceiling — which looks identical to a hung
session from outside. Prefer one deadline check to a loop; when a loop is unavoidable, cap the
iterations and print progress so silence is never the only output.

**Grep for the failure as well as the success.** A filter that matches only the success marker
is silent through a crash, and silence is indistinguishable from "still starting". Before
watching for anything, ask what this would print if the process died right now.

**Name the app exactly, from one source of truth.** `pm list packages | grep session` returns
other people's Session builds — there are usually two or three on a QA emulator — and reading the
wrong app's logcat is a confusing way to spend ten minutes. The ids are in
[references/traps.md](references/traps.md); they come from `app.json` and the desktop manifest,
not from a guess.

**Clear the log, act, then read.** `adb logcat -c` before launching, or you will read a warning
you fixed twenty minutes ago and go looking for it again.

**Artifacts go to the scratchpad**, never into the repository. Screenshots, logs and pulled
databases are all disposable.

## Proving the bridge is alive

The one check worth knowing, because it distinguishes "the app started" from "the whole stack
works" in about fifteen seconds. It asks three questions in order, and the order matters: each
one is meaningless if the one before it failed.

1. **Did the native library load?** Nothing above it can work if not.
2. **Did libsession open its database?** This is the real proof — the file only exists if the
   frame stream carried a command down and an answer back.
3. **Did anything reject?** A promise that failed silently leaves a blank screen and no clue.

### Android

```sh
A=$ANDROID_HOME/platform-tools/adb
PKG=org.getsession.session2

timeout 15 $A logcat -c
timeout 30 $A shell monkey -p $PKG -c android.intent.category.LAUNCHER 1 >/dev/null
sleep 20   # a fixed, bounded wait beats a poll loop for something that takes this long

# 1. the library
timeout 15 $A logcat -d | grep "SessionBridgeRNOnLoad"
# 2. the database — the answer that matters
timeout 15 $A shell run-as $PKG ls -la files/session
# 3. anything that broke
timeout 15 $A logcat -d | grep -E "ReactNativeJS.*([Ee]rror|Uncaught)|FATAL EXCEPTION"
```

A healthy result is `Successfully loaded SessionBridgeRN C++ library!`, then `session.db`
alongside `session.db-shm` and `session.db-wal`, then nothing from the third command. The WAL
files are the tell that libsession really opened it rather than something creating an empty file.

`files/session` holding only `attachments` means the transport was built and `init` never
completed — look at step 3.

### Desktop

The equivalent is simpler because the bridge is in the main process and its stdout is right
there:

```sh
cd apps/desktop && env -u ELECTRON_RUN_AS_NODE pnpm exec electron out/main/index.js
```

The database lands under the platform's userData directory — see
[references/desktop.md](references/desktop.md). No `session.db` and no error on stdout means the
renderer never asked, which is the port handshake in
[references/traps.md](references/traps.md).

## Platform mechanics

One file each, because the verbs are the same and only the tooling differs:

- [references/android.md](references/android.md) — emulators, install, logcat, screenshots, app
  storage, resetting state
- [references/desktop.md](references/desktop.md) — Electron launch, parallel windows, where the
  data lives
- [references/ios.md](references/ios.md) — `simctl`, and why none of it runs on this machine

## The loops

```sh
pnpm dev:desktop            # fake, hot reload — the primary UI loop
pnpm dev:mobile             # fake, needs a dev client
pnpm dev                    # both at once
```

Against the real bridge:

```sh
pnpm dev:desktop:real       # the addon has to be built; see packages/bridge-node/README.md
```

Mobile has no equivalent script because there is nothing to toggle — a dev-client build either
has the Nitro module in it or does not, and `SESSION_FAKE=1` in `apps/mobile`'s `dev` is what
picks the fake over it.

## The e2e suite

```sh
pnpm --filter @session/desktop build
cd tests/e2e && env -u ELECTRON_RUN_AS_NODE xvfb-run -a pnpm exec playwright test --project desktop
```

Drop `xvfb-run` where there is a display; add `--headed` to watch it.

## Everything CI runs

```sh
pnpm format:check && pnpm lint && pnpm lint:manifests && pnpm boundaries \
  && pnpm typecheck && pnpm test && pnpm knip && pnpm codegen:check && pnpm dedupe --check
```

## Known traps

[references/traps.md](references/traps.md), one table per platform. Read it when something
behaves impossibly — most of the entries present as a different problem than they are.
