#!/usr/bin/env bash
. "$(dirname "$0")/lib.sh"
. "$(dirname "$0")/frp.sh"
if delete_data_requested; then
  log "Deleting the configuration"
  rm -rf "$APP_DIR/conf"
fi
