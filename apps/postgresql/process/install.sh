#!/usr/bin/env bash
# Install PostgreSQL from the system package manager and initialize the
# cluster in data/ with the configured superuser, password and database.
. "$(dirname "$0")/lib.sh"
. "$(dirname "$0")/postgres.sh"

# Directory with initdb, pg_ctl and postgres, preferring the newest version.
locate() {
  local dir candidates
  candidates="$(
    if have pg_ctl; then dirname "$(command -v pg_ctl)"; fi
    ls -d /usr/lib/postgresql/*/bin /usr/pgsql-*/bin /usr/libexec/postgresql* 2>/dev/null | sort -r || true
    echo /opt/homebrew/opt/postgresql@17/bin /usr/local/opt/postgresql@17/bin /usr/bin
  )"
  for dir in $candidates; do
    if [ -x "$dir/initdb" ] && [ -x "$dir/pg_ctl" ] && [ -x "$dir/postgres" ]; then
      echo "$dir"
      return
    fi
  done
  return 1
}

if ! bin="$(locate)"; then
  case "$(pkg_manager)" in
    brew) pkg_install postgresql@17 ;;
    apt-get)
      # Debian packages create and start a "main" cluster on 5432 unless told not to.
      if [ ! -e /etc/postgresql-common/createcluster.conf ]; then
        as_root mkdir -p /etc/postgresql-common
        echo "create_main_cluster = false" | as_root tee /etc/postgresql-common/createcluster.conf >/dev/null
      fi
      pkg_install postgresql
      ;;
    *)
      found=""
      for pkg in postgresql17-server postgresql17 postgresql16-server postgresql-server postgresql; do
        if pkg_available "$pkg"; then
          pkg_install "$pkg"
          found=1
          break
        fi
      done
      [ -n "$found" ] || die "no PostgreSQL package found; install the PostgreSQL server and try again"
      ;;
  esac
  bin="$(locate)" || die "PostgreSQL binaries not found after installing them"
  disable_service postgresql
fi
log "Using $("$bin/postgres" --version)"
state_set PG_BIN "$bin"

PG_RUN_AS=""
if is_root; then
  PG_RUN_AS=postgres
  if ! id postgres >/dev/null 2>&1; then
    log "Creating the postgres system user"
    useradd --system --no-create-home --shell /bin/false postgres 2>/dev/null ||
      adduser -S -H -s /bin/false postgres
  fi
  grant_traverse postgres "$APP_DIR"
fi
state_set PG_RUN_AS "$PG_RUN_AS"

mkdir -p "$DATA_DIR" "$RUN_DIR"
chmod 700 "$DATA_DIR"
own "$DATA_DIR" "$RUN_DIR"

if [ -f "$DATA_DIR/PG_VERSION" ]; then
  log "Keeping the existing cluster in data/ (PostgreSQL $(cat "$DATA_DIR/PG_VERSION"))"
  exit 0
fi

log "Initializing the cluster"
pwfile="$RUN_DIR/initdb.pw"
(umask 077 && printf '%s\n' "${POSTGRES_PASSWORD:?a password is required}" >"$pwfile")
own "$pwfile"
trap 'rm -f "$pwfile"' EXIT
as_pg "$bin/initdb" -D "$DATA_DIR" -U "${POSTGRES_USER:-postgres}" --pwfile="$pwfile" \
  -A scram-sha-256 -E UTF8 --no-locale
rm -f "$pwfile"

db="${POSTGRES_DB:-postgres}"
if [ "$db" != postgres ]; then
  log "Creating database $db"
  as_pg "$bin/pg_ctl" -D "$DATA_DIR" -w -t 60 -l "$RUN_DIR/setup.log" \
    -o "-c listen_addresses='' -c unix_socket_directories='$RUN_DIR' -c port=${PORT:-5432}" start
  trap 'as_pg "$bin/pg_ctl" -D "$DATA_DIR" -m fast -w stop >/dev/null 2>&1 || true' EXIT
  createdb="$bin/createdb"
  [ -x "$createdb" ] || createdb="$(command -v createdb)"
  PGPASSWORD="$POSTGRES_PASSWORD" as_pg "$createdb" -h "$RUN_DIR" -p "${PORT:-5432}" \
    -U "${POSTGRES_USER:-postgres}" "$db"
  as_pg "$bin/pg_ctl" -D "$DATA_DIR" -m fast -w stop
  trap - EXIT
fi
