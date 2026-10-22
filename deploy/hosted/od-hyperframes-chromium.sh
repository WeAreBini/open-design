#!/bin/sh
# HyperFrames headless browser for hosted Open Design (Railway / Docker).
# Chromium in a container needs --no-sandbox; keep args first so HF can append.
exec /usr/bin/chromium \
  --no-sandbox \
  --disable-dev-shm-usage \
  --disable-gpu \
  --hide-scrollbars \
  "$@"
