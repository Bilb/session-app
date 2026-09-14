/**
 * The app's entry point, ahead of expo-router's.
 *
 * Installing the platform ports here is what makes their availability a fact rather than a
 * hope: expo-router builds its routes from a require.context over app/, and nothing
 * promises the root layout is evaluated before a route file that reaches for a port on the
 * way in.
 */
import './src/platform'
// After the ports, before the routes: it reads react-native's own settings modules and sets the
// app's language from them, so the first screen is drawn in the right one.
import './src/locale'

import 'expo-router/entry'
