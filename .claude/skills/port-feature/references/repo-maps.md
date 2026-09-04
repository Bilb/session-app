# Where things live in the old clients

Paths are relative to each repo's root. All three have a current `ARCHITECTURE.md` worth
reading before starting — they are better than any summary of them.

## session-desktop (`~/pro/contribs/session-desktop`)

Electron, React, Redux Toolkit, styled-components. `ARCHITECTURE.md` is 42k and current.

| what                         | where                                                            |
| ---------------------------- | ---------------------------------------------------------------- |
| screens and components       | `ts/components/` — 328 tsx across 20 subdirectories              |
| conversation surface         | `ts/components/conversation/`                                    |
| left pane, conversation list | `ts/components/leftpane/`                                        |
| dialogs                      | `ts/components/dialog/`                                          |
| settings                     | `ts/components/settings/`, `ts/components/menuAndSettingsHooks/` |
| state (do not port)          | `ts/state/ducks/` (23 slices), `ts/state/selectors/` (22 files)  |
| protocol (do not port)       | `ts/session/`, `ts/receiver/`                                    |
| libsession calls (replaced)  | `ts/webworker/workers/browser/libsession_worker_interface.ts`    |
| themes                       | `ts/themes/` — `variableColors.tsx` is the semantic token list   |
| strings                      | `ts/localization/` — a submodule, the same one this repo has     |
| main process only            | `ts/node/`                                                       |

The theme mapping is the useful part: `variableColors.tsx` names the same semantic roles that
`@s2/theme-tokens` does. Match by role, not by hex.

## session-android (`~/pro/contribs/session-android`)

Kotlin, mid-migration from Views to Compose. `ARCHITECTURE.md` is current; §12 is UI and §13
is localization.

| what                     | where                                                          |
| ------------------------ | -------------------------------------------------------------- |
| everything               | `app/src/main/java/org/thoughtcrime/securesms/`                |
| newest UI, worth copying | `preferences/prosettings/`, `onboarding/`, `conversation/v3/`  |
| older UI, being replaced | `conversation/v2/`, `mediasend/`, `home/HomeActivity.kt`       |
| reusable components      | `ui/components/`                                               |
| theme                    | `ui/theme/` — `ThemeColors.kt` is the semantic token interface |
| strings (generated)      | `app/src/main/res/values/strings.xml`                          |
| **accessibility ids**    | `content-descriptions/src/main/res/values/strings.xml`         |
| QA hooks                 | `qa/QaLaunchConfig.kt`                                         |
| libsession (replaced)    | consumed as a published AAR                                    |

`content-descriptions` is the closest thing the old clients have to `@s2/test-ids`, and the
model it follows is the one this repo took. When porting a screen, its ids are a good starting
list.

`QaLaunchConfig.kt` and iOS's `DeveloperSettingsViewModel+Testing.swift` are a deliberate
cross-platform contract — session-appium is written against the shared field names. Any mock
lever a feature needs must keep the same name here.

## session-ios (`~/pro/contribs/session-ios`)

Swift, in-project frameworks, mid-migration from UIKit to SwiftUI. `ARCHITECTURE.md` §5 is the
module layout, §16 UI, §19 localization.

| what                     | where                                                                         |
| ------------------------ | ----------------------------------------------------------------------------- |
| design system            | `SessionUIKit/` — components, themes, and the newer shared screens            |
| newest UI, worth copying | `SessionUIKit/Screens/`, `Session/Onboarding/`                                |
| older UI, being replaced | `Session/Conversations/ConversationVC*`, `SessionTableViewController`         |
| theme                    | `SessionUIKit/Style Guide/Themes/` — `Theme+Colors.swift` is the token enum   |
| strings (generated)      | `Session/Meta/Translations/Localizable.xcstrings`                             |
| QA hooks                 | `Session/Settings/DeveloperSettings/DeveloperSettingsViewModel+Testing.swift` |
| libsession (replaced)    | remote SPM package, `import SessionUtil`                                      |

iOS inlines accessibility identifiers as string literals rather than keeping a catalogue.
Android's model is the better one and the one this repo uses.

## What the three agree on

Four themes — classic and ocean, each light and dark — and seven accents. Android's
`ThemeColors` and iOS's `ThemeValue` describe the same semantic roles, and `@s2/theme-tokens`
carries them forward. That semantic layer is the portable part of the design; the hex values
underneath it are not.
