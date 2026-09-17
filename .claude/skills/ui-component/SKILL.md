---
name: ui-component
description: Add or change a component in @session/ui, including the .native/.web split. Use when building any visual component for session-app.
---

# Adding a component to @session/ui

This package is the only one allowed to import tamagui. Everything else imports from
`@session/ui`, which is why the barrel re-exports the layout primitives too.

## The component

`packages/ui/src/<Name>.tsx`.

- Colours come from theme tokens (`$textPrimary`, `$backgroundSecondary`). **No hex outside
  `@session/theme-tokens`.** A colour written here is one no theme can restyle.
- Sizes come from the token scales: `$1`-`$4` space, `$6`-`$8` size (component heights),
  `$1`-`$4` radius.
- Take a `testID` prop and pass it through if the component is interactive.
- Export it from `src/index.ts`.

## If the platforms need different code

Three files, not two:

- `X.types.ts` - the props interface, imported by both
- `X.tsx` - the web flavour
- `X.native.tsx` - the native flavour

The shared types file is what stops the two drifting: each app typechecks against whichever
one its bundler resolves, so a prop added to only one of them would otherwise go unnoticed
until the other platform was run. `Input` is the worked example.

`packages/ui/tsconfig.json` excludes `*.native.*` - those are typechecked by `apps/mobile`,
which loads react-native's types and sets `moduleSuffixes`. Run `pnpm --filter @session/mobile typecheck`
after touching one.

## Tamagui edges worth knowing

- **A missing token resolves to 0, silently.** `padding="$smal"` on a scale with no `smal` is
  not an error, it is no padding. Space tokens are named (`$xxs` to `$3xl`, from `SPACING`), not
  numbered, so a step reads as the step it is rather than as a position to count.
- **`fontSize` alone does not set line height.** Build on `SizableText` and use `size`, which
  drives both. `Text` already does.
- **`settings.defaultFont` must be set** or `$4` resolves against the space scale.
- Native and DOM prop vocabularies differ; `nativeProps.ts` holds the mapping.

## Check

A render test if it has logic worth asserting, then `pnpm --filter @session/ui typecheck` and
`pnpm --filter @session/mobile typecheck`.
