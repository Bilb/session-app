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

adb="${ANDROID_HOME:-$HOME/Android/Sdk}/platform-tools/adb"
package=org.getsession.session2
staging=/data/local/tmp/session-fake-media

timeout 60 "$adb" shell rm -rf "$staging"
timeout 60 "$adb" shell mkdir -p "$staging"
timeout 300 "$adb" push "$src"/unsplash-*.jpg "$staging/" >/dev/null 2>&1
timeout 60 "$adb" shell run-as "$package" mkdir -p files/fake-media
timeout 120 "$adb" shell run-as "$package" sh -c "'cp $staging/unsplash-*.jpg files/fake-media/'"
timeout 60 "$adb" shell rm -rf "$staging"
echo "pushed $count photographs from $src; restart the app to pick them up"
