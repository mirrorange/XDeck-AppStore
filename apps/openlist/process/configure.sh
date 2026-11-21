#!/usr/bin/env bash
# Set the administrator's password and the listen address in data/config.json.
. "$(dirname "$0")/lib.sh"
. "$(dirname "$0")/openlist.sh"

password="${ADMIN_PASSWORD:?an administrator password is required}"
mkdir -p "$DATA_DIR"
chmod 700 "$DATA_DIR"
errors="$(mktemp)"
trap 'rm -f "$errors"' EXIT

# The first run creates config.json, the database and the administrator. The
# command prints the password: keep it out of the log.
if ! OPENLIST_ADMIN_PASSWORD="$password" "$BIN" admin set "$password" --data "$DATA_DIR" >/dev/null 2>"$errors" ||
  ! "$BIN" admin --data "$DATA_DIR" 2>>"$errors" | grep -q "username: admin"; then
  cat "$errors" >&2
  die "could not set the administrator's password"
fi
log "Set the administrator's password"

# Only the listen address and port; other changes to config.json stay.
port="${PORT:-5244}" bind="${BIND:-0.0.0.0}"
sed -e "s/\"http_port\": *-\{0,1\}[0-9]*/\"http_port\": $port/" \
  -e "s/\"address\": *\"[^\"]*\"/\"address\": \"$bind\"/" "$CONF" | write_file "$CONF"
grep -q "\"http_port\": $port" "$CONF" || die "could not set the port in data/config.json"
log "Listening on $bind:$port"
