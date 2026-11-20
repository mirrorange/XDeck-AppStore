#!/usr/bin/env bash
# Keep the token in a file only the app reads, and the options next to it.
. "$(dirname "$0")/lib.sh"
. "$(dirname "$0")/cloudflared.sh"

mkdir -p "$CONF_DIR"
umask 077
printf '%s' "${TUNNEL_TOKEN:?a tunnel token is required}" | write_file "$CONF_DIR/token"
{
  printf 'PROTOCOL=%q\n' "${PROTOCOL:-auto}"
  printf 'METRICS_PORT=%q\n' "${METRICS_PORT:-20241}"
} | write_file "$CONF_DIR/options"
log "Wrote the tunnel token and options"
