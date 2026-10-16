import ExpoModulesCore

/// Creates and protects the roots before anything can write into them.
///
/// **`subscriberDidRegister` rather than `didFinishLaunching`.** Expo's app delegate starts React
/// Native first and only then forwards `didFinishLaunching` to subscribers, so a bundle that loads
/// quickly could open the log file before its directory had been protected. This runs before any
/// delegate method at all.
public final class StorageRootsAppDelegateSubscriber: ExpoAppDelegateSubscriber {
  public func subscriberDidRegister() {
    ProtectedRoots.ensure()
  }
}
