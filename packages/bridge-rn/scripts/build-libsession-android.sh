#!/bin/bash
set -euo pipefail

# Cross-compiles libsession for one Android ABI, or all four.
#
# This wraps libsession's own utils/static-bundle.sh with the arguments utils/android.sh uses,
# rather than calling android.sh itself, because that script always builds all four ABIs and
# packs a tarball - and an emulator only ever needs one of them.

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
libsession="$here/../../../libsession-util"
ndk="${ANDROID_NDK:-${NDK:-}}"

if [ -z "$ndk" ]; then
    sdk="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-$HOME/Android/Sdk}}"
    ndk="$(ls -d "$sdk"/ndk/* 2>/dev/null | sort -V | tail -1 || true)"
fi
if [ -z "$ndk" ] || [ ! -d "$ndk" ]; then
    echo "Set ANDROID_NDK (or install an NDK under \$ANDROID_SDK_ROOT/ndk)" >&2
    exit 1
fi

abis=("${@:-x86_64}")
if [ "${1:-}" = "all" ]; then
    abis=(armeabi-v7a arm64-v8a x86_64 x86)
fi

# Kept in step with libsession's utils/android.sh rather than with the module's own minSdk: the
# app may raise its floor without the static libraries having to be rebuilt below it.
platform="${ANDROID_PLATFORM:-android-23}"

node "$here/../../../scripts/patch-libsession.mjs"

cd "$libsession"
for abi in "${abis[@]}"; do
    echo "Building libsession for $abi"
    ./utils/static-bundle.sh "build-android/$abi" "" \
        -DCMAKE_TOOLCHAIN_FILE="$ndk/build/cmake/android.toolchain.cmake" \
        -DANDROID_ABI="$abi" \
        -DANDROID_ARM_MODE=arm \
        -DANDROID_PLATFORM="$platform" \
        -DANDROID_STL=c++_static
done
