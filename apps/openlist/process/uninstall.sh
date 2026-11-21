#!/usr/bin/env bash
. "$(dirname "$0")/lib.sh"
. "$(dirname "$0")/openlist.sh"
if delete_data_requested; then
  log "Deleting data/"
  rm -rf "$DATA_DIR"
fi
