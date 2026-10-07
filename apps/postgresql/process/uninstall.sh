#!/usr/bin/env bash
# The PostgreSQL package stays installed: other software may use it.
. "$(dirname "$0")/lib.sh"
. "$(dirname "$0")/postgres.sh"
if delete_data_requested; then
  log "Deleting the cluster in data/"
  rm -rf "$DATA_DIR" "$RUN_DIR"
fi
