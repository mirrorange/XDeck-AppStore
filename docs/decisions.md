# Decisions

Repository-specific decisions. The App Store design itself (snapshots, index format,
script contract) is recorded in XDeck's `docs/decisions.md` (ADRs 039–046).

## 001 · One repository: apps, index and site

**Context.** The official repository is served by Cloudflare Pages and must also be
browsable; a separate site would drift from what XDeck installs.
**Decision.** Apps live in the Git layout (`apps/<id>/app.yaml`); `pnpm build` validates
them, writes `public/index.json` with copies of every referenced file and builds the SPA,
which renders the same `index.json`. Generated files are not committed.
**Consequences.** One deploy publishes catalog and page together; XDeck can also use the
repository directly as a Git repository.

## 002 · A TypeScript mirror of the daemon's manifest checks

**Context.** XDeck skips apps it considers invalid; a broken manifest would silently vanish
from every daemon.
**Decision.** `app/lib/manifest.ts` mirrors the daemon's normalization and validation
(ids, keys, paths, settings, defaults, platforms, health checks) and `scripts/repo.ts` adds
the snapshot checks (files exist, stay inside the repository, size limits). The build
fails on the first problem. End-to-end runs against a daemon confirm both sides agree.
**Consequences.** Format changes in XDeck need the mirror updated (and `FORMAT` bumped).

## 003 · Same stack and look as XDeck's UI

**Decision.** React Router 8 in SPA mode, Tailwind 4, shadcn/ui on Base UI, Geist, i18next
with English and Chinese, next-themes; components copied from XDeck unchanged
(`app/components/ui` is excluded from formatting, as in XDeck). Cards, badges and the
search/category toolbar match XDeck's App Store page.
**Consequences.** Users see one product; UI fixes can be ported file by file.

## 004 · No 404.html, routes under `/app/:id`

**Context.** Cloudflare Pages serves `index.html` for unknown paths only when there is no
`404.html`; app files are published under `/apps/<id>/`.
**Decision.** Ship no `404.html`; app pages use `/app/<id>` so they never collide with
published directories. `scripts/serve.ts` reproduces this for local previews.

## 005 · Shared script helpers are copied into apps

**Context.** The daemon only reads files inside an app's directory, but every app needs the
same helpers.
**Decision.** `shared/lib.sh` and `shared/lib.ps1` are the sources; `pnpm sync-shared`
copies them to each app that lists them under `lib`, and a test fails when a copy is stale.
**Consequences.** Helpers are fixed once; each installed app keeps the version it was
installed with.

## 006 · Where software comes from

**Decision.** Use the system package manager where the software is packaged widely and
the version is not critical to the app (nginx, PostgreSQL, Redis/Valkey; Homebrew on
macOS). Use official archives with pinned SHA-256 where packages are missing or outdated
(MySQL 8.4 LTS, MongoDB 8.0 with mongosh, nginx on Windows). Distribution services that a
package starts are disabled; Debian's automatic PostgreSQL cluster is suppressed.
**Consequences.** Process apps work on common Linux distributions, macOS and (where an
official build exists) Windows; unsupported systems get a clear "use the Docker
deployment" error.

## 007 · Settings shared by every app

**Decision.** Every server app has `PORT` and `BIND` (a select: this machine only /
all interfaces). Databases default to this machine only, nginx to all interfaces.
Credentials are `generate`d passwords and `install_only` where the server stores them at
initialization (changing `.env` later would not change the account).
**Consequences.** The XDeck form looks the same across apps; reinstalling over kept data
needs the original credentials.

## 008 · Updates through version-aware install scripts

**Context.** XDeck updates process apps by running the new version's `update` script, or
`install` again when there is none.
**Decision.** The apps here ship no update scripts: install scripts record the software
version they fetched (`state_set`) and fetch again when the pinned version changes;
package-manager apps leave upgrades of system packages to the system. An app gets an
`update` script when moving between its versions needs more than new binaries (e.g. a
data migration between major versions).
**Consequences.** Patch and minor releases are published by bumping the pinned download
and `version`; reinstalls and updates share one tested path.

## 009 · Nginx is a server for XDeck's websites

