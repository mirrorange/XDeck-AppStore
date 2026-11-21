#!/usr/bin/env bash
. "$(dirname "$0")/lib.sh"
. "$(dirname "$0")/openlist.sh"
exec "$BIN" server --data "$DATA_DIR" --log-std
