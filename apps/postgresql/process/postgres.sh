# PostgreSQL helpers shared by this app's scripts (after lib.sh).

DATA_DIR="$APP_DIR/data"
RUN_DIR="$APP_DIR/run"

# Run a command as the server's user (postgres refuses to run as root).
as_pg() {
  if [ -z "${PG_RUN_AS:-}" ]; then
    "$@"
  elif have setpriv; then
    setpriv --reuid="$PG_RUN_AS" --regid="$(id -g "$PG_RUN_AS")" --init-groups -- "$@"
  else
    runuser -u "$PG_RUN_AS" -- "$@"
  fi
}

# Give the server's user the directories it writes to.
own() {
  [ -z "${PG_RUN_AS:-}" ] || chown -R "$PG_RUN_AS:$(id -g "$PG_RUN_AS")" "$@"
}

# Let a user reach a directory: add search permission on ancestors that lack it.
grant_traverse() {
  local user="$1" dir="$2"
  while [ "$dir" != / ] && [ -n "$dir" ]; do
    if ! PG_RUN_AS="$user" as_pg test -x "$dir" 2>/dev/null; then
      log "Allowing $user to traverse $dir"
      chmod o+x "$dir"
    fi
    dir="$(dirname "$dir")"
  done
}
