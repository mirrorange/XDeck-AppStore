# rclone helpers shared by this app's scripts (after lib.sh).

RCLONE_VERSION=1.76.0
RCLONE_DIR="$APP_DIR/rclone"
BIN="$RCLONE_DIR/rclone"
CONF_DIR="$APP_DIR/conf"
CONF="$CONF_DIR/rclone.conf"
RC_FILE="$CONF_DIR/rc"
CACHE_DIR="$APP_DIR/cache"

# Pinned SHA-256 of a download, from checksums.txt.
pinned_sha256() {
  awk -v f="$1" '$2 == f {print $1}' "$(dirname "${BASH_SOURCE[0]}")/checksums.txt"
}

# Download rclone for this system unless this version is there already.
install_rclone() {
  local os cpu file sha
  os="$(os_id | sed 's/macos/osx/')"
  cpu="$(arch | sed 's/x86_64/amd64/; s/aarch64/arm64/')"
  file="rclone-v${RCLONE_VERSION}-${os}-${cpu}.zip"
  state_try_load
  if [ -x "$BIN" ] && [ "${RCLONE_INSTALLED:-}" = "$RCLONE_VERSION" ]; then
    return 0
  fi
  sha="$(pinned_sha256 "$file")"
  [ -n "$sha" ] || die "there is no rclone build for this system ($file); use the Docker deployment"
  have unzip || pkg_install unzip
  download "https://github.com/rclone/rclone/releases/download/v$RCLONE_VERSION/$file" "$APP_DIR/downloads/$file"
  verify_sha256 "$APP_DIR/downloads/$file" "$sha"
  log "Extracting $file"
  extract "$APP_DIR/downloads/$file" "$RCLONE_DIR"
  rm -rf "$APP_DIR/downloads"
  chmod 755 "$BIN"
  state_set RCLONE_INSTALLED "$RCLONE_VERSION"
}
