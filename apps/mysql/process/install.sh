#!/usr/bin/env bash
# Download the official MySQL build into mysql/ and initialize data/ with
# the configured root password, database and user.
. "$(dirname "$0")/lib.sh"
. "$(dirname "$0")/mysql.sh"

base="https://dev.mysql.com/get/Downloads/MySQL-8.4"
case "$(os_id)-$(arch)" in
  linux-x86_64)
    file="mysql-$MYSQL_VERSION-linux-glibc2.28-x86_64-minimal.tar.xz"
    sha=383f54e124d5f325d67f0c6912a8f96814eedc761a17ea30112e52fa4cc6b143
    ;;
  linux-aarch64)
    file="mysql-$MYSQL_VERSION-linux-glibc2.28-aarch64.tar.xz"
    sha=04b2f9791d314167a9eb83abcb476f45a7cd9e4aa88fa7a638cba40d1bc2a109
    ;;
  macos-aarch64)
    file="mysql-$MYSQL_VERSION-macos15-arm64.tar.gz"
    sha=b96e00493bc3499b9ffd7f08d65c5d64933af0383a8287d9873b64f94c2d6009
    ;;
  macos-x86_64)
    file="mysql-$MYSQL_VERSION-macos15-x86_64.tar.gz"
    sha=90e8aea10698d01b978f0179e72e8d5e2cbe9f9bd5771e88b0b75d7c82244d3f
    ;;
esac

if [ "$(os_id)" = linux ]; then
  glibc="$(getconf GNU_LIBC_VERSION 2>/dev/null | awk '{print $2}')"
  [ -n "$glibc" ] || die "the official MySQL build needs glibc; use the Docker deployment on this system"
  if [ "$(printf '%s\n2.28\n' "$glibc" | sort -t. -k1,1n -k2,2n | head -n1)" != 2.28 ]; then
    die "the official MySQL build needs glibc 2.28 or newer (found $glibc)"
  fi
fi

state_try_load
if [ ! -x "$DIST_DIR/bin/mysqld" ] || [ "${MYSQL_INSTALLED:-}" != "$MYSQL_VERSION" ]; then
  archive="$APP_DIR/downloads/$file"
  download "$base/$file" "$archive"
  verify_sha256 "$archive" "$sha"
  log "Extracting $file"
  extract "$archive" "$DIST_DIR"
  rm -rf "$archive" "$APP_DIR/downloads" "$DIST_DIR/mysql-test" "$DIST_DIR/docs" "$DIST_DIR/man"
  state_set MYSQL_INSTALLED "$MYSQL_VERSION"
fi

# Shared libraries the build expects (libaio, libnuma, ncurses) on Linux.
if [ "$(os_id)" = linux ]; then
  for lib in $(missing_libs "$DIST_DIR/bin/mysqld") $(missing_libs "$DIST_DIR/bin/mysql"); do
    case "$lib" in
      libaio.so.1) pkgs="libaio1t64 libaio1 libaio" ;;
      libnuma.so.1) pkgs="libnuma1 numactl-libs numactl" ;;
      libtinfo.so.*|libncurses.so.*) pkgs="libtinfo6 ncurses-libs ncurses-compat-libs ncurses" ;;
      *) pkgs="" ;;
    esac
    for pkg in $pkgs; do
      if pkg_available "$pkg"; then
        pkg_install "$pkg"
        break
      fi
    done
  done
  # Ubuntu 24.04 renamed libaio.so.1 to libaio.so.1t64.
  if missing_libs "$DIST_DIR/bin/mysqld" | grep -q '^libaio.so.1$'; then
    t64="$(ls /usr/lib/*/libaio.so.1t64 /usr/lib/libaio.so.1t64 2>/dev/null | head -n1 || true)"
    if [ -n "$t64" ]; then
      mkdir -p "$APP_DIR/lib"
      ln -sf "$t64" "$APP_DIR/lib/libaio.so.1"
      state_set MYSQL_LIB_DIR "$APP_DIR/lib"
    fi
  fi
  state_try_load
  use_libs
  left="$(missing_libs "$DIST_DIR/bin/mysqld" | tr '\n' ' ')"
  [ -z "$left" ] || die "mysqld cannot find: $left"
fi
log "Using $("$DIST_DIR/bin/mysqld" --version)"

write_cnf
if [ -d "$DATA_DIR/mysql" ]; then
  log "Keeping the existing data in data/"
  exit 0
fi

log "Initializing data/"
rm -rf "$DATA_DIR"
"$DIST_DIR/bin/mysqld" --defaults-file="$CNF" --initialize-insecure

# A temporary server without networking applies the settings.
socket="$RUN_DIR/setup.sock"
"$DIST_DIR/bin/mysqld" --defaults-file="$CNF" --skip-networking --socket="$socket" \
  --pid-file="$RUN_DIR/setup.pid" &
server=$!
trap 'kill "$server" 2>/dev/null || true' EXIT
for _ in $(seq 1 60); do
  [ -S "$socket" ] && break
  kill -0 "$server" 2>/dev/null || die "the setup server exited"
  sleep 1
done
[ -S "$socket" ] || die "the setup server did not start"

root_pw="$(sql_string "${MYSQL_ROOT_PASSWORD:?a root password is required}")"
{
  echo "ALTER USER 'root'@'localhost' IDENTIFIED BY $root_pw;"
  echo "CREATE USER 'root'@'%' IDENTIFIED BY $root_pw;"
  echo "GRANT ALL ON *.* TO 'root'@'%' WITH GRANT OPTION;"
  if [ -n "${MYSQL_DATABASE:-}" ]; then
    echo "CREATE DATABASE IF NOT EXISTS $(sql_ident "$MYSQL_DATABASE");"
  fi
  if [ -n "${MYSQL_USER:-}" ]; then
    [ "$MYSQL_USER" != root ] || die "MYSQL_USER cannot be root"
    echo "CREATE USER $(sql_string "$MYSQL_USER")@'%' IDENTIFIED BY $(sql_string "${MYSQL_PASSWORD:-}");"
    if [ -n "${MYSQL_DATABASE:-}" ]; then
      echo "GRANT ALL ON $(sql_ident "$MYSQL_DATABASE").* TO $(sql_string "$MYSQL_USER")@'%';"
    fi
  fi
  echo "SHUTDOWN;"
} | "$DIST_DIR/bin/mysql" --no-defaults --socket="$socket" -uroot

wait "$server" || true
trap - EXIT
log "Initialized data/"
