import { RecoveryPasswordMark } from '../../Brand'
import { QrCode } from '../../QrCode'
import { defineStory } from '../story'

interface QrRow {
  value: string
  sizePx: number
  logo: boolean
}

/** Made-up seeds, never an account's: one 16 bytes long, as a 13-word account's is, one 32. */
const SHORT_SEED = '0123456789abcdef0123456789abcdef'
const LONG_SEED = `${SHORT_SEED}fedcba9876543210fedcba9876543210`

/**
 * Dark modules on a light panel in every theme, which is the point of `surfaceInk` and
 * `surfaceInverted`: a dark theme that drew it light on dark would be the regression this catches.
 * The logo clears its own square rather than sitting over modules.
 */
export const qrCode = defineStory<QrRow>({
  component: 'qrCode',
  story: 'recoveryPassword',
  width: 280,
  variants: {
    short: { value: SHORT_SEED, sizePx: 260, logo: true },
    long: { value: LONG_SEED, sizePx: 260, logo: true },
    noLogo: { value: SHORT_SEED, sizePx: 260, logo: false },
    narrow: { value: SHORT_SEED, sizePx: 180, logo: true },
  },
  render: ({ value, sizePx, logo }) => (
    <QrCode
      value={value}
      sizePx={sizePx}
      logo={logo ? RecoveryPasswordMark : undefined}
      accessibilityLabel="QR code"
    />
  ),
})
