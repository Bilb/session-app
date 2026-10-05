import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import type * as ConfigPlugins from '@expo/config-plugins'
import type { ConfigContext, ExpoConfig } from 'expo/config'

/**
 * Required rather than imported, because node cannot see half of this module's exports.
 *
 * `@expo/config-plugins` is CommonJS and declares its namespaces -- `IOSConfig` and its siblings
 * -- as property getters, which the static analysis node applies to a CommonJS module does not
 * detect. `import { IOSConfig }` therefore fails at load with "does not provide an export named",
 * while the plain functions beside it import fine. Through `require` they are ordinary properties.
 */
const { IOSConfig, withXcodeProject } = createRequire(import.meta.url)(
  '@expo/config-plugins',
) as typeof ConfigPlugins

/**
 * A file in the generated catalogue, read as text rather than imported from.
 *
 * Expo evaluates this file in plain node, which cannot load the workspace packages' TypeScript
 * source, and copying the list into `app.json` would be a second one to forget.
 *
 * Every reader below throws when it finds nothing rather than returning nothing, because what that
 * produces -- a settings page with no language row, an English prompt on a Japanese phone -- is
 * invisible from here.
 */
function generated(file: string): string {
  return readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      '../../packages/localization/src/localization-src/generated',
      file,
    ),
    'utf8',
  )
}

/** A TypeScript single-quoted literal's escapes, undone. */
function unquoted(literal: string): string {
  return literal.replace(/\\(.)/g, '$1')
}

/** The locale list, from the catalogue's own identifiers, which are Crowdin's. */
function shippedLocales(): string[] {
  const listed = /crowdinLocales\s*=\s*\[([^\]]*)\]/s.exec(generated('constants.ts'))
  const locales = listed?.[1]?.match(/'([^']+)'/g)?.map((quoted) => quoted.slice(1, -1)) ?? []
  if (locales.length === 0) throw new Error('no locales found in the generated catalogue')
  return locales
}

/**
 * The prompts iOS composes itself, and the catalogue key each one's explanation comes from.
 *
 * These belong to Crowdin like any other user-visible string, but iOS reads them out of the bundle
 * rather than asking the app, so they have to be baked in at build time in every language. Android
 * needs nothing equivalent: there the system supplies the wording and the only copy we own is the
 * screen we draw around the prompt, which goes through `tr()` like everything else.
 *
 * **Declared before the features that need them, deliberately.** iOS kills an app the moment it
 * touches a protected resource with no purpose string, and the crash names neither the resource
 * nor the missing key -- so the cost of declaring one early is a line here, and the cost of
 * forgetting one is a launch-time crash somebody has to bisect.
 *
 * These are the legacy client's seven, which is its complete set: it declares no location, no
 * tracking, and nothing for contacts, calendar, motion or Bluetooth.
 *
 * **Sourced from the catalogue rather than copied from the client's plist**, which matters more
 * than it looks: the client's literals are overridden at build time from the same catalogue, and
 * five of the seven have since gone stale against what it actually ships. Copying the plist would
 * ship strings the client itself stopped showing.
 *
 * `NSLocalNetworkUsageDescription` is declared with the `NSBonjourServices` array it needs, and
 * both are inert until calls arrive: iOS prompts for local networking only when something
 * actually browses for one of those services. The client's service name is a probe rather than a
 * real service -- it browses for it purely to make the prompt appear -- so what is still missing
 * is that browse, and it belongs with the calling code.
 */
const PERMISSION_STRINGS: Record<string, string> = {
  NSCameraUsageDescription: 'cameraGrantAccessDescription',
  NSPhotoLibraryUsageDescription: 'permissionsStorageSend',
  NSPhotoLibraryAddUsageDescription: 'permissionsStorageSave',
  NSMicrophoneUsageDescription: 'permissionsMicrophoneAccessRequiredIos',
  NSAppleMusicUsageDescription: 'permissionsAppleMusic',
  NSFaceIDUsageDescription: 'permissionsFaceId',
  NSLocalNetworkUsageDescription: 'permissionsLocalNetworkAccessRequiredIos',
}

