#!/usr/bin/env bash
# Write conf/my.cnf from the app's settings.
. "$(dirname "$0")/lib.sh"
. "$(dirname "$0")/mariadb.sh"
write_cnf
log "Wrote conf/my.cnf"
