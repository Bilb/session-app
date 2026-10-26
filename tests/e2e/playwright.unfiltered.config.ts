import config from './playwright.config'

/** Every spec in one project with no grep: `scripts/checkProjects.ts` diffs it with the rest. */
export default { ...config, projects: [{ name: 'unfiltered', testMatch: /.*\.spec\.ts/ }] }
