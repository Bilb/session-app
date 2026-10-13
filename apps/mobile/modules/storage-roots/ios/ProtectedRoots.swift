import Foundation
import os

/// The directories the app stores anything in, each under data protection class C and excluded
/// from backup.
///
/// **Class C (`completeUntilFirstUserAuthentication`), not A.** A message that arrives while the
/// phone is locked has to be written, and a notification extension has to read the database, so
/// the files must open once the device has been unlocked since boot. That is the legacy client's
/// class, for the same reasons.
///
/// **Excluded from backup**, because what is in them is an account's messages and the keys to
/// them: an iCloud or computer backup would carry them off the device, and legacy keeps them on it.
///
/// A new file inherits its directory's class, so protecting the roots covers what is created in
/// them. A file *moved* in does not: since iOS 26 it keeps the class of where it was created, which
/// is why `protect` exists for single files and why the temporary directory, where such files
/// start, gets class C too.
enum ProtectedRoots {
  struct Paths: Sendable {
    /// libsession's root; each network gets a directory inside it.
    let data: URL
    let logs: URL
    /// Decrypted copies of attachments on their way to the share sheet.
    let exports: URL
    /// False when the app-group container was unavailable and Application Support was used.
    let inAppGroup: Bool
  }

  static let protection = FileProtectionType.completeUntilFirstUserAuthentication

  /// Info.plist's name for the app group, which app.config.ts writes beside the entitlement.
  private static let appGroupKey = "SessionAppGroup"

  private static let log = Logger(subsystem: "org.getsession", category: "storage-roots")

  /// Resolved once: the roots are where the data is, and they must not move during a run.
  static let paths: Paths = resolve()

  /// The app-group container, so a notification extension can share the database rather than
  /// keep a copy of its own. Application Support when there is no group to be had -- a build
  /// without the entitlement -- which still keeps the data out of Documents.
  private static func resolve() -> Paths {
    let manager = FileManager.default
    let caches = manager.urls(for: .cachesDirectory, in: .userDomainMask)[0]
    let exports = caches.appendingPathComponent("exports", isDirectory: true)

    if let group = Bundle.main.object(forInfoDictionaryKey: appGroupKey) as? String,
      let container = manager.containerURL(forSecurityApplicationGroupIdentifier: group)
    {
      return Paths(
        data: container.appendingPathComponent("session", isDirectory: true),
        logs: container.appendingPathComponent("logs", isDirectory: true),
        exports: exports,
        inAppGroup: true
      )
    }

    log.warning("no app-group container; storing in Application Support instead")
    let support = manager.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
    return Paths(
      data: support.appendingPathComponent("session", isDirectory: true),
      logs: support.appendingPathComponent("logs", isDirectory: true),
      exports: exports,
      inAppGroup: false
    )
  }

  /// Creates each root and gives it both attributes, and gives the temporary directory class C.
  /// Idempotent. Returns what failed, each as `path: reason`, rather than throwing: one root that
  /// cannot be protected is no reason to leave the others unprotected.
  @discardableResult
  static func ensure() -> [String] {
    var failures: [String] = []
    for root in [paths.data, paths.logs, paths.exports] {
      do {
        try FileManager.default.createDirectory(
          at: root,
          withIntermediateDirectories: true,
          attributes: [.protectionKey: protection]
        )
        try protect(root)
      } catch {
        failures.append("\(root.path): \(error.localizedDescription)")
      }
    }
    // Attachments are downloaded through it before they reach the data root. Never backed up
    // anyway, so the exclusion only matches what legacy sets.
    do {
      try protect(URL(fileURLWithPath: NSTemporaryDirectory(), isDirectory: true))
    } catch {
      failures.append("\(NSTemporaryDirectory()): \(error.localizedDescription)")
    }
    for failure in failures {
      log.error("could not protect \(failure, privacy: .public)")
    }
    return failures
  }

  /// Gives one file or directory class C and excludes it from backup. False when there is nothing
  /// at `url`, which is not an error: SQLite creates its -wal and -shm only when it needs them.
  @discardableResult
  static func protect(_ url: URL) throws -> Bool {
    guard FileManager.default.fileExists(atPath: url.path) else { return false }
    try FileManager.default.setAttributes([.protectionKey: protection], ofItemAtPath: url.path)
    var target = url
    var values = URLResourceValues()
    values.isExcludedFromBackup = true
    try target.setResourceValues(values)
    return true
  }

  /// What the file system reports for one path: its protection class and whether it is excluded
  /// from backup. Throws when there is nothing there.
  ///
  /// `unreported` where the OS gives no class at all, which is the simulator: it has no data
  /// protection to report.
  static func inspect(_ url: URL) throws -> [String: Any] {
    let attributes = try FileManager.default.attributesOfItem(atPath: url.path)
    let protection =
      (attributes[.protectionKey] as? FileProtectionType).map { name($0) } ?? "unreported"
    // A fresh URL, so the value is read from disk rather than from a cache on this one.
    let excluded =
      try URL(fileURLWithPath: url.path)
      .resourceValues(forKeys: [.isExcludedFromBackupKey]).isExcludedFromBackup ?? false
    return ["protection": protection, "excludedFromBackup": excluded]
  }

  private static func name(_ protection: FileProtectionType) -> String {
    if #available(iOS 17.0, *), protection == .completeWhenUserInactive {
      return "completeWhenUserInactive"
    }
    switch protection {
    case .complete: return "complete"
    case .completeUnlessOpen: return "completeUnlessOpen"
    case .completeUntilFirstUserAuthentication: return "completeUntilFirstUserAuthentication"
    case .none: return "none"
    default: return protection.rawValue
    }
  }
}
