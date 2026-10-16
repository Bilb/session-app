import ExpoModulesCore
internal import React

/// Turns on React Native's W3C pointer events, which is what makes hover work on an iPad with a
/// mouse or trackpad and in the iPad app on a Mac.
///
/// Off, React Native never watches the pointer at all: no `onPointerEnter` or `onPointerLeave`
/// reaches JS, so no `hoverStyle` ever applies. The switch is read once, when each surface's touch
/// handler is created, so it has to be set before the app delegate starts React Native - hence
/// here rather than in a module, which loads after the first surface exists.
///
/// A touch still arrives as a touch; only views listening for pointer events receive any.
public final class PointerEventsAppDelegateSubscriber: ExpoAppDelegateSubscriber {
  public func appDelegateWillBeginInitialization() {
    RCTSetDispatchW3CPointerEvents(true)
  }
}
