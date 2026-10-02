#!/bin/bash
set -euo pipefail

# Copies the dev photographs into the Android dev client's own storage, where the fake reads them.
#
# The folder desktop's fake reads: SESSION_FAKE_MEDIA_DIR, or ~/.cache/session-app/dev-media, which
# `pnpm fake-media:fetch` fills. `run-as` because the destination is the app's private directory,
# which only a debug build of it may write to.

src="${1:-${SESSION_FAKE_MEDIA_DIR:-$HOME/.cache/session-app/dev-media}}"
count=$( (ls "$src"/unsplash-*.jpg 2>/dev/null || true) | wc -l)
if [ "$count" -ne 30 ]; then
    echo "expected 30 dev photographs in $src, found $count. Run: pnpm fake-media:fetch" >&2
    exit 1
fi

# ANDROID_HOME first, then the two default SDK locations, then whatever adb the shell knows.
sdk="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
if [ -z "$sdk" ]; then
    for candidate in "$HOME/Android/Sdk" "$HOME/Library/Android/sdk"; do
        [ -x "$candidate/platform-tools/adb" ] && sdk="$candidate" && break
    done
fi
adb="${sdk:+$sdk/platform-tools/adb}"
[ -x "$adb" ] || adb="$(command -v adb || true)"
if [ -z "$adb" ]; then
    echo "adb not found: set ANDROID_HOME, or put adb on PATH" >&2
    exit 1
fi
package=org.getsession.session2
staging=/data/local/tmp/session-fake-media

"$adb" shell rm -rf "$staging"
"$adb" shell mkdir -p "$staging"
"$adb" push "$src"/unsplash-*.jpg "$staging/" >/dev/null
"$adb" shell run-as "$package" mkdir -p files/fake-media
"$adb" shell run-as "$package" sh -c "'cp $staging/unsplash-*.jpg files/fake-media/'"
"$adb" shell rm -rf "$staging"
echo "pushed $count photographs from $src; restart the app to pick them up"
