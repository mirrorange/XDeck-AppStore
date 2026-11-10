#!/usr/bin/env bash
# Install MariaDB from the system package manager and initialize data/ with
# the configured root password, database and user.
. "$(dirname "$0")/lib.sh"
. "$(dirname "$0")/mariadb.sh"

if ! bin="$(locate_server)"; then
  case "$(pkg_manager)" in
    brew) pkg_install mariadb ;;
    apt-get) pkg_install mariadb-server ;;
    *)
      found=""
      for pkg in mariadb-server mariadb; do
        if pkg_available "$pkg"; then
          pkg_install "$pkg"
          found=1
          break
        fi
      done
      [ -n "$found" ] || die "no MariaDB package found; install the MariaDB server and try again"
      ;;
  esac
  bin="$(locate_server)" || die "the MariaDB server was not found after installing it"
  # Packages may start a system-wide server on 3306; this app runs its own.
  disable_service mariadb mysql mysqld
fi
install_db="$(find_bin mariadb-install-db /usr/bin "$(dirname "$bin")" || find_bin mysql_install_db /usr/bin "$(dirname "$bin")")" ||
  die "mariadb-install-db not found"
client="$(find_bin mariadb /usr/bin "$(dirname "$bin")" || find_bin mysql /usr/bin "$(dirname "$bin")")" ||
  die "the mariadb client was not found"
log "Using $("$bin" --version)"
state_set MARIADB_BIN "$bin"

write_cnf
if [ -d "$DATA_DIR/mysql" ]; then
  log "Keeping the existing data in data/"
  exit 0
fi

log "Initializing data/"
"$install_db" --defaults-file="$CNF" --basedir="$(dirname "$(dirname "$bin")")" \
  --auth-root-authentication-method=normal --skip-test-db >/dev/null

# A temporary server without networking applies the settings.
socket="$RUN_DIR/setup.sock"
"$bin" --defaults-file="$CNF" --skip-networking --socket="$socket" \
  --pid-file="$RUN_DIR/setup.pid" &
server=$!
trap 'kill "$server" 2>/dev/null || true' EXIT
for _ in $(seq 1 60); do
  [ -S "$socket" ] && break
  kill -0 "$server" 2>/dev/null || die "the setup server exited"
  sleep 1
done
[ -S "$socket" ] || die "the setup server did not start"

root_pw="$(sql_string "${MARIADB_ROOT_PASSWORD:?a root password is required}")"
{
  # Anonymous accounts would take precedence over user@% on this machine.
  echo "DELETE FROM mysql.global_priv WHERE User = '';"
  echo "FLUSH PRIVILEGES;"
  echo "ALTER USER 'root'@'localhost' IDENTIFIED BY $root_pw;"
  echo "CREATE USER IF NOT EXISTS 'root'@'%' IDENTIFIED BY $root_pw;"
  echo "GRANT ALL ON *.* TO 'root'@'%' WITH GRANT OPTION;"
  if [ -n "${MARIADB_DATABASE:-}" ]; then
    echo "CREATE DATABASE IF NOT EXISTS $(sql_ident "$MARIADB_DATABASE");"
  fi
  if [ -n "${MARIADB_USER:-}" ]; then
    [ "$MARIADB_USER" != root ] || die "MARIADB_USER cannot be root"
    echo "CREATE USER $(sql_string "$MARIADB_USER")@'%' IDENTIFIED BY $(sql_string "${MARIADB_PASSWORD:-}");"
    if [ -n "${MARIADB_DATABASE:-}" ]; then
      echo "GRANT ALL ON $(sql_ident "$MARIADB_DATABASE").* TO $(sql_string "$MARIADB_USER")@'%';"
    fi
  fi
  echo "SHUTDOWN;"
} | "$client" --no-defaults --socket="$socket" -uroot

wait "$server" || true
trap - EXIT
log "Initialized data/"
