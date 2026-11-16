import type { PathSprite, PathSprites } from '@session/ui'
import { requireNativeView } from 'expo'
import { Platform, type ViewStyle } from 'react-native'

interface NativeProps {
  sprites: readonly PathSprite[]
  pointerEvents: 'none'
  style: ViewStyle
}

const NativePathSprites =
  Platform.OS === 'ios' ? requireNativeView<NativeProps>('PathSprites') : null

/**
 * The path screen's requests run by Core Animation (`modules/path-sprites`), so the app does no
 * work per frame while they travel. Null on Android, where React Native's native driver moves them.
 */
export const mobilePathSprites: PathSprites | null =
  NativePathSprites === null
    ? null
    : ({ sprites, width, height }) => (
        <NativePathSprites
          sprites={sprites}
          pointerEvents="none"
          style={{ position: 'absolute', top: 0, left: 0, width, height }}
        />
      )
