export type AwaitedReturn<T extends (...args: Array<unknown>) => Promise<unknown>> = Awaited<
  ReturnType<T>
>
