# iOS

Two xcframeworks go here, both built by
`pnpm --filter @session/bridge-rn build:libsession:ios` and neither committed: they are hundreds
of megabytes of per-architecture static libraries, and they are reproducible from the submodule
pin.

- `libsession-util.xcframework` — libsession itself, from its own `utils/ios.sh`.
- `SessionBridgeCore.xcframework` — the shim, plus the ten archives `STATIC_BUNDLE` leaves out of
  libsession's own bundle, merged into one library per slice.

**Both carry a device slice as well as a simulator one**, which is what `all` builds. The device
slice is not only for a phone: an iOS app running on an Apple silicon Mac — "Designed for iPad" —
runs the device slice too, so a simulator-only build cannot be run there at all.

The shim is an xcframework rather than a directory of archives because `vendored_libraries` has
no per-SDK form: a directory of `.a` files is a directory for exactly one slice, and the two have
to coexist.
