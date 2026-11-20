#!/usr/bin/env bash
. "$(dirname "$0")/lib.sh"
. "$(dirname "$0")/cloudflared.sh"
# shellcheck disable=SC1091
. "$CONF_DIR/options"
exec "$BIN" --no-autoupdate tunnel --protocol "$PROTOCOL" --metrics "127.0.0.1:$METRICS_PORT" \
  run --token-file "$CONF_DIR/token"
