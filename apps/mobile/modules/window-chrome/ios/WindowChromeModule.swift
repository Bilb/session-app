import ExpoModulesCore
import UIKit

public class WindowChromeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("WindowChrome")

    /// How much further in from the leading edge a top bar's content has to start to clear the
    /// window's close, minimise and zoom controls, beyond the safe area the app already keeps to.
    ///
    /// iPadOS 26 draws those controls in the corner of a resizable window and leaves them out of
    /// the safe area, so content laid out to it sits under them. Zero where there are none: a full
    /// screen window, a phone, an iPad before 26.
    AsyncFunction("controlsInset") { () -> Double in
      MainActor.assumeIsolated { Self.controlsInset() }
    }.runOnQueue(.main)
  }

  @MainActor
  private static func controlsInset() -> Double {
    guard #available(iOS 26.0, *) else { return 0 }
    let window = UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap(\.windows)
      .first { $0.isKeyWindow }
    guard let view = window?.rootViewController?.view else { return 0 }
    let adapted = view.directionalEdgeInsets(for: .safeArea(cornerAdaptation: .horizontal))
    let plain = view.directionalEdgeInsets(for: .safeArea())
    return Double(max(0, adapted.leading - plain.leading))
  }
}
