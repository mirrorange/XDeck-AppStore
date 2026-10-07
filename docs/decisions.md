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
