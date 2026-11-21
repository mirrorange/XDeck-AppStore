# OpenList helpers shared by this app's scripts (after lib.sh).

OPENLIST_VERSION=4.2.10
BIN="$APP_DIR/openlist/openlist"
DATA_DIR="$APP_DIR/data"
CONF="$DATA_DIR/config.json"

# Pinned SHA-256 of a download, from checksums.txt.
pinned_sha256() {
  awk -v f="$1" '$2 == f {print $1}' "$(dirname "${BASH_SOURCE[0]}")/checksums.txt"
}

# Download OpenList for this system unless this version is there already.
install_openlist() {
  local os cpu file sha
  os="$(os_id | sed 's/macos/darwin/')"
  cpu="$(arch | sed 's/x86_64/amd64/; s/aarch64/arm64/')"
  file="openlist-${os}-${cpu}.tar.gz"
  state_try_load
  if [ -x "$BIN" ] && [ "${OPENLIST_INSTALLED:-}" = "$OPENLIST_VERSION" ]; then
    return 0
  fi
  sha="$(pinned_sha256 "$file")"
  [ -n "$sha" ] || die "there is no OpenList build for this system ($file); use the Docker deployment"
  download "https://github.com/OpenListTeam/OpenList/releases/download/v$OPENLIST_VERSION/$file" "$APP_DIR/downloads/$file"
  verify_sha256 "$APP_DIR/downloads/$file" "$sha"
  log "Extracting $file"
  extract "$APP_DIR/downloads/$file" "$APP_DIR/openlist"
  rm -rf "$APP_DIR/downloads"
  chmod 755 "$BIN"
  state_set OPENLIST_INSTALLED "$OPENLIST_VERSION"
}
