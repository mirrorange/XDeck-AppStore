# frp helpers shared by this app's scripts (after lib.sh).

FRP_VERSION=0.72.0
FRP_DIR="$APP_DIR/frp"
BIN="$FRP_DIR/frpc"
CONF="$APP_DIR/conf/frpc.toml"

# Pinned SHA-256 of a download, from checksums.txt.
pinned_sha256() {
  awk -v f="$1" '$2 == f {print $1}' "$(dirname "${BASH_SOURCE[0]}")/checksums.txt"
}

# Download frp for this system unless this version is there already.
install_frp() {
  local os cpu file
  os="$(os_id | sed 's/macos/darwin/')"
  cpu="$(arch | sed 's/x86_64/amd64/; s/aarch64/arm64/')"
  file="frp_${FRP_VERSION}_${os}_${cpu}.tar.gz"
  state_try_load
  if [ -x "$BIN" ] && [ "${FRP_INSTALLED:-}" = "$FRP_VERSION" ]; then
    return 0
  fi
  local sha
  sha="$(pinned_sha256 "$file")"
  [ -n "$sha" ] || die "there is no frp build for this system ($file); use the Docker deployment"
  download "https://github.com/fatedier/frp/releases/download/v$FRP_VERSION/$file" "$APP_DIR/downloads/$file"
  verify_sha256 "$APP_DIR/downloads/$file" "$sha"
  log "Extracting $file"
  extract "$APP_DIR/downloads/$file" "$FRP_DIR"
  rm -rf "$APP_DIR/downloads"
  state_set FRP_INSTALLED "$FRP_VERSION"
}

# A TOML string.
toml_string() {
  local v="$1"
  v="${v//\\/\\\\}"
  v="${v//\"/\\\"}"
  printf '"%s"' "$v"
}
