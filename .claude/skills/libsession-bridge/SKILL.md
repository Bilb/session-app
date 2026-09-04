---
name: libsession-bridge
description: Expose a new libsession capability through the bridge — a new command, a new event, a new field. Use when a feature needs something from libsession that the SessionClient interface does not have yet.
---

# Adding a capability to the bridge

Seven steps, in order. The fake and the contract are not optional extras at the end — they
are what makes the next person able to trust this layer.

## 1. Find it in libsession

```
rg -n '<name>' libsession-util/include/session/client.hpp
rg -n '<name>' libsession-util/include/session/client/
```

`libsession-util/tests/test_client/` shows each call being used, and
`~/pro/contribs/session-cli` is a working consumer of the same branch. Read the doc comment on
the method — the sharp edges are documented there and are usually the whole reason a shape
looks odd.

Note which of the two calling conventions you need. The shim uses the handler form always;
the `wait` form would block Core's loop.

## 2. Add it to the schema

`packages/proto/proto/sessionbridge/v1/`:

- a command message plus an arm in `Request.cmd` in `commands.proto`
- a result arm in `Response.result` if it returns something that has no existing shape
- an event arm in `Event.kind` if libsession pushes it

Keep field numbers stable and never reuse one. `buf lint` runs in `pnpm lint`, and
`buf breaking` guards compatibility against main.

Write the semantics into the `.proto` as a comment, especially the edges — which value means
finished, what an absent field means, what order things arrive in. That comment is what the
shim and the fake are both implemented against.

## 3. Regenerate

```
pnpm --filter @s2/proto codegen
```

Generated code is committed. CI runs `codegen:check`, which regenerates and fails on a diff.

## 4. Add it to the facade

`packages/client/src/types.ts` for the interface, `createSessionClient.ts` for the
implementation. Convert 64-bit fields to `number` and numeric enums to string unions in
`convert.ts` — never let a `bigint` or a raw enum reach a screen.

If the call reports progress, register the callback by request id; the facade routes
`AttachmentProgress` frames carrying a `request_id` to it and retires the registration when
every index has reported a result.

## 5. Update the fake — same pull request

`packages/client/src/fake/FakeSessionClient.ts` for the behaviour, and
`packages/client/src/fake/fakeBridge.ts` for the wire handling. The fake must be _honest_
about the edges, not merely present: if libsession reports a state transition, the fake
reports it too, in the same order.

## 6. Add a contract scenario

`packages/client-contract/src/suite.ts`. Write it against the `SessionClient` interface only —
it has to pass against the fake today and against the addon later. Assert the behaviour, not
the implementation: what a caller can rely on.

```
pnpm --filter @s2/client-contract test
```

## 7. Wire it into the store, if a screen needs it

`packages/state/src/applyEvent.ts` for an event, `store.ts` for an action. Add a reducer test
that replays the event.

## When the shim exists

Editing `bridge.proto` or the shim's C++ means `turbo codegen && turbo build:native`, then the
contract suite against the real addon before committing. Bumping the `libsession-util`
submodule means rebuilding all three targets and running the same suite — the pin and the shim
move together.

`packages/client/src/fake/fakeBridge.ts` is the protocol in readable form. When the C++ and the
fake disagree, that file plus the contract suite say which one is wrong.
