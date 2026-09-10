# Theming

A theme is a handful of authored numbers. Everything else is computed from them, so a colour a
*user* picks goes through the same derivation as one we shipped — a custom accent is not a second
code path.

`packages/theme-tokens` owns it and has **zero runtime dependencies**, so the OKLCh conversions and
the WCAG maths are implemented there rather than pulled in.

## What you author, and what you get

```
polarity ─┐
base ─────┼──▶ 19 roles
tint ─────┤     surfaces · text · borders · semantic · accent variants
accent ───┘
```

| knob | what it is |
| --- | --- |
| `polarity` | `light` or `dark`. Sets the step direction *and* which contrast targets apply. |
| `background` | The base. Where the ladder starts. |
| `tint` | `{ hue, surface, emphasis }`. Two chromas, because surfaces and identity need different amounts. |
| `textTint?` | Optional `{ chroma, hue? }`, if the theme's text carries its identity. Ocean Light's navy. Hue defaults to the theme's. |
| `semantic?` | Optional authored `danger` / `warning`, for a preset whose reds are recognisable. |
| `defaultAccent` | The accent the theme comes up as. Changes nothing derived. |
| `overrides?` | Last resort. A stated departure from the rules. Two presets use it, one role each. |

Every one of these is settable in the playground's Advanced mode, including turning `textTint` off —
which is what makes Ocean Light constructible rather than special.

There is **no authored text colour.** Text is `contrastPick(['#000000', '#FFFFFF'], base)`. This is
not a simplification, it is a correctness property: an authored text anchor cannot be trusted, and a
mid-tone base with an authored white text measured 2.5:1 on every text role at once.

`knobsFor(base, accent)` builds the whole thing from the two picks a person actually makes. Polarity
is read from the base's lightness; the tint hue comes from whichever pick carries hue, base first.

## Which role do I reach for?

Ask what the thing *is*, not what colour you want.

| you are drawing | use |
| --- | --- |
| the page | `backgroundPrimary` |
| a card, a list panel, a recessed pane | `backgroundSecondary` |
| a selected row, a filled input, a hover surface | `backgroundTertiary` |
| a card **inside** a card | `backgroundNested` |
| body text | `textPrimary` |
| a caption, a timestamp, a section label, a snippet | `textSecondary` |
| a disabled label | `textDisabled` |
| an outline control's edge, an input, an illustration frame | `bordersColor` |
| a divider inside a card, a pane edge | `separatorColor` |
| a filled accent button, a badge, an avatar, a bubble you sent | `primaryColor` |
| text or a glyph sitting **on** that fill | `onAccent` |
| a link, an inline emphasis, a large numeral | `accentText` |
| an accent button's hover / pressed | `accentHover` / `accentPressed` |
| destructive text, a destructive outline | `dangerColor` |
| text on a danger fill | `onDanger` |
| a caution line | `warningColor` |
| a switch thumb, a QR panel | `surfaceInverted` |
| the modules printed on that panel | `surfaceInk` |
| an incoming bubble, and its text | `messageBubbleIncomingBg` / `Text` |

No hex outside `@session/theme-tokens`. `pnpm --filter @session/ui test` fails on a token name that
does not exist, because tamagui resolves a missing token to `0` silently.

## The rules that came from bugs

Each of these is here because something shipped wrong or nearly did.

**A colour is relative to what it sits on.** Not to the page. This has bitten the system four
times: the incoming bubble derived from the base while drawn on the thread surface, losing a third
of its separation; the warning derived from the base while drawn inside a card, vanishing entirely
on a mid-tone base; the ghost button with no headroom on white; and `textSecondary` — the most-used
role of the lot — measuring 4.6:1 against a page nothing is drawn on while sitting at 3.9:1 on a
feature-row description.

**Five times now**, counting body text picked against the base while the surfaces stepped the other
way — which produced black body text above light muted text on the same card.

If you add a role, derive it from its parent (`above()`, not `at()`) and clear its floor against
*every* surface it can appear on (`contrastAdjustAll`, `contrastPreferAll`, `contrastPickAll`).
Assume it will be drawn on a card until proven otherwise. Unit tests over the four shipped themes
all passed while muted text was broken; the sweep caught it.

Worth knowing what the fix explained: dimming muted text only as far as the *worst* surface allows
puts light-theme muted text at 5.14:1 against white. The shipped value is 5.17. What had looked
like an arbitrarily dark grey turns out to be exactly what working on a card costs.

**Accent-as-fill and accent-as-text are two roles.** Session's accents are chosen to be vivid on a
bubble. The green accent as link text on white measures under 1.6:1, and the accent is a brand
colour, so it is not ours to darken. `accentText` therefore *picks* between the accent and the body
text. On a light ground it resolves to the body text — which is why a light theme looks less
accented, and that is correct rather than a bug.

**Text on a fill takes the fill's on-colour.** Not `textPrimary`. Both filled button variants used
the body text, which is white in the dark themes: white on the accent green is about 1.6:1.

**Off and disabled states come from the surface ladder, never the border role.** In a theme whose
border is a saturated identity colour, a border-coloured switch track reads as switched *on*.

