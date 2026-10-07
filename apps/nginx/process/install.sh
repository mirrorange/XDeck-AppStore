#!/usr/bin/env bash
# Use nginx from the system package manager (Homebrew on macOS).
. "$(dirname "$0")/lib.sh"

if ! bin="$(find_bin nginx)"; then
  pkg_install nginx
  bin="$(find_bin nginx)" || die "nginx not found after installing it"
  # Packages may start a system-wide nginx; this app runs its own.
  disable_service nginx
fi

log "Using $("$bin" -v 2>&1)"
state_set NGINX_BIN "$bin"
# `-e` (1.19.5+) keeps nginx from opening its compiled-in error log.
if "$bin" -h 2>&1 | grep -q -- '-e filename'; then
  state_set NGINX_ERROR_LOG_FLAG 1
else
  state_set NGINX_ERROR_LOG_FLAG 0
fi
mkdir -p "$APP_DIR/conf/sites" "$APP_DIR/html" "$APP_DIR/temp" "$APP_DIR/run"
