const UNITS = ['B', 'kB', 'MB', 'GB', 'TB'] as const
const STEP = 1000

/** How a figure in one unit is rounded, and how many decimals the rounded figure is shown with. */
interface Rounding {
  round(value: number, unit: number): number
  decimals(rounded: number, unit: number): number
}

/**
 * A byte count in the largest unit it reaches, rounded before the unit is settled: 999,999 B rounds
 * to 1000 kB, which has reached the next unit, so it steps up and rounds again there, to 1.0 MB.
 */
function scaled(bytes: number, rounding: Rounding): string {
  let value = bytes
  let unit = 0
  while (value >= STEP && unit < UNITS.length - 1) {
    value /= STEP
    unit += 1
  }
  let rounded = rounding.round(value, unit)
  if (rounded >= STEP && unit < UNITS.length - 1) {
    value /= STEP
    unit += 1
    rounded = rounding.round(value, unit)
  }
  return `${rounded.toFixed(rounding.decimals(rounded, unit))} ${UNITS[unit] ?? 'B'}`
}

/** One decimal under 100 of a unit, none from 100 up, and whole bytes. */
const ONE_DECIMAL: Rounding = {
  round: (value, unit) =>
    unit === 0 ? Math.round(value) : Number(value.toFixed(value >= 100 ? 0 : 1)),
  decimals: (rounded, unit) => (unit === 0 || rounded >= 100 ? 0 : 1),
}

/** Two significant figures from a kilobyte up; a count under that is exact. */
const TWO_FIGURES: Rounding = {
  round: (value, unit) => (unit === 0 ? Math.round(value) : Number(value.toPrecision(2))),
  decimals: (rounded, unit) => (unit === 0 || rounded >= 10 ? 0 : 1),
}

/**
 * A byte count, in decimal units: `48.2 MB`, `312 kB`, `0 B`.
 *
 * Deliberately not kibibytes: a file manager saying 2.4 MB beside this saying 2.3 MiB for the
 * same file reads as a discrepancy rather than as a different convention. Decimal is also what
 * the operating systems' own storage screens use.
 *
 * Not localised, because the catalogue has no key that takes a size and inventing one here is
 * not this file's decision. The digits and the unit are the same in every locale we ship.
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return ''
  return scaled(bytes, ONE_DECIMAL)
}

/**
 * A byte count to two significant figures: `48 MB`, `1.2 kB`, `310 MB`; under a kilobyte, exact.
 *
 * For a figure where the exact one is more than a reader needs and would tell them more than they
 * need: free space, database and cache sizes in a log export. Coarser, not anonymous - a 48 MB
 * database still reads `48 MB` in every export made that week.
 */
export function roughBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return ''
  return scaled(bytes, TWO_FIGURES)
}
