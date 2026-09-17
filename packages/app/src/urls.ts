/**
 * Every address the app sends somebody to, in one place.
 *
 * **Hard-coded, and deliberately not translatable.** Most of these are reachable before anybody
 * has decided to trust the app -- the terms and the privacy policy are on the landing screen
 * itself -- and a URL a translation could change is a phishing surface. The Crowdin catalogue
 * supplies the words around a link and never the link.
 *
 * Here rather than beside the screen that uses one, because they are reused: the same terms open
 * from onboarding and from settings, and a domain that moves should move once.
 */
export const URLS = {
  website: 'https://getsession.org',
  faq: 'https://getsession.org/faq',
  termsOfService: 'https://getsession.org/terms-of-service',
  privacyPolicy: 'https://getsession.org/privacy-policy',
} as const

export type UrlName = keyof typeof URLS
