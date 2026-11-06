#!/usr/bin/env bash
# The nginx package stays installed: other software may use it.
. "$(dirname "$0")/lib.sh"
if delete_data_requested; then
  log "Deleting the configuration, websites and logs"
  for d in html conf conf.d sites ssl www acme logs temp run; do
    rm -rf "${APP_DIR:?}/$d"
  done
  rm -f "$APP_DIR/nginx.conf" "$APP_DIR/mime.types"
fi
