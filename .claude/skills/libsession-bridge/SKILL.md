---
name: libsession-bridge
description: Expose a new libsession capability through the bridge - a new command, a new event, a new field. Use when a feature needs something from libsession that the SessionClient interface does not have yet.
---

# Adding a capability to the bridge

Seven steps, in order. The fake and the contract are not optional extras at the end - they
are what makes the next person able to trust this layer.

## 1. Find it in libsession

```
rg -n '<name>' libsession-util/include/session/client.hpp
rg -n '<name>' libsession-util/include/session/client/
```

`libsession-util/tests/test_client/` shows each call being used, and
`~/pro/contribs/session-cli` is a working consumer of the same branch. Read the doc comment on
the method - the sharp edges are documented there and are usually the whole reason a shape
looks odd.

Note which of the two calling conventions you need. The shim uses the handler form always;
the `wait` form would block Core's loop.

## 2. Add it to the protocol

`packages/bridge-types/src/protocol.ts`:

- an arm in `Command`, tagged by a literal `type`
- an arm in `Result` if it returns something that has no existing shape
- an arm in the event union if libsession pushes it

Domain shapes go in `domain.ts`. Stay inside what the generator accepts: string, number,
boolean, a string-union alias, an interface, or an array of one; optional with `?`. It refuses
anything else and names the declaration.

Write the semantics into the doc comment, especially the edges - which value means finished,
what an absent field means, what order things arrive in. That comment is what the shim and the
fake are both implemented against, and it is carried into the generated C++.

## 3. Regenerate

```
turbo codegen
```

`tooling/bridge-codegen` writes `packages/bridge-core/include/session_bridge/gen`; nitrogen
writes the Nitro spec. Both outputs are committed. CI runs `codegen:check`, which regenerates
and fails on a diff.

## 4. Add it to the shim, the facade, and the addon test

`packages/bridge-core/src/client_bridge.cpp` gets a `handle()` overload for the command - the
build fails until it does - and `convert.cpp` a `to_bridge()` if a new libsession type crosses.
`packages/client/src/types.ts` for the interface, `createSessionClient.ts` for the
implementation. Nothing converts anything: the object the shim builds is the object the screen
gets.

Add the new shape to the frames in `packages/bridge-node/tests/addon.test.ts`: `echoTestFrame`
pushes each one through both converter directions and asserts it came back exactly.

## 5. Update the fake - same pull request

`packages/client/src/fake/FakeSessionClient.ts` for the behaviour, and the handler table in
`packages/client/src/fake/fakeBridge.ts` for the command - the typecheck fails until it has an
entry. The fake must be _honest_ about the edges, not merely present: if libsession reports a
state transition, the fake reports it too, in the same order.

## 6. Add a contract scenario

`packages/client-contract/src/suite.ts`. Write it against the `SessionClient` interface only -
it has to pass against the fake today and against the addon later. Assert the behaviour, not
the implementation: what a caller can rely on.

```
pnpm --filter @session/client-contract test
```

## 7. Wire it into the store, if a screen needs it

`packages/state/src/applyEvent.ts` for an event, `store.ts` for an action. Add a reducer test
that replays the event.

## When the shim exists

Editing `packages/bridge-types` or the shim's C++ means `turbo codegen && turbo build:native`,
then the contract suite against the real addon before committing. Bumping the `libsession-util`
submodule means rebuilding all three targets and running the same suite - the pin and the shim
move together.

`packages/client/src/fake/fakeBridge.ts` is the protocol in readable form. When the C++ and the
fake disagree, that file plus the contract suite say which one is wrong.
