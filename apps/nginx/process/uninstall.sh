#!/usr/bin/env bash
# The nginx package stays installed: other software may use it.
. "$(dirname "$0")/lib.sh"
if delete_data_requested; then
  log "Deleting html/ and conf/"
  rm -rf "$APP_DIR/html" "$APP_DIR/conf" "$APP_DIR/temp" "$APP_DIR/run"
fi
