#!/usr/bin/env bash
. "$(dirname "$0")/lib.sh"
. "$(dirname "$0")/postgres.sh"
state_load
mkdir -p "$RUN_DIR"
own "$RUN_DIR"
# Without exec in as_pg's helpers the server would not get the stop signal.
if [ -z "$PG_RUN_AS" ]; then
  exec "$PG_BIN/postgres" -D "$DATA_DIR"
elif have setpriv; then
  exec setpriv --reuid="$PG_RUN_AS" --regid="$(id -g "$PG_RUN_AS")" --init-groups -- \
    "$PG_BIN/postgres" -D "$DATA_DIR"
else
  exec runuser -u "$PG_RUN_AS" -- "$PG_BIN/postgres" -D "$DATA_DIR"
fi
