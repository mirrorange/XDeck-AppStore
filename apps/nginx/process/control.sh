#!/usr/bin/env bash
# Actions XDeck runs to manage websites (XDECK_ACTION): test the
# configuration, reload it, print the version.
. "$(dirname "$0")/lib.sh"
state_load
flags=(-p "$APP_DIR/" -c nginx.conf)
[ "$NGINX_ERROR_LOG_FLAG" = 1 ] && flags+=(-e stderr)
case "${XDECK_ACTION:-}" in
  test) exec "$NGINX_BIN" "${flags[@]}" -t ;;
  reload) exec "$NGINX_BIN" "${flags[@]}" -s reload ;;
  version) exec "$NGINX_BIN" -v ;;
  *) die "unknown action: ${XDECK_ACTION:-}" ;;
esac
