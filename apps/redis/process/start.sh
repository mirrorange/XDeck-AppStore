#!/usr/bin/env bash
. "$(dirname "$0")/lib.sh"
state_load
exec "$REDIS_BIN" "$APP_DIR/conf/redis.conf"