**Some elements have fixed polarity but not fixed identity.** A switch thumb and a QR panel are
light in every theme — one reads as a physical object, the other has to scan. But light is not
white: Ocean Light's QR panel is a tinted blue. That is `surfaceInverted`.

**Illustrations are exempt. Text and controls are not.** The Session mark and the network diagram
keep the brand green even on white.

**A semantic colour must be distinct from text, not from its sibling.** Danger and warning are
allowed to resemble each other — both light presets already ship a pair that a red-green
colour-blind viewer cannot separate, and the derivation now does the same deliberately. What
neither may be is a colour dull enough to read as a paragraph, and since text is achromatic that is
a question about chroma: `MIN_SEMANTIC_CHROMA`.

Requiring the pair to separate was tried and cost more than it bought. On a light base 4.5:1 pins
both into a narrow band of lightness, so separating them means driving one of them dark, and
whichever yields loses its colour — the warning became a brown at chroma 0.074 that read as body
text. Dropping the requirement raised knob-space coverage from 36% to 47%.

This is also what the standard asks. WCAG 1.4.1 forbids colour as the *sole* carrier of meaning, and
these are sentences — "Do not share your recovery password", "Delete account" — which say what they
mean in words. A bare status dot would be a different question, and should not rely on the pair.

**The amber is per-polarity**, because the gamut answers differently at the two ends: a warning has
to clear 4.5:1 on its surfaces, which on a light base forces it dark, and at low lightness an orange
stays saturated where a yellow turns olive. The two values are the ones the clients already ship —
`#A64B00` light, `#FCB159` dark — and on their own themes the rules pass them through untouched,
because they already clear the floor. Elsewhere the same value is adapted rather than replaced.

No preset overrides `warning` any more. All four author only their `danger`, whose reds are
recognisable and which the derivation would otherwise place visibly elsewhere.

**A divider is not a border.** These were one role until a capture of the real app settled it:
Ocean Light's row dividers measure `#cddce3` (1.31 from the card, surface chroma) while its authored
border is `#5CAACC` (2.59 from the page, emphasis chroma). Conflating them made every divider a
vivid blue rule, and it manufactured a phantom outlier — the 1.33 target fitted to "borders" was the
separator's value all along. Note what this did *not* do: Ocean Light still authors its control
edge, because 2.59 really is louder than the rule's 1.32. The contradiction went; the departure
stayed.

**A surface takes the theme's hue unconditionally; text keeps its own.** These are different
questions and answering them the same way breaks something either direction. `tintFloor` raises a
*surface's* chroma to the floor at the theme hue always — because the tint knob exists to say what
colour the surfaces are, and a base with chroma of its own must not be able to veto it. `dim` does
the opposite for text, where a colour that carries hue keeps it, which is what stops a navy muted
text turning teal.

Gating the hue on whether the chroma needed lifting is what put a 238° discontinuity on a knife
edge: a vivid red base sitting a ten-thousandth under the floor failed the comparison by that hair
and had its hue replaced, so the page was red and every surface on it was blue. Applying it always
is continuous, and a knob has to be continuous.

**Chroma is not negotiable for a semantic colour; contrast and separation are.** Both lightness
searches were given targets that white and black satisfy perfectly, and both duly returned one:
raising the danger/warning separation produced a `#ffffff` warning on one base and `#000000` on
another, and squeezing the last contrast out of an amber on a saturated base gave `#fdfdfd` — 4.56:1
and invisible. `contrastAdjustAll` and `distinguish` share a `CHROMA_KEEP` floor. On a base too
hostile to carry a full palette the guarantee downgrades to *recognisable*, not to *high contrast*,
because a warning that no longer looks like a warning is worse than one with less contrast.

**Ask the gamut, do not assume it.** Requesting a chroma sRGB cannot hold at some lightness does not
fail, it clamps — and clamping RGB moves the hue. Darkening the warning amber walked it from 57° to
the danger red's 29° and then to black. `inGamut()` reduces chroma until the hue survives the round
trip, and every lightness search goes through it.

**A vivid base is not a base either.** `baseFits` caps chroma at 0.12 as well as bounding lightness.
Validity falls off steadily with base saturation, and 0.12 is the knee — capping there lifts the
pass rate among admitted bases from 90% to 93% while still admitting three quarters of them. Above
it the returns flatten and the colour stops being a background: a page at chroma 0.23 is a brand
colour someone has typed into the wrong box.

**A chroma knob cannot have a fixed maximum.** sRGB holds wildly different amounts at different
lightnesses and hues — about 0.28 for a magenta at mid lightness, 0.055 for a yellow on a dark base,
and essentially nothing at either end of the range. Asking past the ceiling does not fail, it
quietly gives you less. Anything offering a chroma control should clamp it to `maxChroma(l, h)` for
the current base and hue, which is what the playground does.

