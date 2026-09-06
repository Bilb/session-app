# `@session/bridge-node`

The N-API addon: `session-bridge-core` behind `init` / `call` / `close`, loaded in the Electron
main process. It holds no logic - the shim does that. What it owns is the hop from Core's loop
onto the JavaScript thread, which is the half of the shim's contract the shim deliberately leaves
to its adapter.

N-API rather than NAN so that one build loads in both Node and Electron: the ABI is stable across
both, which is why `vitest` can exercise the addon here without an Electron process.

## Building

```
pnpm --filter @session/bridge-node build:native
```

Takes a while the first time: it builds libsession and its static dependencies. Needs `protoc`,
`cmake`, `ninja` and gcc - see `packages/bridge-core/README.md` for why gcc rather than clang.

The build applies `patches/` to the libsession tree first. There is one patch: libevent's dep
script overrides session-deps' shared configure command and drops `--with-pic`, so its static
archive cannot go into a shared object - which the addon is, and so is the Nitro module. It is a
one-line change waiting on upstream, and it goes away when upstream takes it.

## Testing

`src/addon.test.ts` opens a real encrypted database and round-trips a request. It skips itself
when the addon has not been built, because the per-PR job compiles no C++.
