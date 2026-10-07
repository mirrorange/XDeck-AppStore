# Development log

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
