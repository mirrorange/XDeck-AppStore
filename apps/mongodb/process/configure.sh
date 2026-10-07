#!/usr/bin/env bash
# Write conf/mongod.conf from the app's settings.
. "$(dirname "$0")/lib.sh"
. "$(dirname "$0")/mongodb.sh"
write_conf
log "Wrote conf/mongod.conf"
