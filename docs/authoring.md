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
    update: process/update.sh # optional; install runs again on updates without one
    uninstall: process/uninstall.sh
    control: process/control.sh # optional; actions integrations ask for
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

Updating an installed app replaces its Compose file with the new version's, adds new
settings to `.env` (existing values stay), places new extra files, pulls the images and
deploys again. Keep data mounts and their layout compatible across versions.

## Process deployment

Scripts run with the app directory (`<data_dir>/apps/<name>/`) as working directory and:

| Variable                         | Value                                               |
| -------------------------------- | --------------------------------------------------- |
| `XDECK_ACTION`                   | `install`, `configure`, `update` or `uninstall`     |
| `XDECK_APP_DIR`                  | the app directory: binaries, configuration, data    |
| `XDECK_APP_NAME`, `XDECK_APP_ID` | installation name and app id                        |
| `XDECK_SCRIPTS_DIR`              | where the scripts were copied                       |
| `XDECK_HOME`                     | XDeck's data directory                              |
| `XDECK_PLATFORM`, `XDECK_ARCH`   | `linux` / `macos` / `windows`, `x86_64` / `aarch64` |
| `XDECK_APP_VERSION`              | version of the manifest the scripts belong to       |
| `XDECK_PREVIOUS_VERSION`         | update only: the version that was installed         |
| `XDECK_DELETE_DATA`              | uninstall only: `1` when the user deletes data      |
| settings                         | install, configure, update, uninstall (not start)   |

- **install** fetches the software and initializes data. It runs again on reinstall over
  existing data, so keep it idempotent and never overwrite data.
- **configure** turns settings into configuration files. It runs after install and on every
  change of settings, with the process stopped.
- **start** runs the server in the foreground with `exec` (the supervisor's stop signal must
  reach it) and logs to stdout/stderr. It sees no settings, so secrets stay out of the
  process environment: read what configure wrote.
- **update** (optional) moves an installation to this version: new binaries, data
  migrations. It runs with the process stopped, after the new scripts and extra files are
  in place, and is followed by configure. Without one, **install** runs again (with
  `XDECK_ACTION=update`), so install should notice a changed software version and fetch it
  (the apps here record the installed version with `state_set`). A failing update leaves
  the previous scripts and version installed and starts the process again.
- **uninstall** runs after the process is removed; delete data only when
  `XDECK_DELETE_DATA=1`. Leave system packages installed.

Script output is shown live in XDeck and kept in the operation log. Helpers in
`shared/lib.sh` (`log`, `die`, `as_root`, `pkg_install`, `download`, `verify_sha256`,
`extract`, `state_set`/`state_load`, `disable_service`, ...) and `shared/lib.ps1` cover the
common steps; edit them in `shared/` and run `pnpm sync-shared`.

- **control** (optional) runs actions XDeck's integrations ask for, named by
  `XDECK_ACTION`, with the process running or stopped and without settings. Nginx apps
  implement `test` (check the configuration), `reload` and `version`. It must finish
  quickly (one minute at most); a non-zero exit fails the action and its output is shown.

## Nginx servers

An app with an `nginx` section is an Nginx server XDeck manages websites on (Websites in
XDeck). The installation directory has a fixed layout:

| Path         | Owner | Contents                                                     |
| ------------ | ----- | ------------------------------------------------------------ |
| `nginx.conf` | user  | main configuration; includes `conf.d/*.conf`, `sites/*.conf` |
| `conf.d/`    | user  | the user's own configuration                                 |
| `sites/`     | XDeck | one `<site>.conf` per website (inside `http {}`)             |
| `ssl/`       | XDeck | certificates of the websites                                 |
| `www/`       | user  | website roots (`www/<site>/` by default)                     |
| `acme/`      | XDeck | ACME HTTP-01 challenge files                                 |
| `logs/`      | nginx | website logs (writable by nginx)                             |

```yaml
nginx:
  service: nginx # Docker: the Compose service running nginx (default)
```

- **Docker.** Mount these paths into the service (anywhere; XDeck reads the mounts from
  `docker compose config`). Leave `network_mode` and `ports` of the service out: XDeck
  layers its own Compose file over yours with the host network (Docker Engine on Linux) or
  with every port nginx listens on published under the same number (Docker Desktop and
  other engines in a virtual machine), so websites are reached on this machine's ports
  either way. Listen on ports, not on `127.0.0.1` inside the container. XDeck runs
  `nginx -T` and `nginx -s reload` with `docker compose exec` (`run --rm` while stopped).
- **Process.** XDeck writes paths of the app directory into site configurations and calls
  the control script for `test`, `reload` and `version`.

## Database servers

An app with a `database` section is a server XDeck manages databases and users of
(Databases in XDeck). XDeck connects over TCP as the administrator; every field may use
`${KEY}`:

```yaml
database:
  engine: postgresql # mysql | mariadb | postgresql | redis | mongodb
  host: ${BIND} # listen address; 0.0.0.0 and :: are reached on loopback (default 127.0.0.1)
  port: ${PORT}
  user: ${POSTGRES_USER} # default: root (MySQL, MariaDB), postgres; none for Redis
  password: ${POSTGRES_PASSWORD}
  database: ${POSTGRES_DB} # PostgreSQL: the database to connect to (default postgres)
  service: postgres # Docker: the service running the server (default: the only one)
  tools: bin # process: directory of pg_dump / mysqldump / … (default: PATH)
```

- The administrator must be able to log in with that password over TCP from this machine
  (MySQL / MariaDB: `root@'%'`; PostgreSQL: a `host` rule with `scram-sha-256` for
  `127.0.0.1`; MongoDB: a user in `admin` with `root`). Remove anonymous MySQL accounts:
  they shadow `user@'%'` for local connections.
- **Docker.** Publish the port on `${BIND}`; XDeck connects to it on this machine. Backups
  run the image's own tools in the service (`mysqldump` / `mariadb-dump` and `mysql` /
  `mariadb` through the local socket as the administrator; `pg_dump` and `psql`).
- **Process.** Backups run the tools from `tools` or `PATH` over TCP; ship them with the
  server (the MySQL archive has them in `mysql/bin`).
- When `password` is a single `${KEY}`, XDeck changes that setting along with the
  administrator's password (it should be `install_only` when the server stores it at
  initialization). Redis passwords are changed through the app's settings.

## Versions and updates

XDeck offers an update when the repository's `version` is newer than the installed one
(compared part by part: `1.10` > `1.9`, `1.0` > `1.0-rc1`). Bump `version` whenever an
installed app should pick up a change: a new image tag or pinned download, script fixes,
new settings. Settings an update adds are asked for (or take their defaults); values of
existing settings stay.

Pin a SHA-256 for every download. Write scripts for bash 3.2 (macOS) and PowerShell 5.1.
