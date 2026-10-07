#!/usr/bin/env bash
. "$(dirname "$0")/lib.sh"
state_load
flags=(-p "$APP_DIR/" -c conf/nginx.conf)
[ "$NGINX_ERROR_LOG_FLAG" = 1 ] && flags+=(-e stderr)
exec "$NGINX_BIN" "${flags[@]}" -g 'daemon off;'
