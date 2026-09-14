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
    newConversation: 'conversation-list-new',
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
    messageRetry: 'message-retry',
    composerInput: 'message-composer',
    sendButton: 'send-button',
  },
  requests: {
    screen: 'requests',
    back: 'requests-back',
    row: (index: number) => `request-row-${index}` as const,
    accept: (index: number) => `request-accept-${index}` as const,
    badge: 'requests-badge',
  },
  settings: {
    screen: 'settings',
    back: 'settings-back',
    themePicker: 'settings-theme-picker',
    themeOption: (name: string) => `settings-theme-${name}` as const,
    accentOption: (name: string) => `settings-accent-${name}` as const,
    displayName: 'settings-display-name',
    accountId: 'settings-account-id',
    copyAccountId: 'settings-copy-account-id',
    networkStatus: 'settings-network-status',
  },
  networkOverlay: {
    badge: 'network-overlay-badge',
  },
  newConversation: {
    screen: 'new-conversation',
    back: 'new-conversation-back',
    accountIdInput: 'new-conversation-account-id',
    start: 'new-conversation-start',
    error: 'new-conversation-error',
  },

  starting: {
    screen: 'starting',
    slowMessage: 'starting-slow-message',
  },

  languagePicker: {
    trigger: 'language-picker',
    panel: 'language-picker-panel',
    search: 'language-picker-search',
    close: 'language-picker-close',
    systemSettings: 'language-picker-system-settings',
    option: (locale: string) => `language-picker-option-${locale}` as const,
  },

  onboarding: {
    screen: 'onboarding',
    back: 'onboarding-back',
    createAccount: 'onboarding-create-account',
    restoreAccount: 'onboarding-restore-account',
    hero: 'onboarding-hero',
    faqLink: 'onboarding-faq-link',
    websiteLink: 'onboarding-website-link',
    termsOfService: 'onboarding-tos',
    openUrlDialog: 'onboarding-open-url',
    openUrlConfirm: 'onboarding-open-url-confirm',
    copyUrl: 'onboarding-copy-url',
    openTerms: 'onboarding-open-terms',
    openPrivacy: 'onboarding-open-privacy',
    openUrlCancel: 'onboarding-open-url-cancel',
    continueButton: 'onboarding-continue',

    displayNameScreen: 'onboarding-display-name-screen',
    displayNameInput: 'onboarding-display-name',
    displayNameError: 'onboarding-display-name-error',
    displayNameCounter: 'onboarding-display-name-counter',

    loadAccountScreen: 'onboarding-load-account-screen',
    recoveryPhraseInput: 'onboarding-recovery-phrase',
    recoveryPhraseReveal: 'onboarding-recovery-phrase-reveal',
    recoveryPhraseError: 'onboarding-recovery-phrase-error',

    notificationsScreen: 'onboarding-notifications-screen',
    notificationsOption: (mode: string) => `onboarding-notifications-${mode}` as const,

    loadingScreen: 'onboarding-loading-screen',
  },
} as const

/** Every id the registry can produce, including the parameterised ones. */
export type ElementId =
  | 'conversation-list'
  | 'conversation-list-settings'
  | 'conversation-list-new'
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
  | 'message-retry'
  | 'message-composer'
  | 'send-button'
  | 'requests'
  | 'requests-back'
  | `request-row-${number}`
  | `request-accept-${number}`
  | 'requests-badge'
  | 'settings'
  | 'settings-back'
  | 'settings-theme-picker'
  | `settings-theme-${string}`
  | `settings-accent-${string}`
  | 'settings-display-name'
  | 'settings-account-id'
  | 'settings-copy-account-id'
  | 'settings-network-status'
  | 'network-overlay-badge'
  | 'new-conversation'
  | 'new-conversation-back'
  | 'new-conversation-account-id'
  | 'new-conversation-start'
  | 'new-conversation-error'
  | 'starting'
  | 'onboarding'
  | 'onboarding-create-account'
  | 'onboarding-restore-account'
  | 'onboarding-recovery-phrase'
  | 'onboarding-continue'
