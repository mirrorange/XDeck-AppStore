#!/usr/bin/env bash
# Download the official cloudflared build into the app directory.
. "$(dirname "$0")/lib.sh"
. "$(dirname "$0")/cloudflared.sh"

set -- $(release_file)
file="${1:-}" sha="${2:-}"
[ -n "$file" ] || die "there is no cloudflared build for this system; use the Docker deployment"

state_try_load
if [ ! -x "$BIN" ] || [ "${CLOUDFLARED_INSTALLED:-}" != "$CLOUDFLARED_VERSION" ]; then
  downloads="$APP_DIR/downloads"
  download "https://github.com/cloudflare/cloudflared/releases/download/$CLOUDFLARED_VERSION/$file" "$downloads/$file"
  verify_sha256 "$downloads/$file" "$sha"
  mkdir -p "$APP_DIR/bin"
  case "$file" in
    *.tgz) tar -xzf "$downloads/$file" -C "$APP_DIR/bin" cloudflared ;;
    *) mv "$downloads/$file" "$BIN" ;;
  esac
  chmod 755 "$BIN"
  rm -rf "$downloads"
  state_set CLOUDFLARED_INSTALLED "$CLOUDFLARED_VERSION"
fi
log "Using $("$BIN" --version)"
mkdir -p "$CONF_DIR"
