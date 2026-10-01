/**
 * Addresses that belong to this app rather than to Session.
 *
 * libsession's table, generated into `urls.generated.ts`, holds what every client links alike --
 * the FAQ, the terms, the token site. What only this app has, such as where its own releases are
 * published, is not the library's to carry, so it is written here: the one place an address may be
 * typed out in the app's code. `urls.contract.test.ts` holds everything else to the generated
 * table, and holds this to nothing the generated table already has.
 */
const REPOSITORY = 'https://github.com/session-foundation/session-app'

export const CLIENT_URLS = {
  /**
   * A version's release page: the tag is the version with a `v` in front. Built whether or not the
   * release exists yet -- a development build's version has no page, and the link says where it
   * would be.
   */
  release: (version: string) => `${REPOSITORY}/releases/tag/v${version}`,
}
