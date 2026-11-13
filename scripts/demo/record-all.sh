#!/usr/bin/env sh
# Records the overview video (case/alongside-demo.mp4, kept out of git).
#
# 1. Start a Chromium with a separate profile and a DevTools port, and sign in to
#    the store admin in it yourself (the profile lives in e2e/.auth/, git-ignored):
#      <playwright chromium> --remote-debugging-port=9333 \
#        --user-data-dir=e2e/.auth/demo-profile --lang=en-US https://admin.shopify.com/
#    The storefront password session comes from the e2e `auth` project.
# 2. Run with ffmpeg on PATH and a work directory for frames:
#      SP=<work dir> sh scripts/demo/record-all.sh [out.mp4]
#
# The admin scenes create a test offer and delete it again, so the store ends as it started.
set -e
for scene in storefront admin-tour admin-create admin-off editor dawn; do
  echo "== $scene"
  node "scripts/demo/scenes/$scene.mjs"
  sleep 3
done
node scripts/demo/cards.mjs
node scripts/demo/assemble.mjs "${1:-case/alongside-demo.mp4}"
