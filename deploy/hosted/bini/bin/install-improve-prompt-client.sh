#!/bin/sh
# We Are Bini change. Apache License 2.0.
# Install the Improve Prompt progress client over the volume/web copies.
# Leaves Grok auth, the brief rewriter, and the token route untouched.
set -eu

SRC="${OD_IMPROVE_PROMPT_CLIENT_SRC:-/app/deploy/hosted/bini/extensions/od-bini.js}"

if [ ! -f "$SRC" ]; then
  echo "Improve Prompt client source missing: $SRC" >&2
  exit 0
fi

mkdir -p /app/.od/extensions /app/apps/web/out
cp -f "$SRC" /app/.od/extensions/od-bini.js
cp -f "$SRC" /app/apps/web/out/od-bini.js
echo "Improve Prompt progress client installed"
