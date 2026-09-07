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

# The wire format's C++, which CocoaPods compiles rather than CMake - so it has to exist before
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

# The shim, built by CMake for the same slice.
#
# CocoaPods compiles only what lives inside the pod directory - a source glob reaching up into
# packages/bridge-core is dropped in silence, and the first sign of it is our own ClientBridge
# symbols missing at link time. So bridge-core is a CMake project here exactly as it is for the
# Node addon and for Android, and the pod vendors what it produces.
protoc="$(brew --prefix protobuf@21 2>/dev/null)/bin/protoc"
[ -x "$protoc" ] || { echo "brew install protobuf@21 - see packages/bridge-core/CMakeLists.txt" >&2; exit 1; }

case "$archs" in
    arm64) slice="sim-arm64"; cmake_platform="SIMULATORARM64" ;;
    *)     echo "the shim is only wired for a simulator arm64 slice so far" >&2; exit 1 ;;
esac
if [ "$platform" = "iphoneos" ]; then slice="ios-arm64"; cmake_platform="OS64"; fi

# Read from the podspec rather than written down twice: the shim and the pod that vendors it have
# to agree on the floor, and the podspec is the one the build actually enforces.
deployment_target="${IOS_DEPLOYMENT_TARGET:-$(sed -n 's/.*:ios *=> *"\([0-9.]*\)".*/\1/p' "$here/../SessionBridgeRN.podspec")}"
[ -n "$deployment_target" ] || { echo "no :ios platform in SessionBridgeRN.podspec - set IOS_DEPLOYMENT_TARGET" >&2; exit 1; }

build="$repo/packages/bridge-core/build-ios/$slice"
cmake -G Ninja -S "$repo/packages/bridge-core" -B "$build" \
    -DCMAKE_TOOLCHAIN_FILE="$libsession/external/ios-cmake/ios.toolchain.cmake" \
    -DPLATFORM="$cmake_platform" \
    -DDEPLOYMENT_TARGET="$deployment_target" \
    -DENABLE_BITCODE=OFF \
    -DCMAKE_BUILD_TYPE=Release \
    -DSESSION_BRIDGE_PROTOC="$protoc" \
    -DSESSION_BRIDGE_LIBSESSION_BUNDLE="$libsession/build-ios/$slice/libsession-util.a"
cmake --build "$build" --target session-bridge-core --parallel

mkdir -p "$here/../ios/lib"
rm -f "$here/../ios/lib"/*.a
cp "$build/libsession-bridge-core.a" "$build/libsession-bridge-proto.a" "$here/../ios/lib/"

# The pieces STATIC_BUNDLE leaves out despite being "a single static .a containing everything".
# bridge-core's CMake names them on its link line, which is enough for the addon and for Android
# but cannot travel into a vendored static library, so on iOS the pod has to carry them and the
# podspec globs this directory. The same ten, in the same order, as the list in
# packages/bridge-core/CMakeLists.txt, which is where the grouping is explained.
#
# All ten are load-bearing: resolving the bundle's undefined symbols and then the ones each
# archive brings with it pulls in every one, from SQLite::Transaction::commit to blake2b_final.
# A missing one is fatal here rather than skipped, because skipping it only defers the failure to
# an undefined symbol in a later Xcode build.
ls="$libsession/build-ios/$slice"
for lib in \
    "$ls/external/session-sqlite/libsession_sqlite.a" \
    "$ls/external/session-sqlite/libsession_secure_buffer.a" \
    "$ls/external/session-sqlite/SQLiteCpp/libSQLiteCpp.a" \
    "$ls/static-deps/lib/libsqlite3mc.a" \
    "$ls/static-deps/lib/libutf8proc.a" \
    "$ls/static-deps/lib/libhogweed.a" \
    "$ls/static-deps/lib/libtasn1.a" \
    "$ls/static-deps/lib/libidn2.a" \
    "$ls/static-deps/lib/libunistring.a" \
    "$ls/static-deps/lib/libgmp.a"; do
    [ -f "$lib" ] || { echo "the libsession build did not produce $lib" >&2; exit 1; }
    cp "$lib" "$here/../ios/lib/"
done

echo "shim in place: packages/bridge-rn/ios/lib/ ($(ls "$here/../ios/lib" | wc -l | tr -d " ") archives)"
