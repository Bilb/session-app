#!/bin/bash
# Builds and runs the host C++ tests: the parts of the module that need no JSI, Nitro or libsession.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
pkg="$here/../.."
out="${TMPDIR:-/tmp}/session-bridge-rn-tests"
mkdir -p "$out"
# ThreadSanitizer, because what these tests exist to catch is a value touched on the wrong thread.
"${CXX:-g++}" -std=c++20 -g -O1 -fsanitize=thread -pthread \
    -I"$pkg/cpp" -I"$pkg/../bridge-core/include" \
    "$pkg/cpp/MediaSource.cpp" "$pkg/cpp/JsMediaSource.cpp" "$here/JsMediaSource.test.cpp" \
    -o "$out/JsMediaSource.test"
# ThreadSanitizer cannot map its shadow memory under the address randomisation newer kernels use by
# default, so the binary runs with it off where setarch can do that.
if command -v setarch >/dev/null; then
    setarch "$(uname -m)" -R "$out/JsMediaSource.test"
else
    "$out/JsMediaSource.test"
fi