**Context.** XDeck manages websites on installed Nginx apps (XDeck ADRs 048–049): it
writes `sites/`, `ssl/` and `acme/` and needs to test and reload nginx.
**Decision.** The Nginx app declares `nginx: { service: nginx }` and uses the layout of the
authoring guide for both methods. `nginx.conf` is an extra file the user owns (placed once);
what follows from settings is generated next to it (Docker: the default server from
`templates/` at container start; process: `conf/main.conf` and `conf/http.conf` by
configure). Process apps ship `control` scripts for test, reload and version. The Docker
deployment sets neither `network_mode` nor `ports`: XDeck gives the service the host
network or publishes the ports nginx listens on, depending on the engine (XDeck ADR 054),
so the default page listens on its port on every address and `BIND` is a process setting.
**Consequences.** Version 1.30-1 changes the layout: installations of 1.30 get the new
files on update (their old `conf.d/default.conf` or `conf/sites/` stay where they were).
Version 1.30-2 drops host networking; installations of 1.30-1 keep their default page
template, which still uses `NGINX_BIND`: replace it with the new one after updating.

## 010 · Database servers declare how XDeck connects

**Context.** XDeck manages databases, users and access on database servers installed from
the App Store (XDeck ADRs 062–065). It needs the address, port and administrator of each
installation, which only the app knows.
**Decision.** MySQL 8.4-1, PostgreSQL 17-1, Redis 8.2-1 and MongoDB 8.0-1 declare a
`database` section with templates over their settings (`BIND`, `PORT`, the administrator
and its password). A MariaDB app joins them: `mariadb:11.8` for Docker, the system package
(Homebrew on macOS) for the process deployment, set up like MySQL (root password,
`root@'%'`, optional database and user, anonymous accounts removed). Versions are bumped so
installations pick the section up with an update; nothing else changes for them.
**Consequences.** XDeck reaches every server over TCP on this machine with the
credentials the install used; changing the root password in XDeck changes the setting
too. MariaDB has no Windows process deployment.

## 011 · Tunnel connectors and the frp server are XDeck integrations

**Context.** XDeck publishes websites and ports of a machine without a public address
through Cloudflare Tunnel or a self-hosted frp server (XDeck ADRs 077–079). It installs and
configures the connectors itself, and needs to know where an installation keeps its token
or configuration.
**Decision.** Cloudflared, the frp client and the frp server declare a `tunnel` section.
Cloudflared takes the tunnel token as a required setting (`token: ${TUNNEL_TOKEN}`), so a
tunnel created in the Cloudflare dashboard works without XDeck too, and exposes metrics on
`127.0.0.1` for the connection status. The frp client has no settings: XDeck writes
`conf/frpc.toml` (a placeholder that keeps retrying is placed at installation), so Docker
mounts `conf/`. The frp server writes `frps.toml` from its settings (Docker: at every start
in the container's shell; process: configure, checked with `frps verify`) with the token,
ports for websites, the subdomain host, allowed ports and the dashboard, which XDeck reads.
Docker deployments use the host network; process deployments download the official builds
with pinned SHA-256 (cloudflared 2026.11.1, frp 0.72.0).
**Consequences.** A connector reaches local services at the addresses this machine uses.
On Docker Desktop and other engines in a virtual machine the host network is the VM's, so
the process deployment is the one to use there. Cloudflared has no Windows ARM build.

## 012 · rclone and OpenList are storage integrations

**Context.** XDeck mounts cloud storage with rclone, manages its remotes and mounts, and
manages OpenList installations (administrator, website, mounting it through rclone). It
needs to reach rclone's remote control and OpenList's administrator.
**Decision.** Both declare a `storage` section. rclone runs only the remote control
(`rclone rcd`, no web GUI) on `127.0.0.1` with a generated password, its configuration in
`conf/rclone.conf` and the VFS cache in `cache/`; XDeck owns the remotes and mounts
through the RC API. The Docker deployment uses the host network, FUSE and a mount folder
(`/mnt/rclone`) shared with the host. OpenList's administrator password is a regular
setting that configure applies; `PORT` and `BIND` follow ADR 007, with all interfaces by
default like other web interfaces. Both download the official builds with pinned SHA-256
(rclone 1.76.0, OpenList 4.2.10).
**Consequences.** Changing OpenList's password in its own web interface is undone by the
next configure (Docker: the next start); XDeck is where it changes. Docker mounts need a
Linux Docker Engine with `/dev/fuse` and a shared mount; on Docker Desktop, use the
process deployment. Mounts end when rclone stops; XDeck mounts them again.
