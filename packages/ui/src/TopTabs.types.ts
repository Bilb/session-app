export interface TopTab {
  /** Identifies the tab to whoever is holding the state. Never shown. */
  key: string
  label: string
  testID?: string
}

export interface TopTabsProps {
  tabs: TopTab[]
  active: string
  onChange: (key: string) => void
  /** Move the indicator rather than sliding it. See the `disableAnimations` flag. */
  instant?: boolean
}
