import { stopBundleServer } from './bundleServer'

export default function teardown(): void {
  stopBundleServer()
}
