import ExpoModulesCore
import UIKit

/// Covers the app with its launch screen whenever it stops being active.
///
/// iOS keeps a snapshot of the last frame for the app switcher, and it outlives a clear, so without
/// this the switcher shows whatever conversation was open. The cover goes up on resign-active
/// rather than on entering the background because the snapshot is taken as the app leaves, and
/// `CATransaction.flush()` puts it on screen before that happens rather than at the next frame.
///
/// The application notifications rather than the delegate callbacks: those stop arriving once the
/// app adopts the UIScene lifecycle, and these do not.
public final class AppSwitcherCoverAppDelegateSubscriber: ExpoAppDelegateSubscriber {
  private var cover: UIWindow?
  private var observers: [NSObjectProtocol] = []

  public func subscriberDidRegister() {
    let center = NotificationCenter.default
    let raise: (Notification) -> Void = { [weak self] _ in
      MainActor.assumeIsolated { self?.raise() }
    }
    observers = [
      center.addObserver(forName: UIApplication.willResignActiveNotification, object: nil, queue: .main, using: raise),
      // Also here, for a backgrounding that never resigned first.
      center.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main, using: raise),
      center.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in
        MainActor.assumeIsolated { self?.lower() }
      },
    ]
  }

  private func raise() {
    guard cover == nil else { return }
    let window: UIWindow
    if let scene = UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }).first {
      window = UIWindow(windowScene: scene)
    } else {
      window = UIWindow(frame: UIScreen.main.bounds)
    }
    // Above the app's own windows, alerts included.
    window.windowLevel = .statusBar + 2
    window.rootViewController = Self.launchScreen()
    window.isHidden = false
    cover = window
    CATransaction.flush()
  }

  private func lower() {
    cover?.isHidden = true
    cover = nil
  }

  /// The launch screen the app was built with, so the switcher shows what a cold start shows.
  private static func launchScreen() -> UIViewController {
    let name = Bundle.main.object(forInfoDictionaryKey: "UILaunchStoryboardName") as? String
    if let name, let controller = UIStoryboard(name: name, bundle: .main).instantiateInitialViewController() {
      return controller
    }
    let fallback = UIViewController()
    fallback.view.backgroundColor = .systemBackground
    return fallback
  }
}
