#!/usr/bin/env bash
# Runs catalog.spec.ts inside the pinned image, so a capture is the same on a laptop, a GitHub
# runner or a self-hosted one. Takes CATALOG_TIER and CATALOG_OUT like the spec; the checkout,
# its node_modules and a built desktop app come from the host.
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd)
repo=$(cd "$here/../../.." && pwd)
out=${CATALOG_OUT:-$repo/test-results/catalog}
media=${SESSION_FAKE_MEDIA_DIR:-$HOME/.cache/session-app/dev-media}

docker build --quiet --tag session-catalog "$here" >/dev/null
# Made here, so the container's user owns nothing the host cannot clean up.
mkdir -p "$out"

# --init: xvfb-run as the container's first process never hears that Xvfb is ready.
# CATALOG_CGROUP_PARENT lifts a capture out of a daemon-wide parent that throttles a host's CI.
docker run --rm --init ${CATALOG_CGROUP_PARENT:+--cgroup-parent "$CATALOG_CGROUP_PARENT"} \
  --user "$(id -u):$(id -g)" \
  --env HOME=/tmp/home --env COREPACK_HOME=/tmp/corepack \
  --env CATALOG_TIER="${CATALOG_TIER:-pr}" --env CATALOG_OUT=/out \
  --env SESSION_FAKE_MEDIA_DIR=/media \
  --volume "$repo:$repo" --volume "$out:/out" --volume "$media:/media:ro" \
  --workdir "$repo/tests/e2e" \
  session-catalog \
  xvfb-run -a -s '-screen 0 3200x2600x24' pnpm exec playwright test --project catalog "$@"
