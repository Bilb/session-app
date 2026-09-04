---
name: port-feature
description: Port a feature from session-desktop, session-android or session-ios into session-2's shared packages. Use when asked to bring over an existing Session feature — a screen, a dialog, a setting, a message type.
---

# Porting a feature from the old clients

The old clients each own their database, their protocol and their polling. This repo does
not: libsession owns all of it. So most of what looks like "the feature" in an old client is
not the feature — it is plumbing that has already been replaced.

Work in this order. Steps 1 and 2 decide how much of the rest you need.

## 1. Find it, by its strings

All three clients draw from the same Crowdin project, so a localization token is the one
identifier that exists in every repo. Find the token first, then the code around it.

```
rg '<token>' ~/pro/contribs/session-desktop/ts
rg '<token>' ~/pro/contribs/session-android/app/src/main
rg '<token>' ~/pro/contribs/session-ios/Session
```

`references/repo-maps.md` says where each kind of thing lives in each repo, and which parts
of each are on the way out and should not be treated as design intent.

## 2. Ask whether libsession already does it

Read the feature's behaviour in the old client, then look for it in the client branch:

```
rg -i '<concept>' libsession-util/include/session/client.hpp
rg -i '<concept>' libsession-util/include/session/client/
```

If it is there, **port no logic at all**. The feature becomes a bridge capability plus a
screen — use the `libsession-bridge` skill for the first half. This is the common case for
anything touching messages, conversations, attachments, requests or profiles.

## 3. Split what is left

| what it is                                   | where it goes                                          |
| -------------------------------------------- | ------------------------------------------------------ |
| protocol, storage, retries, polling          | nowhere — libsession has it                            |
| what the screen shows and does               | `@s2/screens`                                          |
| a visual component                           | `@s2/ui`                                               |
| derived state                                | `@s2/state`, as a selector over the projection         |
| OS integration (files, notifications, links) | a port in `@s2/app`, implemented per app               |
| a route                                      | `routes.ts` plus both route files, with a contract row |

## 4. Do not port

- Redux ducks and selectors from session-desktop. State here is a projection of events.
- The webworker marshalling layer. The bridge replaces it.
- styled-components. Use tamagui through `@s2/ui`.
- Any snode, onion, swarm or file-server code.
- Anything under `conversation/v2` (Android), `ConversationVC` or `SessionTableViewController`
  (iOS). Those are the surfaces being replaced, not the design to copy.

## 5. Order of work

Bridge capability → state projection → screen → route wiring in both apps → e2e smoke.

Each step is testable before the next exists, and the fake means none of them need a network.

## 6. Before opening the pull request

- The screen takes route params as props and imports no router.
- Every interactive element has an id in `@s2/test-ids`.
- `pnpm lint typecheck test` and `pnpm boundaries` are green.
- Strings come from `@s2/localization` and render through `LocalizedText` if they carry
  markup. Never hand-write English into a component.
