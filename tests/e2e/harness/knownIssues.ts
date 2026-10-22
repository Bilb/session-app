import type { AuditIssue, ISessionApp } from './ISessionApp'

/**
 * Findings that are the app's and known, keyed `rule target`, each with why it stands.
 *
 * An entry here is a bug with a name, not a pass: it keeps the audit failing on anything new.
 */
const KNOWN_ISSUES: Partial<Record<ISessionApp['platform'], Readonly<Record<string, string>>>> = {
  desktop: {
    'color-contrast message-attachment-state':
      'textSecondary at caption size on a received bubble is 3.5 to 4.1:1 in every theme, under AA',
    'color-contrast message-attachment': 'the format line under a lead square: the same ink',
    'color-contrast message-attachment-show-all': "the roll's Show all count: the same ink",
    'color-contrast message-attachment-action':
      "a failed file's retry, the danger ink on a received bubble in a light theme: 4.0:1",
    'color-contrast button.variants outlineAccent':
      'the accent as ink on a light page: 1.4 to 2.3:1, worst in yellow',
    'color-contrast button.variants ghostAccent': 'the same ink as outlineAccent: down to 2.0:1',
    'color-contrast button.variants simple': 'its label on the ocean-light page: 3.3:1',
    'color-contrast button.onAccent cell': "a cell's pressed label on the red accent's fill: 2.6:1",
    'color-contrast fileRow.onAccent fetching': 'the same as idle',
    'color-contrast button.variants danger': 'the pressed label on the danger fill: 3.7 to 4.2:1',
    'color-contrast button.variants solid':
      "the label on the red accent's fill, ocean themes: 4.0:1",
    'color-contrast fileRow.onAccent idle':
      'the caption on a purple sent bubble, ocean themes: 4.2:1',
    'color-contrast fileRow.onAccent failed': 'the same',
    'aria-progressbar-name button.variants loading': 'the spinner has no accessible name',
    'color-contrast catalog-settings-row-destructive':
      'the danger ink on a light page, at label size: 4.3:1',
    'color-contrast avatar.sizes xl': 'white initials on a light avatar colour: 1.4 to 2.3:1',
    'color-contrast avatar.sizes 2xl': 'the same',
    'color-contrast avatar.sizes 3xl': 'the same',
    'color-contrast avatar.sizes emoji': 'the same',
    'color-contrast avatar.sizes arabic': 'the same',
  },
  android: {
    'target-size conversation-back':
      'drawn at 32dp; its hitSlop reaches MIN_HIT_TARGET, 40, which is under 48 and not in the bounds',
    'target-size message-attachment-view-list':
      "drawn at 32dp; its hitSlop fills the footer's 48 row, which the tree does not show",
    'target-size message-attachment-action':
      'the same: attachment-footer.spec.ts taps the row edges',
    'target-size message-attachment-show-all': 'a PressArea 32dp tall, with no hitSlop at all',
  },
  ios: {
    'XCUIAccessibilityAuditTypeSufficientElementDescription message-attachment-tile':
      "a tile is named by its filename, which Apple's audit reads as no human-readable label",
    'target-size conversation-back':
      'drawn at 32pt; its hitSlop reaches MIN_HIT_TARGET, 40, which is under 44 and not in the bounds',
    'target-size message-attachment-view-list':
      "drawn at 32pt; its hitSlop fills the footer's 48 row, which the tree does not show",
    'target-size message-attachment-action':
      'the same: attachment-footer.spec.ts taps the row edges',
    'target-size message-attachment-show-all': 'a PressArea 32pt tall, with no hitSlop at all',
  },
}

export const issueKey = (issue: AuditIssue) => `${issue.rule} ${issue.target}`

export const unknownIssues = (platform: ISessionApp['platform'], found: Iterable<AuditIssue>) =>
  [...found].filter((issue) => !(issueKey(issue) in (KNOWN_ISSUES[platform] ?? {})))

/** One line per finding, for an assertion's message. */
export const describeIssues = (issues: readonly AuditIssue[]) =>
  issues.map((issue) => `  ${issueKey(issue)}: ${issue.message}`)
