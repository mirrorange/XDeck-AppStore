#!/usr/bin/env bash
# Download the official rclone build into the app directory.
. "$(dirname "$0")/lib.sh"
. "$(dirname "$0")/rclone.sh"
install_rclone
log "Using $("$BIN" version | head -n 1)"
mkdir -p "$CONF_DIR" "$CACHE_DIR"
chmod 700 "$CONF_DIR"
# Remotes are created through the remote control; start from an empty configuration.
if [ ! -e "$CONF" ]; then (umask 077 && : >"$CONF"); fi
