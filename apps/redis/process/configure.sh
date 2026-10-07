#!/usr/bin/env bash
# Write conf/redis.conf from the app's settings.
. "$(dirname "$0")/lib.sh"

# Quote a value for redis.conf.
quote() {
  local v="$1"
  v="${v//\\/\\\\}"
  v="${v//\"/\\\"}"
  printf '"%s"' "$v"
}

bind="${BIND:-127.0.0.1}"

mkdir -p "$APP_DIR/data"
umask 077
{
  echo "port ${PORT:-6379}"
  echo "bind $bind"
  echo "protected-mode yes"
  echo "requirepass $(quote "${REDIS_PASSWORD:?a password is required}")"
  echo "dir $(quote "$APP_DIR/data")"
  echo "appendonly yes"
  echo "daemonize no"
  echo 'logfile ""'
  [ -n "${REDIS_MAXMEMORY:-}" ] && echo "maxmemory $REDIS_MAXMEMORY"
  # Settings of your own: conf/local.conf is kept across changes.
  [ -f "$APP_DIR/conf/local.conf" ] && echo "include $(quote "$APP_DIR/conf/local.conf")"
  true
} | write_file "$APP_DIR/conf/redis.conf"
log "Wrote conf/redis.conf"
