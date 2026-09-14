# Desktop

Electron, and easier to watch than a device: the bridge runs in the main process, so its stdout
is the terminal you launched from.

## Launching

```sh
pnpm --filter @session/desktop dev                    # fake, hot reload
```

The built app, the way the e2e suite drives it:

```sh
pnpm --filter @session/desktop build
cd apps/desktop && env -u ELECTRON_RUN_AS_NODE pnpm exec electron out/main/index.js
```

`EXPO_PUBLIC_SESSION_FAKE=1` in front of that runs the fake; without it the app loads the addon, which has
to have been built - see [packages/bridge-node/README.md](../../../../packages/bridge-node/README.md).

`env -u ELECTRON_RUN_AS_NODE` is not optional here. See
[traps.md](traps.md).

## Where the data lives

`app.getPath('userData')`, which is:

| platform | path                                         |
| -------- | -------------------------------------------- |
| Linux    | `~/.config/session-app/`                     |
| macOS    | `~/Library/Application Support/session-app/` |
| Windows  | `%APPDATA%\session-app\`                     |

`session-app` comes from `app.setName()` in the main process. Without it the name is `Electron`
and the data lands beside every other Electron project on the machine.

Inside it: `session.db` and its `-shm`/`-wal`, `attachments/`, and `db-key.bin` - the sealed
database key. Deleting the directory is how you get a clean account; deleting only `session.db`
leaves a key that no longer matches anything, which reads as a corrupt database.

`NODE_APP_INSTANCE` moves it, which is how the e2e suite runs several windows at once without
them fighting over one SQLite file.

## Logs

Two places, and knowing which is which saves a lot of confusion:

- **Main process** - bridge, key custody, MessagePort. Goes to the terminal.
- **Renderer** - screens, store, everything above the transport. Goes to the DevTools console,
  or to the terminal with `--enable-logging`.

A bridge that never answers looks the same from the renderer as one that was never asked, so
check the main process first.

## Screenshots and driving it

Through Playwright, which is what the e2e harness already does:

```sh
cd tests/e2e && env -u ELECTRON_RUN_AS_NODE xvfb-run -a pnpm exec playwright test --project desktop --headed
```

For a one-off screenshot, `page.screenshot({ path })` inside a spec beats anything external:
Playwright already owns the window, and `tests/e2e/harness/DesktopApp.ts` is where the launch
arguments live.

Failures leave traces under `test-results/` - `pnpm exec playwright show-trace <file>` replays
the run with the DOM at every step, which is usually faster than adding logging.
