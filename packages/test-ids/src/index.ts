/**
 * Every element a test needs to address, named once.
 *
 * The same string is the component's `testID` and the test's selector on all three
 * platforms: react-native surfaces it as an Android resource-id and an iOS
 * accessibilityIdentifier, react-native-web renders it as `data-testid`. Because this repo
 * owns every client, there is no per-platform locator table to keep in step - and if a
 * mapping ever needs an exception, it belongs in the harness's resolver, not here.
 *
 * None of these are user-visible: screen readers announce labels and text, not identifiers,
 * and release builds strip the attribute entirely (QA builds keep it).
 *
 * An element a test cannot address is a missing entry here plus a missing `testID` on the
 * component. It is never a reason to reach for an xpath.
 */
export const ELEMENT = {
  conversationList: {
    settings: 'conversation-list-settings',
    screen: 'conversation-list',
    row: (index: number) => `conversation-row-${index}` as const,
    rowName: 'conversation-row-name',
    rowSnippet: 'conversation-row-snippet',
    rowUnreadBadge: 'conversation-row-unread',
    empty: 'conversation-list-empty',
  },
  conversation: {
    screen: 'conversation',
    header: 'conversation-header',
    headerName: 'conversation-header-name',
    back: 'conversation-back',
    messageRow: (index: number) => `message-row-${index}` as const,
    messageBody: 'message-body',
    messageState: 'message-state',
    composerInput: 'message-composer',
    sendButton: 'send-button',
  },
  requests: {
    screen: 'requests',
    row: (index: number) => `request-row-${index}` as const,
    accept: (index: number) => `request-accept-${index}` as const,
    badge: 'requests-badge',
  },
  settings: {
    screen: 'settings',
    themePicker: 'settings-theme-picker',
    themeOption: (name: string) => `settings-theme-${name}` as const,
    accentOption: (name: string) => `settings-accent-${name}` as const,
    displayName: 'settings-display-name',
    accountId: 'settings-account-id',
    networkStatus: 'settings-network-status',
  },
  starting: {
    screen: 'starting',
  },

  onboarding: {
    screen: 'onboarding',
    createAccount: 'onboarding-create-account',
    restoreAccount: 'onboarding-restore-account',
    recoveryPhraseInput: 'onboarding-recovery-phrase',
    continueButton: 'onboarding-continue',
  },
} as const

/** Every id the registry can produce, including the parameterised ones. */
export type ElementId =
  | 'conversation-list'
  | 'conversation-list-settings'
  | `conversation-row-${number}`
  | 'conversation-row-name'
  | 'conversation-row-snippet'
  | 'conversation-row-unread'
  | 'conversation-list-empty'
  | 'conversation'
  | 'conversation-header'
  | 'conversation-header-name'
  | 'conversation-back'
  | `message-row-${number}`
  | 'message-body'
  | 'message-state'
  | 'message-composer'
  | 'send-button'
  | 'requests'
  | `request-row-${number}`
  | `request-accept-${number}`
  | 'requests-badge'
  | 'settings'
  | 'settings-theme-picker'
  | `settings-theme-${string}`
  | `settings-accent-${string}`
  | 'settings-display-name'
  | 'settings-account-id'
  | 'settings-network-status'
  | 'starting'
  | 'onboarding'
  | 'onboarding-create-account'
  | 'onboarding-restore-account'
  | 'onboarding-recovery-phrase'
  | 'onboarding-continue'
