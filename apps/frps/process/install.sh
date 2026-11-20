#!/usr/bin/env bash
# Download the official frp build into the app directory.
. "$(dirname "$0")/lib.sh"
. "$(dirname "$0")/frp.sh"
install_frp
log "Using frps $("$BIN" --version)"
mkdir -p "$APP_DIR/conf"
