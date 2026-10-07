#!/usr/bin/env bash
# The package stays installed: other software may use it.
. "$(dirname "$0")/lib.sh"
if delete_data_requested; then
  log "Deleting data"
  rm -rf "$APP_DIR/data" "$APP_DIR/conf"
fi
