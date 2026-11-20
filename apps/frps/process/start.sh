#!/usr/bin/env bash
. "$(dirname "$0")/lib.sh"
. "$(dirname "$0")/frp.sh"
exec "$BIN" -c "$CONF"
