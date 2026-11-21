#!/usr/bin/env bash
# Download the official OpenList build into the app directory.
. "$(dirname "$0")/lib.sh"
. "$(dirname "$0")/openlist.sh"
install_openlist
log "Using OpenList $("$BIN" version | awk '/^Version:/ {print $2}')"
mkdir -p "$DATA_DIR"