**A mid-tone base is not a base.** The ladder needs the base near one end of the lightness range:
surfaces step away one direction, text the other. `baseFits(base, polarity)` is the precondition,
and its limits are measured rather than chosen — walking neutral greys, the dark end stops working
between L 0.26 and L 0.28, so the limit is **L ≤ 0.27** for dark and **L ≥ 0.82** for light. The two
are not symmetric: a light base leaves semantic colours the whole dark half of the range to work in,
where a dark base pushes them into a ceiling. A picker should say a base does not fit rather than
emit a palette that cannot work.

## Type

One monotonic ramp, named by role in four groups. Never pin an absolute root font size — that is
what keeps OS text scaling reachable, and it is asserted by a contract test.

| group | tokens |
| --- | --- |
| label | `micro` 9 · `caption` 11 · `label` 12 |
| body | `body` 14 · `bodyLarge` 16 |
| header | `title` 18 · `titleLarge` 20 · `heading` 23 · `headingLarge` 26 |
| display | `display` 29 · `displayLarge` 36 |

Line height is derived at `LINE_HEIGHT_RATIO` (1.2), not declared, so a size added to the ramp
cannot arrive without one.

`size="$body"` on `Text` is the font ramp. `size="$6"` on `Icon` is the *size* scale — component
heights. They are different scales that both accept `size`.

Scaling is split by platform: **mobile follows system dynamic text scaling**, **desktop uses zoom**
(Chromium's `setZoomFactor`). Whether desktop should also honour system text scaling where the OS
offers it is open.

## Porting a screen

The newest designs are the authority, in this order: **Session Pro → Session Network → the
Collapsible Footer Action spec**. Several older designs have not been touched in a long time, so
where the rules and an old screen disagree, do not assume the screen is right.

Conventions read off the newest designs, which contradict the older ones:

- **Cards have no edges.** Fill alone separates a card from the page. The border role does dividers,
  outline controls and illustration frames.
- **Section labels are body-size sentence case, muted.** Not uppercase letter-spaced micro-labels.
- **Two input styles**: an outlined pill for a field you fill in, a filled pill for search.
- **The conversation list keeps the base; the thread is the recessed surface**, and a thread's
  header and composer take the base too, because they are chrome rather than content. Mobile and
  desktop genuinely disagree here — on desktop both panes are visible at once. Treat it as a
  breakpoint question.
- **A destructive button is danger-coloured text on a transparent ground**, not a red fill.
- **Inline links have two conventions in the newest designs and it is unresolved**: the Pro card
  sets one as bold body text with an external glyph and no colour; the Network screen uses the
  accent. Pick deliberately and say which.

Layout cases to check on arrival are in the porting checklist. The one number worth carrying: iOS
declares a fixed height 189 times against 9 flexible ones, where Android's Compose layer is 18:20 —
so where a screen came from predicts its layout risk, and Android is the safer porting source.

## Checking your work

- **Coverage.** `coverage.test.ts` samples the knob space — base lightness, chroma and hue, tint hue
  and both chromas, and every accent — and asserts a floor on the share that produces a working
  palette. Measured at the time of writing: **90% of bases `baseFits` admits**, and **95% once the
  base is also near-neutral** (light 87%, dark 98%). It runs in CI with everything else, in a couple
  of seconds, and exists so that a change which quietly shrinks the range of workable themes shows
  up as a number moving rather than as a bug months later. The thresholds are a ratchet, not a
  target.
- `pnpm --filter @session/theme-tokens test` — the rules, the invariants above, and a sweep of
  **112 combinations**: four themes and twelve plausible custom bases against all seven accents,
  every role with a floor, on every surface it can be drawn on. Zero shortfalls is the assertion,
  and the confusability whitelist is a whitelist rather than a count, so a new collision fails.
- `pnpm --filter @session/ui test` — every `'$token'` literal in `ui` and `screens` must name a
  token that exists. It matches any such literal, not just `prop="$x"`, because a token named inside
  a conditional was exactly where a missing one hid.
- A new role needs its contrast asserted against **every surface it can be drawn on**, not just the
  base.

## Adding a theme

Author as little as possible. A new theme should set `polarity`, `background`, `tint` and nothing
else — `semantic` and `overrides` exist for the four presets, whose reds and borders predate any
rule and are recognisable. If a new theme needs an override, the rule is probably wrong.

## Open decisions

Marked so nobody implements one by accident:

1. **The brand red is not a 4.5:1 text colour on Session's surfaces.** `#E12D19` measures 2.6–4.0
   on the raised and nested surfaces of all four themes. Holding danger to text contrast moves it
   visibly. Accessibility or brand exactness — the presets currently author the shipped reds.
2. **The dark warning amber is also a selectable accent.** `#FCB159` is `primaryOrange`, so a dark
   theme with the Orange accent renders warning and accent as the same colour. `distinguish()`
   currently holds warning apart from danger only. The accent is user-chosen and the warning is not.
3. **Both light presets ship a confusable red and amber.** Authored `#E12D19` and `#A64B00` are 18°
   of hue apart at a similar lightness — the derived pair is held apart by `distinguish()`, but
   authored values bypass it by design. A red-green colour-blind viewer would struggle to separate
   them. Pinned by a test rather than changed, because they are the shipped colours.
4. **Whether desktop should honour system text scaling** as well as zoom, and what that costs.
