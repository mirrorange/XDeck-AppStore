# Authoring apps

An app is a directory `apps/<id>/` with an `app.yaml`. The format is version 1 of the XDeck
App Store repository format (specified in XDeck's `docs/appstore.md`); `app/lib/manifest.ts`
mirrors the daemon's checks and `pnpm build` applies them.

## Manifest

```yaml
id: redis # = directory name; lowercase letters, digits, -
name: Redis
version: "8.2"
summary: { en: ..., zh: ... } # one line, shown on cards
description: { en: ..., zh: ... }
icon: icon.svg # svg, png or webp, at most 1 MiB
categories: [database, cache]
homepage: https://redis.io
license: ...

settings: # shown as a form in XDeck
  - key: PORT # A-Z, 0-9, _; not XDECK_*
    type: port # string | password | number | port | boolean | select
    default: 6379
    label: { en: Port, zh: 端口 }
    description: { en: ..., zh: ... }
    # required: true            # must not be empty
    # generate: true            # random 24-character secret when left empty
    # install_only: true        # read-only after installation
    # methods: [docker]         # only for some deployment methods
    # options: [...]            # select: { value, label }

docker:
  compose: docker/compose.yaml
  files: # placed in the project directory once, then kept
    - { source: docker/default.conf, target: conf.d/default.conf }

process:
  platforms: [linux, macos] # default: every platform with scripts
  unix: # bash, Linux and macOS
    install: process/install.sh
    configure: process/configure.sh
    start: process/start.sh
    uninstall: process/uninstall.sh
    lib: [process/lib.sh] # copied with the scripts, never run directly
  windows: # PowerShell 5.1+
    install: process/install.ps1
    start: process/start.ps1
    lib: [process/lib.ps1]
  files: # placed in the app directory once, then kept
    - { source: process/mime.types, target: conf/mime.types }
  health_check: { type: tcp, host: "${BIND}", port: "${PORT}" }
```

Every app of this repository provides English and Chinese text, an icon and a label for
each setting and option (`test/apps.test.ts`).

## Docker deployment

XDeck creates a Compose project named after the installation, writes the settings to its
`.env` and runs `docker compose up -d`. Changing settings rewrites `.env` and deploys again.

- Interpolate settings with defaults: `${PORT:-6379}`; `${KEY:?message}` for required ones.
  The tests reject variables that are not settings (escape shell variables as `$$VAR`).
- Bind-mount data below the project directory (`./data:/...`), never named volumes, so data
  stays under XDeck's data directory and "delete data" removes it.
- Pin a major (or minor) image tag.

## Process deployment

Scripts run with the app directory (`<data_dir>/apps/<name>/`) as working directory and:

| Variable                         | Value                                               |
| -------------------------------- | --------------------------------------------------- |
| `XDECK_ACTION`                   | `install`, `configure` or `uninstall`               |
| `XDECK_APP_DIR`                  | the app directory: binaries, configuration, data    |
| `XDECK_APP_NAME`, `XDECK_APP_ID` | installation name and app id                        |
| `XDECK_SCRIPTS_DIR`              | where the scripts were copied                       |
| `XDECK_HOME`                     | XDeck's data directory                              |
| `XDECK_PLATFORM`, `XDECK_ARCH`   | `linux` / `macos` / `windows`, `x86_64` / `aarch64` |
| `XDECK_DELETE_DATA`              | uninstall only: `1` when the user deletes data      |
| settings                         | install, configure, uninstall (not start)           |

- **install** fetches the software and initializes data. It runs again on reinstall over
  existing data, so keep it idempotent and never overwrite data.
- **configure** turns settings into configuration files. It runs after install and on every
  change of settings, with the process stopped.
- **start** runs the server in the foreground with `exec` (the supervisor's stop signal must
  reach it) and logs to stdout/stderr. It sees no settings, so secrets stay out of the
  process environment: read what configure wrote.
- **uninstall** runs after the process is removed; delete data only when
  `XDECK_DELETE_DATA=1`. Leave system packages installed.

Script output is shown live in XDeck and kept in the operation log. Helpers in
`shared/lib.sh` (`log`, `die`, `as_root`, `pkg_install`, `download`, `verify_sha256`,
`extract`, `state_set`/`state_load`, `disable_service`, ...) and `shared/lib.ps1` cover the
common steps; edit them in `shared/` and run `pnpm sync-shared`.

Pin a SHA-256 for every download. Write scripts for bash 3.2 (macOS) and PowerShell 5.1.
