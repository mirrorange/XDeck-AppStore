# Shared helpers for App Store process scripts (bash 3.2+, Linux and macOS).
#
# Synced into apps/*/process/lib.sh by `pnpm sync-shared`; edit this copy.
# XDeck runs every script with the app directory as working directory and
# XDECK_APP_DIR, XDECK_ACTION, XDECK_PLATFORM, XDECK_ARCH, ... in the
# environment, plus the app's settings for install/configure/uninstall.

set -euo pipefail

APP_DIR="${XDECK_APP_DIR:?XDECK_APP_DIR is not set}"
STATE_FILE="$APP_DIR/.state"

log() { printf '==> %s\n' "$*"; }
warn() { printf 'warning: %s\n' "$*" >&2; }
die() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

have() { command -v "$1" >/dev/null 2>&1; }

is_root() { [ "$(id -u)" -eq 0 ]; }

# Run a command as root: directly, or through passwordless sudo.
as_root() {
  if is_root; then
    "$@"
  elif have sudo && sudo -n true 2>/dev/null; then
    sudo -n "$@"
  else
    die "root privileges are needed to run: $*"
  fi
}

# ---- state ------------------------------------------------------------------
# Values found at install time (binary paths, ...) for later scripts. Stored
# as shell assignments in $APP_DIR/.state.

state_set() {
  local key="$1" value="$2" tmp
  tmp="$STATE_FILE.tmp"
  { [ -f "$STATE_FILE" ] && grep -v "^$key=" "$STATE_FILE" || true; } >"$tmp"
  printf '%s=%q\n' "$key" "$value" >>"$tmp"
  mv "$tmp" "$STATE_FILE"
}

state_load() {
  [ -f "$STATE_FILE" ] || die "$STATE_FILE is missing; reinstall the app"
  # shellcheck disable=SC1090
  . "$STATE_FILE"
}

# Load the state when there is one (first install: nothing yet).
state_try_load() {
  # shellcheck disable=SC1090
  if [ -f "$STATE_FILE" ]; then . "$STATE_FILE"; fi
}

# ---- files ------------------------------------------------------------------

# Write stdin to a file atomically.
write_file() {
  local target="$1" tmp
  mkdir -p "$(dirname "$target")"
  tmp="$target.tmp.$$"
  cat >"$tmp"
  mv "$tmp" "$target"
}

# Download a URL to a file, retrying transient failures.
download() {
  local url="$1" dest="$2"
  log "Downloading $url"
  mkdir -p "$(dirname "$dest")"
  if have curl; then
    curl -fL --retry 3 --retry-delay 2 --connect-timeout 20 -sS -o "$dest.part" "$url"
  elif have wget; then
    wget -q -t 3 -O "$dest.part" "$url"
  else
    die "curl or wget is required"
  fi
  mv "$dest.part" "$dest"
}

sha256_of() {
  if have sha256sum; then
    sha256sum "$1" | awk '{print $1}'
  else
    shasum -a 256 "$1" | awk '{print $1}'
  fi
}

# Fail unless the file has the expected SHA-256.
verify_sha256() {
  local file="$1" expected="$2" actual
  actual="$(sha256_of "$file")"
  [ "$actual" = "$expected" ] || die "$(basename "$file"): SHA-256 mismatch (got $actual)"
}

