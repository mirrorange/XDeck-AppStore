#!/usr/bin/env bash
# Keep the remote control's port and password where only the app reads them.
. "$(dirname "$0")/lib.sh"
. "$(dirname "$0")/rclone.sh"

umask 077
{
  printf 'RC_PORT=%q\n' "${RC_PORT:-5572}"
  printf 'RC_PASSWORD=%q\n' "${RC_PASSWORD:?a password is required}"
} | write_file "$RC_FILE"
log "Wrote the remote control settings"
