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
    # The version the module pins, read from its build.gradle rather than written down twice -
    # and emphatically not the newest installed. These static libraries and SessionBridgeRN link
    # into one .so, so two NDKs means two libc++ runtimes: the tell is `undefined symbol:
    # __cxa_init_primary_exception` at link time, which names nothing about NDK versions. A
    # machine with only the pinned NDK installed never sees it; one that has a newer one too
    # builds a libsession that cannot be linked against.
    pinned="$(sed -n 's/.*getExtOrDefault("ndkVersion", "\([^"]*\)").*/\1/p' \
        "$here/../android/build.gradle" | head -1)"
    if [ -z "$pinned" ]; then
        echo "could not read ndkVersion from packages/bridge-rn/android/build.gradle" >&2
        exit 1
    fi
    ndk="$sdk/ndk/$pinned"
fi
if [ -z "$ndk" ] || [ ! -d "$ndk" ]; then
    echo "NDK not found at '$ndk'. Install it, or set ANDROID_NDK to the one the module pins." >&2
    exit 1
fi
echo "Using NDK: $ndk"

abis=("${@:-x86_64}")
if [ "${1:-}" = "all" ]; then
    abis=(armeabi-v7a arm64-v8a x86_64 x86)
fi

# Kept in step with libsession's utils/android.sh rather than with the module's own minSdk: the
# app may raise its floor without the static libraries having to be rebuilt below it.
platform="${ANDROID_PLATFORM:-android-23}"

# **macOS's `ar` cannot do the last step of this build.** libsession merges its static libraries
# with an MRI script -- `ar -M < session-util.mri`, cmake/combine_archives.cmake -- which is a
# GNU binutils feature. Apple's cctools `ar` has no `-M` and answers with its usage text, so the
# build dies at 100% on `Generating libsession-util.a` with nothing that names the cause.
#
# The NDK ships `llvm-ar`, which does understand MRI scripts. The command in that cmake file is a
# bare `ar`, resolved from PATH, so a shim ahead of PATH is enough and nothing in libsession has
# to change. Scoped to this script, and to the one name.
host="$(uname -s | tr '[:upper:]' '[:lower:]')-x86_64"
llvm_ar="$ndk/toolchains/llvm/prebuilt/$host/bin/llvm-ar"
if [ ! -x "$llvm_ar" ]; then
    echo "no llvm-ar in the NDK at $llvm_ar" >&2
    exit 1
fi
shim="$(mktemp -d)"
trap 'rm -rf "$shim"' EXIT
ln -s "$llvm_ar" "$shim/ar"
export PATH="$shim:$PATH"

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
