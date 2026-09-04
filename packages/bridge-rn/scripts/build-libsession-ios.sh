#!/bin/bash
set -euo pipefail

# Cross-compiles libsession for iOS and puts the xcframework where the podspec expects it.
#
# Wraps libsession's own utils/ios.sh rather than reimplementing it: its dependencies have to be
# built by libsession's build, which is the only one that gets the cross toolchain as far as the
# CMake-based ones.
#
# Defaults to the simulator on this machine's architecture, which is the debug loop. `all` builds
# what a release needs: device arm64 plus both simulator slices.

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo="$here/../../.."
libsession="$repo/libsession-util"

if [ "$(uname -s)" != "Darwin" ]; then
    echo "iOS builds need macOS and Xcode." >&2
    exit 1
fi

case "${1:-simulator}" in
    all)       platform=""              ; archs="arm64 x86_64" ;;
    device)    platform="iphoneos"      ; archs="arm64" ;;
    simulator) platform="iphonesimulator"; archs="$(uname -m)" ;;
    *) echo "usage: $0 [simulator|device|all]" >&2; exit 1 ;;
esac

node "$repo/scripts/patch-libsession.mjs"

# The wire format's C++, which CocoaPods compiles rather than CMake — so it has to exist before
# `pod install`, not during the build.
(cd "$repo" && pnpm codegen:cpp)

cd "$libsession"
# Debug_Compile_LibSession is libsession's own name for "skip the submodule freshness check",
# which we need because patches/ leaves session-deps deliberately modified.
env ARCHS="$archs" PLATFORM_NAME="$platform" CONFIGURATION=Debug_Compile_LibSession \
    ./utils/ios.sh "" true true true false

framework="$libsession/build-ios/libsession-util.xcframework"
[ -d "$framework" ] || { echo "no xcframework at $framework" >&2; exit 1; }

mkdir -p "$here/../ios"
rm -rf "$here/../ios/libsession-util.xcframework"
cp -R "$framework" "$here/../ios/libsession-util.xcframework"
echo "xcframework in place: packages/bridge-rn/ios/libsession-util.xcframework"
