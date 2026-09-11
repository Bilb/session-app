/**
 * Image and font imports, which the bundlers resolve to a URL and TypeScript knows nothing about.
 *
 * Both bundlers already handle these: vite emits a hashed asset and hands back its path, Metro
 * registers it and hands back a source. Declaring them keeps that out of the compiler's way without
 * teaching it either pipeline.
 */
declare module '*.png' {
  const source: string
  export default source
}

declare module '*.ttf' {
  const source: string
  export default source
}
