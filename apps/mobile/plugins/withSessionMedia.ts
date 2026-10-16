import {
  withGradleProperties,
  withMainApplication,
  type AndroidConfig,
  type ConfigPlugin,
} from '@expo/config-plugins'

const CALL = 'PackageList(this)'
const CONFIGURED = 'SessionMedia.packageConfig'

/**
 * The generated `MainApplication`, with React Native's Fresco handed the configuration that draws
 * `session-media://` on Android.
 *
 * The only way in: `FrescoModule` takes its configuration from `MainPackageConfig`, and the
 * template builds `PackageList(this)` without one. Throws rather than skipping when the line is
 * not there, or the template is Java, because a template change would otherwise ship an app whose
 * pictures never load. Unchanged once applied, so a second prebuild is not a second import.
 */
export function mainApplicationServingMedia(contents: string, language: string): string {
  if (contents.includes(CONFIGURED)) return contents
  if (language !== 'kt' || !contents.includes(CALL)) {
    throw new Error(`MainApplication has no ${CALL} to hand the media configuration to`)
  }
  return contents
    .replace(CALL, 'PackageList(this, SessionMedia.packageConfig(this))')
    .replace(/^(package .*)$/m, '$1\n\nimport session.bridge.rn.SessionMedia')
}

const ANIMATED_WEBP = 'expo.webp.animated'

/**
 * The template's Gradle properties with Fresco's animated WebP decoder linked in: libsession's
 * rendition of an animation is an animated WebP, which the template leaves out for its size.
 */
export function propertiesDecodingAnimatedWebP(
  properties: AndroidConfig.Properties.PropertiesItem[],
): AndroidConfig.Properties.PropertiesItem[] {
  const kept = properties.filter((item) => item.type !== 'property' || item.key !== ANIMATED_WEBP)
  return [...kept, { type: 'property', key: ANIMATED_WEBP, value: 'true' }]
}

export const withSessionMedia: ConfigPlugin = (config) =>
  withGradleProperties(
    withMainApplication(config, (android) => {
      android.modResults.contents = mainApplicationServingMedia(
        android.modResults.contents,
        android.modResults.language,
      )
      return android
    }),
    (gradle) => {
      gradle.modResults = propertiesDecodingAnimatedWebP(gradle.modResults)
      return gradle
    },
  )
