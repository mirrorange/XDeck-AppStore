#!/usr/bin/env bash
. "$(dirname "$0")/lib.sh"
. "$(dirname "$0")/mariadb.sh"
state_load
mkdir -p "$RUN_DIR"
exec "$MARIADB_BIN" --defaults-file="$CNF"
