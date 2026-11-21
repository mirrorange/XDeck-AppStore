#!/usr/bin/env bash
# The remote control only: XDeck creates remotes and mounts through it.
. "$(dirname "$0")/lib.sh"
. "$(dirname "$0")/rclone.sh"
# shellcheck disable=SC1090
. "$RC_FILE"
# The password goes through the environment, not the command line.
export RCLONE_RC_USER=xdeck RCLONE_RC_PASS="$RC_PASSWORD"
exec "$BIN" rcd --rc-addr "127.0.0.1:$RC_PORT" --config "$CONF" --cache-dir "$CACHE_DIR"
