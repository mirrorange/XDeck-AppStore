#!/usr/bin/env bash
. "$(dirname "$0")/lib.sh"
. "$(dirname "$0")/cloudflared.sh"
if delete_data_requested; then
  log "Deleting the token and options"
  rm -rf "$CONF_DIR"
fi
