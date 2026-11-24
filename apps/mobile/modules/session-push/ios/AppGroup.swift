import Foundation

/// What the app shares with its notification extension through the app group's defaults: the
/// words a notification is made of, and while the app is in front, the conversation on screen.
///
/// **The conversation on screen is trusted only under a lease**, an expiry the app renews while it
/// is in front and clears as it leaves. The extension passes the conversation to libsession, which
/// gives it no notification; a flag instead of a lease, left set by a crash, would silence that
/// conversation until the app was next opened.
///
/// Key names are the extension's too (notification-service/NotificationService.mm): change both.
enum AppGroup {
  static let wordsKey = "session.push.words"
  static let inFrontUntilKey = "session.push.inFrontUntil"
  static let openConversationKey = "session.push.openConversation"

  /// How long the lease lasts without being renewed, and how often the app renews it. Long enough
  /// that a renewal is never missed in practice; short enough that a crash, which cannot clear it,
  /// silences pushes for a minute and a half at most.
  static let leaseValidity: TimeInterval = 90
  static let leaseRenewal: TimeInterval = 30

  static var defaults: UserDefaults? {
    guard let group = Bundle.main.object(forInfoDictionaryKey: "SessionAppGroup") as? String
    else { return nil }
    return UserDefaults(suiteName: group)
  }

  static func renewLease() {
    defaults?.set(
      Date().addingTimeInterval(leaseValidity).timeIntervalSince1970, forKey: inFrontUntilKey)
  }

  static func clearLease() {
    defaults?.removeObject(forKey: inFrontUntilKey)
  }

  static func setOpenConversation(_ id: String?) {
    if let id { defaults?.set(id, forKey: openConversationKey) } else {
      defaults?.removeObject(forKey: openConversationKey)
    }
  }
}
