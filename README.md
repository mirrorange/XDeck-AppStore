# XDeck App Store

The official software repository of [XDeck](https://github.com/mirrorange/XDeck), published
at **https://appstore.xdeck.top**. XDeck reads it as a Web repository; the same site lets
you browse the apps in a browser.

| App        | Docker               | Process (Linux / macOS / Windows)                 |
| ---------- | -------------------- | ------------------------------------------------- |
| Nginx      | `nginx:1.30-alpine`  | system package · system package · nginx.org build |
| PostgreSQL | `postgres:17-alpine` | system package · Homebrew · —                     |
| MySQL      | `mysql:8.4`          | official 8.4 LTS build on all three               |
| Redis      | `redis:8.2-alpine`   | system package (Redis or Valkey) · Homebrew · —   |
| MongoDB    | `mongo:8.0`          | official 8.0 build and mongosh on all three       |

Data stays under the XDeck data directory: Docker apps bind-mount `./data` inside their
Compose project, process apps keep everything in `<data_dir>/apps/<name>/`.

## Layout

```
repository.yaml          repository name and description
apps/<id>/app.yaml       manifest: settings, Docker and process deployment
apps/<id>/docker/        compose.yaml and files placed next to it
apps/<id>/process/       install / configure / start / uninstall scripts
shared/lib.sh, lib.ps1   script helpers, copied into apps by `pnpm sync-shared`
app/                     the website (React Router SPA, same stack as XDeck's UI)
scripts/                 index builder, library sync, local static server
test/                    repository checks and the end-to-end runner
docs/                    authoring guide, decisions and development log
```

## Development

```sh
pnpm install
pnpm dev            # builds public/index.json, then the site with hot reload
pnpm check          # libraries in sync, type check, tests
pnpm build          # public/index.json + app files + site in build/client
pnpm preview        # serve build/client like Cloudflare Pages
```

`pnpm build` fails on any manifest XDeck would reject, a missing file, or a file outside
its app directory. See [docs/authoring.md](docs/authoring.md) to add an app.

### End-to-end tests

`test/e2e/run.ts` installs an app on a running XDeck daemon, checks it with the service's
own client, moves it to another port, checks again and uninstalls it with its data:

```sh
pnpm build && pnpm preview                       # repository on :4173
# config.toml: [appstore] official_url = "http://127.0.0.1:4173"
XDECK_URL=http://127.0.0.1:9210 XDECK_TOKEN=xdk_... \
  npx tsx test/e2e/run.ts postgresql process
```

## Deployment (Cloudflare Pages)

Build command `pnpm build`, output directory `build/client`. There is no `404.html`, so
Pages serves `index.html` for app pages; `public/_headers` allows cross-origin reads of
`index.json` and app files.

## License

Repository content: MIT. App icons come from [Simple Icons](https://simpleicons.org) (CC0)
and are trademarks of their owners.
