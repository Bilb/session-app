/* eslint-disable @typescript-eslint/triple-slash-reference --
   The asset declarations reach consumers only through a path reference. See tamaguiCSS.ts. */
/// <reference path="./assets.d.ts" />
import robotoMono from '../assets/fonts/RobotoMono-VariableFont_wght.ttf'

import { MONO_FAMILY } from './monoFamily'

/**
 * The faces the mobile app has to register before it can draw them, keyed by family.
 *
 * Here rather than in the app so the file and the name it is looked up by live together: a face
 * registered under any other key is never found, and the text falls back without complaint.
 *
 * One variable file, drawn at its default instance, which is the 400 the ID is set in. A request
 * for another weight on native gets that instance too, so nothing should ask for one.
 */
export const FONT_ASSETS = { [MONO_FAMILY]: robotoMono }
