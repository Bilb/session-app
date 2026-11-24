import ExpoModulesCore
import UserNotifications

/// The app delegate's part: the APNs registration result, the lease while the app is in front, and
/// how notifications are presented while it is.
public final class SessionPushAppDelegateSubscriber: ExpoAppDelegateSubscriber {
  private var leaseTimer: Timer?

  public func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    UNUserNotificationCenter.current().delegate = NotificationPresenter.shared
    return true
  }

  public func applicationDidBecomeActive(_ application: UIApplication) {
    AppGroup.renewLease()
    leaseTimer?.invalidate()
    leaseTimer = Timer.scheduledTimer(withTimeInterval: AppGroup.leaseRenewal, repeats: true) { _ in
      AppGroup.renewLease()
    }
  }

  public func applicationDidEnterBackground(_ application: UIApplication) {
    leaseTimer?.invalidate()
    leaseTimer = nil
    AppGroup.clearLease()
  }

  public func application(
    _ application: UIApplication,
    didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
  ) {
    let hex = deviceToken.map { String(format: "%02x", $0) }.joined()
    PushToken.log.info("APNs token received (\(hex.count / 2) bytes)")
    PushToken.resolve(hex)
  }

  public func application(
    _ application: UIApplication,
    didFailToRegisterForRemoteNotificationsWithError error: Error
  ) {
    PushToken.log.error(
      "APNs registration failed: \(error.localizedDescription, privacy: .public)")
    PushToken.resolve(nil)
  }
}

/// Decides how a notification shows while the app is in front, and hands a tap to JavaScript.
final class NotificationPresenter: NSObject, UNUserNotificationCenterDelegate {
  static let shared = NotificationPresenter()

  /// The conversation on screen, which gets no banner; see `AppGroup`.
  var openConversation: String?
  var soundWhenOpen = true

  /// A tap that arrived before JavaScript was listening, as a cold launch from a notification
  /// does: handed over when it asks.
  private(set) var pendingTap: String?
  var onTap: ((String) -> Void)? {
    didSet {
      if let onTap, let pending = pendingTap {
        pendingTap = nil
        onTap(pending)
      }
    }
  }

  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification,
    withCompletionHandler completionHandler:
      @escaping (UNNotificationPresentationOptions) -> Void
  ) {
    let thread = notification.request.content.threadIdentifier
    if let open = openConversation, !thread.isEmpty, thread == open {
      completionHandler([])
      return
    }
    completionHandler(soundWhenOpen ? [.banner, .list, .sound] : [.banner, .list])
  }

  /// The thread a message notification belongs to is its conversation (see `decide`); requests and
  /// generic notifications share threads of their own, and only open the app.
  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse,
    withCompletionHandler completionHandler: @escaping () -> Void
  ) {
    defer { completionHandler() }
    let content = response.notification.request.content
    guard content.userInfo["session_kind"] as? String == "message" else { return }
    let thread = content.threadIdentifier
    guard !thread.isEmpty else { return }
    if let onTap { onTap(thread) } else { pendingTap = thread }
  }
}
