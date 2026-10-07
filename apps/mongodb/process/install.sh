#!/usr/bin/env bash
# Download the official MongoDB build and mongosh into the app directory and
# create the root user in data/.
. "$(dirname "$0")/lib.sh"
. "$(dirname "$0")/mongodb.sh"

file="" url="" shell_file=""
case "$(os_id)-$(arch)" in
  linux-*)
    target="$(linux_target)"
    [ -n "$target" ] ||
      die "there is no official MongoDB build for $(os_release PRETTY_NAME); use the Docker deployment"
    file="mongodb-linux-$(arch)-$target-$MONGO_VERSION.tgz"
    url="https://fastdl.mongodb.org/linux/$file"
    shell_file="mongosh-$MONGOSH_VERSION-linux-$([ "$(arch)" = x86_64 ] && echo x64 || echo arm64).tgz"
    ;;
  macos-*)
    file="mongodb-macos-$(arch | sed 's/aarch64/arm64/')-$MONGO_VERSION.tgz"
    url="https://fastdl.mongodb.org/osx/$file"
    shell_file="mongosh-$MONGOSH_VERSION-darwin-$([ "$(arch)" = x86_64 ] && echo x64 || echo arm64).zip"
    ;;
esac
sha="$(pinned_sha256 "$file")"
[ -n "$sha" ] || die "no official MongoDB build for this system ($file); use the Docker deployment"

state_try_load
if [ ! -x "$DIST_DIR/bin/mongod" ] || [ "${MONGO_INSTALLED:-}" != "$MONGO_VERSION" ]; then
  download "$url" "$APP_DIR/downloads/$file"
  verify_sha256 "$APP_DIR/downloads/$file" "$sha"
  log "Extracting $file"
  extract "$APP_DIR/downloads/$file" "$DIST_DIR"
  state_set MONGO_INSTALLED "$MONGO_VERSION"
fi
if [ ! -x "$SHELL_DIR/bin/mongosh" ] || [ "${MONGOSH_INSTALLED:-}" != "$MONGOSH_VERSION" ]; then
  download "https://downloads.mongodb.com/compass/$shell_file" "$APP_DIR/downloads/$shell_file"
  verify_sha256 "$APP_DIR/downloads/$shell_file" "$(pinned_sha256 "$shell_file")"
  extract "$APP_DIR/downloads/$shell_file" "$SHELL_DIR"
  state_set MONGOSH_INSTALLED "$MONGOSH_VERSION"
fi
rm -rf "$APP_DIR/downloads"

if [ "$(os_id)" = linux ]; then
  for lib in $(missing_libs "$DIST_DIR/bin/mongod"); do
    case "$lib" in
      libcurl.so.4) pkgs="libcurl4 libcurl libcurl-minimal" ;;
      libcrypto.so.* | libssl.so.*) pkgs="libssl3 openssl-libs libopenssl3" ;;
      *) pkgs="" ;;
    esac
    for pkg in $pkgs; do
      if pkg_available "$pkg"; then
        pkg_install "$pkg"
        break
      fi
    done
  done
  left="$(missing_libs "$DIST_DIR/bin/mongod" | tr '\n' ' ')"
  [ -z "$left" ] || die "mongod cannot find: $left"
fi
log "Using $("$DIST_DIR/bin/mongod" --version | head -n1)"

write_conf
if [ -n "$(ls -A "$DATA_DIR" 2>/dev/null)" ]; then
  log "Keeping the existing data in data/"
  exit 0
fi

log "Creating the root user"
mkdir -p "$DATA_DIR"
# A temporary server on the loopback interface, without access control.
"$DIST_DIR/bin/mongod" --dbpath "$DATA_DIR" --bind_ip 127.0.0.1 --port "${PORT:-27017}" \
  --unixSocketPrefix "$RUN_DIR" --quiet >"$RUN_DIR/setup.log" 2>&1 &
server=$!
trap 'kill "$server" 2>/dev/null || true' EXIT
wait_for_port 127.0.0.1 "${PORT:-27017}" 60 || {
  cat "$RUN_DIR/setup.log" >&2
  die "the setup server did not start"
}
# The credentials stay in the environment, out of the command line.
MONGO_USERNAME="${MONGO_USERNAME:-root}" MONGO_PASSWORD="${MONGO_PASSWORD:?a password is required}" \
  "$SHELL_DIR/bin/mongosh" --quiet "mongodb://127.0.0.1:${PORT:-27017}/admin" --eval '
    db.createUser({
      user: process.env.MONGO_USERNAME,
      pwd: process.env.MONGO_PASSWORD,
      roles: [{ role: "root", db: "admin" }],
    });
    try { db.shutdownServer(); } catch (e) {}
  '
wait "$server" || true
trap - EXIT
rm -f "$RUN_DIR/setup.log"
log "Created user ${MONGO_USERNAME:-root}"
