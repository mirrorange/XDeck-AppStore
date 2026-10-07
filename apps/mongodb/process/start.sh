#!/usr/bin/env bash
. "$(dirname "$0")/lib.sh"
. "$(dirname "$0")/mongodb.sh"
mkdir -p "$RUN_DIR"
exec "$DIST_DIR/bin/mongod" --config "$CONF"