/**
 * The purpose strings a plugin writes, from `englishPermission` below, so the Android permission
 * each one comes with is declared by the same entry. `ios.infoPlist` writes every other one.
 */
const PLUGIN_WRITTEN_KEYS = new Set([
  'NSCameraUsageDescription',
  'NSPhotoLibraryUsageDescription',
  'NSPhotoLibraryAddUsageDescription',
])

/** The English of one of them, which is what the plist itself carries. */
function englishPermission(plistKey: string): string {
  const key = PERMISSION_STRINGS[plistKey]
  const found = new RegExp(`\\b${key}:\\s*'((?:[^'\\\\]|\\\\.)*)'`).exec(generated('english.ts'))
  if (!found?.[1]) throw new Error(`${key} not found in the generated catalogue`)
  return unquoted(found[1])
}

/**
 * Every other language's, in the shape `IOSConfig.Locales` writes into `<lang>.lproj`.
 *
 * `translations.ts` is seven megabytes, so it is scanned rather than parsed: each locale opens a
 * two-space-indented block and each string is a four-space-indented line inside it. Only the table
 * of strings taking no arguments is searched, which is why nothing here substitutes `{app_name}` --
 * a string carrying a token is in another table and is not a permission string.
 *
 * Values are escaped here because the writer is not: it interpolates straight into `key =
 * "value";`, where a quotation mark would close the string early.
 */
function permissionLocales(): Record<string, { ios: Record<string, string> }> {
  const catalogue = generated('translations.ts')
  const table = catalogue.slice(
    catalogue.indexOf('export const translationsSimpleNoArgs'),
    catalogue.indexOf('export const translationsSimpleWithArgs'),
  )
  const plistKeys = Object.entries(PERMISSION_STRINGS)
  const locales: Record<string, { ios: Record<string, string> }> = {}
  let locale: string | undefined

  for (const line of table.split('\n')) {
    const opens = /^ {2}'?([\w-]+)'?: \{$/.exec(line)
    if (opens?.[1] !== undefined) {
      locale = opens[1]
      continue
    }
    const entry = /^ {4}(\w+): '((?:[^'\\]|\\.)*)',$/.exec(line)
    const plistKey = plistKeys.find(([, key]) => key === entry?.[1])?.[0]
    if (locale === undefined || entry?.[2] === undefined || plistKey === undefined) continue
    locales[locale] ??= { ios: {} }
    locales[locale].ios[plistKey] = unquoted(entry[2]).replace(/[\\"]/g, '\\$&')
  }

  if (Object.keys(locales).length === 0) {
    throw new Error('no permission strings found in the generated catalogue')
  }
  return locales
}

/**
 * Writes those strings into the Xcode project, one `<lang>.lproj/InfoPlist.strings` each.
 *
 * Expo offers this as the config's `locales` field, which is not used because that field drives
 * an Android half as well, and the Android half writes a `strings.xml` per locale whether or not
 * the locale has anything in it -- eighty empty resource folders, which is the app declaring
 * eighty resource locales it has no resources for. So the iOS half is called on its own.
 *
 * A locale with an empty map must never be handed over: the writer stops at the first one it sees
 * and silently skips every locale after it.
 */
const withPermissionStrings: ConfigPlugins.ConfigPlugin = (config) =>
  withXcodeProject(config, async (ios) => {
    ios.modResults = await IOSConfig.Locales.setLocalesAsync(
      { locales: permissionLocales() },
      { projectRoot: ios.modRequest.projectRoot, project: ios.modResults },
    )
    return ios
  })

/**
 * What a local build's bundle identifier gets on the end.
 *
 * **`-test` by default, and deliberately so.** An identifier is reserved with Apple by the first
 * account that builds it to a device, so a development build carrying the real one can take
 * `org.getsession.session2` against the wrong developer account, quietly and not easily undone. A
 * release sets `SESSION_BUNDLE_SUFFIX=` (empty) to ship the real identifier.
 *
 * Here rather than in the Xcode project, so it survives a prebuild.
 */
const BUNDLE_SUFFIX = process.env['SESSION_BUNDLE_SUFFIX'] ?? '-test'

