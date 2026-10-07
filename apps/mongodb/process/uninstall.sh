#!/usr/bin/env bash
# MongoDB and mongosh live in the app directory; data/ goes only when asked.
. "$(dirname "$0")/lib.sh"
. "$(dirname "$0")/mongodb.sh"
rm -rf "$DIST_DIR" "$SHELL_DIR" "$RUN_DIR"
if delete_data_requested; then
  log "Deleting data/"
  rm -rf "$DATA_DIR" "$APP_DIR/conf"
fi
