# Development log

## 2026-11-06 · App updates

**Goal.** Support XDeck's app updates (Compose file replaced for Docker apps, optional
`update` script for process apps).

**Done**

- Manifest mirror: `update` scripts (checked, hashed in `index.json`, shown on app pages).
- Docs: authoring guide on updates, `XDECK_PREVIOUS_VERSION`, version ordering; ADR 008.
- `test/e2e/run.ts` updates the installed app to the repository's version and checks it
  still answers.

**Verification.** `pnpm check`; `test/e2e/run.ts nginx process` against a local daemon
(Ubuntu 24.04, root) passes with the update step.

## 2026-10-07 · Official repository

**Goal.** Create the official XDeck App Store repository with Nginx, PostgreSQL, MySQL,
Redis and MongoDB, each deployable with Docker and as a process, keeping data under
XDeck's data directory, plus a static site to browse it on Cloudflare Pages.

**Done**

- Site: catalog (search, categories, repository URL to copy) and app pages (facts,
  platforms, settings table, file viewer for Compose files and scripts), en / zh, light /
  dark, styled like XDeck.
- Build: `scripts/build-index.ts` (validated `index.json` and published files),
  `scripts/sync-shared.ts`, `scripts/serve.ts`, `public/_headers`.
- Apps: Docker for all five; process on Linux and macOS for all, Windows for Nginx, MySQL
  and MongoDB. Shared helpers in bash 3.2 and PowerShell 5.1.
- Tests: manifest mirror, catalog helpers, pages, index builder, every app (translations,
  Compose variables, data mounts, `docker compose config`, `bash -n`, PowerShell parsing),
  shared helpers (bash and PowerShell); CI workflow.

**Verification.** `test/e2e/run.ts` against XDeck daemons on Amazon Linux 2023 (x86_64),
for all ten app/method pairs: install, check with the service's own client (custom users,
databases, passwords with quotes, backslashes, spaces), move to another port, uninstall
keeping data, reinstall over it, uninstall with data. Process apps also passed under a
root daemon with a `0700` data directory (PostgreSQL as `postgres`, search permission
added). Screenshots of the site and of XDeck's App Store pages checked in en / zh, light /
dark.

**Findings**

- Redis 6 (Amazon Linux's `redis6`) rejects `bind * -::*`; `0.0.0.0` is used instead.
- Debian/Ubuntu packages start services on the default ports (Redis, nginx, PostgreSQL's
  main cluster); scripts disable what they installed.
- MySQL has no minimal archive for Linux aarch64 (the full one is ~800 MB); test suites,
  docs and the archive are removed after extraction.
- MongoDB has no 8.0 builds for Debian 11 or aarch64 Debian; those systems are told to use
  Docker.
- `pwsh -Command` does not pass extra arguments as `$args`; the parse check passes the
  file through the environment.

**Not covered.** Windows and macOS scripts are parse-checked, not executed; the Windows
PowerShell host is supervised, and start scripts stop leftover servers of a previous run.

## 2026-11-06 · Nginx for websites

**Goal.** Make the Nginx app a server XDeck's Websites module manages (ADR 009).

**Done**

- Manifest mirror: `nginx` section, `control` scripts (and their checks).
- Nginx 1.30-1: fixed layout (`nginx.conf`, `conf.d/`, `sites/`, `ssl/`, `www/`, `acme/`,
  `logs/`), Docker with host networking, bind mounts and the default page rendered from a
  template, process `nginx.conf` with generated includes, `control.sh` / `control.ps1`.
- Authoring guide: control scripts and the Nginx server contract.

**Verification.** `pnpm test`, `pnpm build`; the Compose file started with Docker (host
network, template, `nginx -t` through `compose exec`); `test/e2e/run.ts nginx process`
passes against XDeck; sites, an ACME certificate (Pebble) and `nginx.conf` edits worked on
both deployments through XDeck's UI. `run.ts nginx docker` stopped at the update's image
pull here (Docker Hub unreachable), after installing and checking the app.

## 2026-11-10 · Nginx networks chosen by XDeck

**Goal.** Docker Nginx servers were unreachable with Docker Desktop and other engines in a
virtual machine, where `network_mode: host` is the VM's network (XDeck ADR 054).

**Done**

- Nginx 1.30-2: no `network_mode` (XDeck adds the host network or publishes the ports),
  the default page listens on `${NGINX_PORT}` on every address, `BIND` only for the process
  deployment; description in en / zh.
- Authoring guide and ADR 009: Nginx apps leave the network of the service to XDeck.

**Verification.** `pnpm check`, `pnpm build`; `test/e2e/run.ts nginx docker` passes against
XDeck on a Linux engine with the host network and with published ports
(`host_network = "isolated"`, the port change re-publishes the default page), and
`run.ts nginx process` still passes.

**Notes**

- Installations of 1.30-1 keep `templates/default-server.conf.template` (extra files are
  placed only when missing); it uses `${NGINX_BIND}`, which 1.30-2 no longer sets. Replace
  it with the new template after updating, or reinstall.

## 2026-11-10 · Database servers for XDeck

**Goal.** Let XDeck manage the databases and users of the database apps (ADR 010).

**Done**

- Manifest mirror: `database` section (engine, host, port, user, password, database;
  references must be settings), in the normalized form XDeck reads from `index.json`.
- MySQL 8.4-1, PostgreSQL 17-1, Redis 8.2-1, MongoDB 8.0-1: `database` sections.
- MariaDB 11.8: Docker (`mariadb:11.8`, health check) and process (system package or
  Homebrew; configuration, data and socket in the app directory; root password, `root@'%'`,
  optional database and user; anonymous accounts removed; packaged service disabled).
- End-to-end runner: MariaDB client check; for database servers, XDeck reaches the server
  on the installed and on the moved port and creates and drops a database with its user.
- Authoring guide: database servers; README.

**Verification.** `pnpm check`, `pnpm build`. Against XDeck on Ubuntu 24.04 (as root), all
five apps installed as processes from this repository built locally (MariaDB 10.11 and
PostgreSQL 16 from the distribution, Redis 7.0, MySQL 8.4.11, MongoDB 8.0.32 downloaded);
XDeck listed them with their versions, created and dropped databases with users on each,
followed a port change of Redis and changed the root password of MariaDB.

`test/e2e/run.ts` then passed for all five apps with both methods (`docker` and
`process`) against XDeck with Docker Engine 29 and Compose 5: client checks, XDeck
managing the server after installing and after the port change, update, reinstall over
kept data and removal. MySQL 8.4 over the published port authenticates with
`caching_sha2_password` without TLS.

**Not covered.** MariaDB on macOS.
