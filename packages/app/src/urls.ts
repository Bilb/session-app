/**
 * The one address libsession does not carry.
 *
 * Its table has every path under the domain and no entry for the domain itself, so this is the
 * only outward address the app still holds a copy of.
 *
 * TODO: delete this file and read the address off `URLS.website`, once the `libsession-util`
 * submodule is bumped past `libsession-util#171` -- which adds `url_website` -- and the table is
 * regenerated. Nothing has to remember: two cases in `urls.contract.test.ts` fail on that bump,
 * and both name this constant.
 */
export const WEBSITE_URL = 'https://getsession.org'