# Extract an archive into a directory, dropping its top-level folder.
extract() {
  local archive="$1" dest="$2" tmp
  tmp="$dest.extract.$$"
  rm -rf "$tmp"
  mkdir -p "$tmp"
  case "$archive" in
    *.tar.gz | *.tgz) tar -xzf "$archive" -C "$tmp" ;;
    *.tar.xz) tar -xJf "$archive" -C "$tmp" ;;
    *.zip) unzip -q "$archive" -d "$tmp" ;;
    *) die "unknown archive type: $archive" ;;
  esac
  set -- "$tmp"/*
  rm -rf "$dest"
  if [ "$#" -eq 1 ] && [ -d "$1" ]; then
    mv "$1" "$dest"
    rmdir "$tmp"
  else
    mv "$tmp" "$dest"
  fi
}

# ---- packages ---------------------------------------------------------------

pkg_manager() {
  local m
  for m in brew apt-get dnf yum apk pacman zypper; do
    if have "$m"; then
      echo "$m"
      return
    fi
  done
  echo none
}

# Install packages with the system package manager (Homebrew on macOS).
pkg_install() {
  local manager
  manager="$(pkg_manager)"
  log "Installing $* with $manager"
  case "$manager" in
    brew) brew install "$@" ;;
    apt-get)
      as_root env DEBIAN_FRONTEND=noninteractive apt-get update -q
      as_root env DEBIAN_FRONTEND=noninteractive apt-get install -y -q --no-install-recommends "$@"
      ;;
    dnf) as_root dnf install -y -q "$@" ;;
    yum) as_root yum install -y -q "$@" ;;
    apk) as_root apk add --no-cache "$@" ;;
    pacman) as_root pacman -S --noconfirm --needed "$@" ;;
    zypper) as_root zypper --non-interactive install "$@" ;;
    *) die "no supported package manager found; install $* manually" ;;
  esac
}

# Is a package available from the system package manager?
pkg_available() {
  case "$(pkg_manager)" in
    brew) brew info "$1" >/dev/null 2>&1 ;;
    apt-get) apt-cache show "$1" >/dev/null 2>&1 ;;
    dnf) dnf -q info "$1" >/dev/null 2>&1 ;;
    yum) yum -q info "$1" >/dev/null 2>&1 ;;
    apk) apk info -e "$1" >/dev/null 2>&1 || apk search -x "$1" 2>/dev/null | grep -q . ;;
    pacman) pacman -Si "$1" >/dev/null 2>&1 ;;
    zypper) zypper -q info "$1" 2>/dev/null | grep -q "^Name" ;;
    *) return 1 ;;
  esac
}

# Find an executable on PATH or in well-known locations.
find_bin() {
  local name="$1" dir
  if have "$name"; then
    command -v "$name"
    return
  fi
  shift
  for dir in "$@" /usr/sbin /usr/local/sbin /usr/local/bin /opt/homebrew/bin /opt/homebrew/sbin; do
    if [ -x "$dir/$name" ]; then
      echo "$dir/$name"
      return
    fi
  done
  return 1
}

# Shared libraries a binary needs but cannot find (Linux).
missing_libs() {
  ldd "$1" 2>/dev/null | awk '/not found/ {print $1}' | sort -u
}

# Escape a value for a single-quoted SQL string.
sql_string() {
  local v="$1"
  v="${v//\\/\\\\}"
  v="${v//\'/\\\'}"
  printf "'%s'" "$v"
}

# ---- platform ---------------------------------------------------------------

os_id() {
  if [ "${XDECK_PLATFORM:-}" = "macos" ] || [ "$(uname -s)" = "Darwin" ]; then
    echo macos
  else
    echo linux
  fi
}

# x86_64 or aarch64.
arch() {
  case "${XDECK_ARCH:-$(uname -m)}" in
    x86_64 | amd64) echo x86_64 ;;
    aarch64 | arm64) echo aarch64 ;;
    *) die "unsupported CPU architecture: ${XDECK_ARCH:-$(uname -m)}" ;;
  esac
}

# Fields of /etc/os-release, e.g. `os_release ID`.
os_release() {
  [ -r /etc/os-release ] || return 0
  (
    # shellcheck disable=SC1091
    . /etc/os-release
    eval "printf '%s' \"\${$1:-}\""
  )
}

# ---- services ---------------------------------------------------------------

# Wait until a TCP port accepts connections (bash /dev/tcp).
wait_for_port() {
  local host="$1" port="$2" seconds="${3:-60}" i=0
  while [ "$i" -lt "$seconds" ]; do
    if (exec 3<>"/dev/tcp/$host/$port") 2>/dev/null; then
      return 0
    fi
    sleep 1
    i=$((i + 1))
  done
  return 1
}

# Address for local clients of a server bound to BIND.
client_host() {
  case "${1:-127.0.0.1}" in
    0.0.0.0 | "") echo 127.0.0.1 ;;
    ::) echo ::1 ;;
    *) echo "$1" ;;
  esac
}

# Stop and disable system services a package may have started (systemd).
disable_service() {
  have systemctl && [ -d /run/systemd/system ] || return 0
  local s
  for s in "$@"; do
    if systemctl list-unit-files "$s.service" 2>/dev/null | grep -q "^$s.service"; then
      log "Disabling the system $s service"
      as_root systemctl disable --now "$s.service" >/dev/null 2>&1 || true
    fi
  done
}

# Remove the app's data when the user asked for it on uninstall.
delete_data_requested() { [ "${XDECK_DELETE_DATA:-0}" = "1" ]; }
