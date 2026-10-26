import { stopBundleServer } from './bundleServer'

export default async function teardown(): Promise<void> {
  await stopBundleServer()
}
