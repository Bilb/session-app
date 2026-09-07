/**
 * Nothing to do on native, where there is no document and no CSS.
 *
 * Themes reach a native component through the theme context instead, as resolved values - which is
 * why the mobile apps were correctly themed while the desktop one was not, and why the bug had gone
 * unnoticed. This file exists so the import in `UIProvider` is unconditional and nothing has to
 * check which platform it is on.
 *
 * No `.types.ts` beside these two, unlike the component splits: the module exports nothing, so
 * there is no shape for the two flavours to drift apart on.
 */
export {}
