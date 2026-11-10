#!/usr/bin/env bash
# MariaDB itself stays installed; data/ goes only when asked.
. "$(dirname "$0")/lib.sh"
. "$(dirname "$0")/mariadb.sh"
rm -rf "$RUN_DIR"
if delete_data_requested; then
  log "Deleting data/"
  rm -rf "$DATA_DIR" "$APP_DIR/conf"
fi
