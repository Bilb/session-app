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
  /// The app's windows the cover hid, and which of them was key, to give back as they were.
  private var covered: [UIWindow] = []
  private weak var keyWindow: UIWindow?
  /// What had the keyboard - the composer, usually - so it gets it back.
  private weak var focused: UIResponder?
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
    let scene = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first
    let window = scene.map { UIWindow(windowScene: $0) } ?? UIWindow(frame: UIScreen.main.bounds)
    // Above the app's own windows, alerts included.
    window.windowLevel = .statusBar + 2
    window.rootViewController = Self.launchScreen()
    // **The keyboard goes down first.** The system draws it above every window the app can make,
    // so over a focused composer the snapshot showed it on top of the cover, QuickType bar and
    // all, and its suggestions come from the draft. Hiding the app's windows does not take it with
    // them, and once they are hidden resigning does not either, so it is resigned while its window
    // still shows - without animation, or the snapshot catches it on the way down.
    focused = UIResponder.current
    UIView.performWithoutAnimation {
      _ = focused?.resignFirstResponder()
    }
    // Then the app's windows are hidden, as legacy hides its own, so nothing of them is drawn or
    // reachable behind the cover. All of this is one turn of the run loop: no frame between.
    covered = (scene?.windows ?? []).filter { !$0.isHidden && $0 !== window }
    keyWindow = covered.first { $0.isKeyWindow }
    for hidden in covered { hidden.isHidden = true }
    window.makeKeyAndVisible()
    cover = window
    CATransaction.flush()
  }

  private func lower() {
    guard let window = cover else { return }
    for hidden in covered { hidden.isHidden = false }
    keyWindow?.makeKey()
    _ = focused?.becomeFirstResponder()
    covered = []
    keyWindow = nil
    focused = nil
    cover = nil
    // A turn of the run loop later, so the app's windows have drawn before they are uncovered:
    // in the same transaction the cover goes first and a black frame shows between.
    DispatchQueue.main.async {
      window.isHidden = true
    }
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

@MainActor
extension UIResponder {
  private static weak var found: UIResponder?

  /// Whatever has the keyboard, found the one way UIKit allows: an action sent to no target goes
  /// to the first responder, which answers by recording itself.
  static var current: UIResponder? {
    found = nil
    UIApplication.shared.sendAction(#selector(recordAsCurrent), to: nil, from: nil, for: nil)
    return found
  }

  @objc private func recordAsCurrent() {
    UIResponder.found = self
  }
}
