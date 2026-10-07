#!/usr/bin/env bash
# The MySQL build lives in the app directory; data/ goes only when asked.
. "$(dirname "$0")/lib.sh"
. "$(dirname "$0")/mysql.sh"
rm -rf "$DIST_DIR" "$RUN_DIR" "$APP_DIR/lib"
if delete_data_requested; then
  log "Deleting data/"
  rm -rf "$DATA_DIR" "$APP_DIR/conf" "$APP_DIR/files"
fi
