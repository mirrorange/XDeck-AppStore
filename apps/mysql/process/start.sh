#!/usr/bin/env bash
. "$(dirname "$0")/lib.sh"
. "$(dirname "$0")/mysql.sh"
state_load
use_libs
mkdir -p "$RUN_DIR"
exec "$DIST_DIR/bin/mysqld" --defaults-file="$CNF"
