#!/usr/bin/env bash
# Install Redis (or Valkey) from the system package manager.
. "$(dirname "$0")/lib.sh"

locate() {
  find_bin redis-server || find_bin redis6-server || find_bin valkey-server
}

if ! bin="$(locate)"; then
  installed=""
  for pkg in redis redis-server redis7 redis6 valkey; do
    if [ "$(pkg_manager)" = apt-get ] && [ "$pkg" = redis ]; then continue; fi
    if pkg_available "$pkg"; then
      pkg_install "$pkg"
      installed="$pkg"
      break
    fi
  done
  [ -n "$installed" ] || die "no Redis package found; install redis-server and try again"
  bin="$(locate)" || die "redis-server not found after installing $installed"
  # Packages may start a system-wide server on 6379; this app runs its own.
  disable_service redis-server redis redis6 valkey
fi

log "Using $("$bin" --version)"
state_set REDIS_BIN "$bin"
mkdir -p "$APP_DIR/data" "$APP_DIR/conf"