/** The identifier this build ships under: what `app.json` names, plus the suffix above. */
function bundleId(config: ConfigContext['config']): string {
  return `${config.ios?.bundleIdentifier ?? 'org.getsession.session2'}${BUNDLE_SUFFIX}`
}

/**
 * `app.json` plus the things that have to be computed.
 *
 * Everything static stays in the JSON, where it is easier to read.
 */
export default ({ config }: ConfigContext): ExpoConfig =>
  withPermissionStrings({
    ...config,
    name: config.name ?? 'Session',
    slug: config.slug ?? 'session-app',
    plugins: [
      ...(config.plugins ?? []),
      // The camera is the scanner behind the restore screen's QR tab.
      [
        'expo-camera',
        {
          cameraPermission: englishPermission('NSCameraUsageDescription'),
          // The plugin adds RECORD_AUDIO to the Android manifest unless told not to, and a
          // dangerous permission on the store listing wants a reason. The only camera here reads
          // QR codes.
          recordAudioAndroid: false,
        },
      ],
      // Exporting a picture or a video puts it in the photo library. The plugin's own strings
      // would replace the catalogue's, and `false` deletes the key from the plist outright.
      // It also sets android:requestLegacyExternalStorage, which Android 10 alone reads and is
      // what lets a photo export write to DCIM there; 11 and up ignore it.
      [
        'expo-media-library',
        {
          photosPermission: englishPermission('NSPhotoLibraryUsageDescription'),
          savePhotosPermission: englishPermission('NSPhotoLibraryAddUsageDescription'),
          // Unset, the plugin declares audio too. Images and video are blocked below.
          granularPermissions: ['photo', 'video'],
        },
      ],
      // Legacy Android's floor.
      ['expo-build-properties', { android: { minSdkVersion: 26 } }],
    ],
    android: {
      ...config.android,
      // The media-library plugin declares reading the library, which saving to it never does;
      // Play asks every app declaring them to justify it.
      blockedPermissions: [
        ...(config.android?.blockedPermissions ?? []),
        'android.permission.READ_MEDIA_IMAGES',
        'android.permission.READ_MEDIA_VIDEO',
        'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
      ],
    },
    ios: {
      ...config.ios,
      bundleIdentifier: bundleId(config),
      entitlements: {
        ...config.ios?.entitlements,
        // **Follows the identifier, because it has to.** The access group is the app's own
        // identifier prefixed by the team, so a `-test` build entitled to the unsuffixed group is
        // entitled to a group it is not in -- and the keychain refuses it. That surfaces as
        // expo-secure-store failing to store the database key, which is the app not starting
        // rather than a warning.
        'keychain-access-groups': [`$(AppIdentifierPrefix)${bundleId(config)}`],
      },
      infoPlist: {
        ...config.ios?.infoPlist,
        // Every purpose string the plugins above do not write. English only here;
        // `permissionLocales` puts each of the other languages into its own `.lproj`, keyed off
        // this same map.
        ...Object.fromEntries(
          Object.keys(PERMISSION_STRINGS)
            .filter((plistKey) => !PLUGIN_WRITTEN_KEYS.has(plistKey))
            .map((plistKey) => [plistKey, englishPermission(plistKey)]),
        ),
        // The service the local-network prompt is triggered by. The client's own name, and not a
        // service anything offers: browsing for it is what makes iOS ask, which is the whole
        // reason it is declared. Without this array the usage description above never appears.
        NSBonjourServices: ['_session_local_network_access_check._tcp'],
        /**
         * **What makes iOS offer a per-app language at all**, and what makes the `.lproj` strings
         * above reachable: a bundle is localized for the languages it declares here.
         *
         * Settings shows a Preferred Language row only for a bundle declaring more than one
         * localization. Nothing sends anybody there -- the picker owns the language -- but iOS
         * reports whatever is chosen as the app's effective locale, which is what the picker's
         * *Default* row follows.
         *
         * The catalogue's own identifiers. iOS matches them by the usual BCP-47 rules rather than
         * exactly, so one it does not recognise costs a row in that list and nothing else.
         */
        CFBundleLocalizations: shippedLocales(),
      },
    },
  })
