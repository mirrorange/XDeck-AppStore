#!/usr/bin/env bash
. "$(dirname "$0")/lib.sh"
. "$(dirname "$0")/rclone.sh"
if delete_data_requested; then
  log "Deleting the remotes and the cache"
  rm -rf "$CONF_DIR" "$CACHE_DIR"
fi
