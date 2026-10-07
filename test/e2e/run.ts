// End-to-end check of an app against a running XDeck daemon: install with
// default settings, verify the service, change its port, verify again and
// uninstall with its data.
//
//   XDECK_URL=http://127.0.0.1:9210 XDECK_TOKEN=xdk_... \
//     tsx test/e2e/run.ts <app> <docker|process> [repo]
//
// Client checks run official images with host networking, so Docker is
// needed for every app except nginx.

import { execFileSync } from "node:child_process";
import { createServer, Socket } from "node:net";
import { XDeck } from "./xdeck";

type Config = Record<string, string>;

interface Installed {
  name: string;
  status: string;
  method: string;
  config: Config;
  process_id?: string | null;
  error?: string | null;
}

const [appId, method, repo = "official"] = process.argv.slice(2);
if (!appId || (method !== "docker" && method !== "process")) {
  console.error("usage: run.ts <app> <docker|process> [repo]");
  process.exit(2);
}
const url = process.env.XDECK_URL ?? "http://127.0.0.1:9210";
const token = process.env.XDECK_TOKEN ?? "";
const name = `e2e-${appId}-${method}`;

function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const s = createServer().listen(0, "127.0.0.1", () => {
      const port = (s.address() as { port: number }).port;
      s.close(() => resolve(port));
    });
  });
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function portOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const s = new Socket();
    s.setTimeout(1000);
    s.once("connect", () => (s.destroy(), resolve(true)));
    s.once("error", () => resolve(false));
    s.once("timeout", () => (s.destroy(), resolve(false)));
    s.connect(port, "127.0.0.1");
  });
}

async function retry(what: string, seconds: number, check: () => Promise<void> | void) {
  let last: unknown;
  for (let i = 0; i < seconds; i += 2) {
    try {
      await check();
      console.log(`ok: ${what}`);
      return;
    } catch (e) {
      last = e;
      await sleep(2000);
    }
  }
  throw new Error(`${what}: ${(last as Error)?.message ?? last}`);
}

function client(image: string, args: string[], env: Config = {}): string {
  const envArgs = Object.entries(env).flatMap(([k, v]) => ["-e", `${k}=${v}`]);
  return execFileSync("docker", ["run", "--rm", "--network", "host", ...envArgs, image, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

/** Talk to the service with its own client, authenticating with the settings. */
async function verify(port: number, c: Config) {
  const p = String(port);
  switch (appId) {
    case "nginx": {
      const res = await fetch(`http://127.0.0.1:${port}/`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return;
    }
    case "redis": {
      const out = client("redis:8.2-alpine", ["redis-cli", "-h", "127.0.0.1", "-p", p, "ping"], {
        REDISCLI_AUTH: c.REDIS_PASSWORD,
      });
      if (!out.includes("PONG")) throw new Error(out);
      return;
    }
    case "postgresql": {
      const out = client(
        "postgres:17-alpine",
        [
          "psql",
          "-h",
          "127.0.0.1",
          "-p",
          p,
          "-U",
          c.POSTGRES_USER,
          "-d",
          c.POSTGRES_DB,
          "-tAc",
          "select 40+2",
        ],
        { PGPASSWORD: c.POSTGRES_PASSWORD },
      );
      if (out.trim() !== "42") throw new Error(out);
      return;
    }
    case "mysql": {
      const sql = "select 40+2";
      const out = client(
        "mysql:8.4",
        ["mysql", "-h127.0.0.1", `-P${p}`, "-uroot", "-N", "-e", sql],
        {
          MYSQL_PWD: c.MYSQL_ROOT_PASSWORD,
        },
      );
      if (out.trim() !== "42") throw new Error(out);
      if (c.MYSQL_USER) {
        const db = c.MYSQL_DATABASE ? [c.MYSQL_DATABASE] : [];
        const user = client(
          "mysql:8.4",
          ["mysql", "-h127.0.0.1", `-P${p}`, `-u${c.MYSQL_USER}`, "-N", "-e", sql, ...db],
          { MYSQL_PWD: c.MYSQL_PASSWORD },
        );
        if (user.trim() !== "42") throw new Error(user);
      }
      return;
    }
    case "mongodb": {
      const uri = `mongodb://${encodeURIComponent(c.MONGO_USERNAME)}:${encodeURIComponent(c.MONGO_PASSWORD)}@127.0.0.1:${p}/admin`;
      const out = client("mongo:8.0", [
        "mongosh",
        "--quiet",
        uri,
        "--eval",
        "db.runCommand({ping:1}).ok",
      ]);
      if (out.trim() !== "1") throw new Error(out);
      return;
    }
    default:
      if (!(await portOpen(port))) throw new Error(`port ${port} is closed`);
  }
}

async function main() {
  const x = await XDeck.connect(url, token);
  x.on((n) => {
    if (n.method !== "event.appstore.output") return;
    for (const l of (n.params.lines as { line?: string; text?: string }[]) ?? []) {
      console.log(`  | ${l.line ?? l.text ?? JSON.stringify(l)}`);
    }
  });
  await x.call("appstore.repos.sync", { id: repo });
  const existing = await x.call<{ apps: Installed[] }>("appstore.installed.list");
  if (existing.apps.some((a) => a.name === name)) {
    console.log(`removing a previous ${name}`);
    await x.call("appstore.uninstall", { name, delete_data: true, force: true });
  }

  const port = await freePort();
  console.log(`installing ${appId} (${method}) as ${name} on port ${port}`);
  const started = Date.now();
  try {
    await x.call("appstore.install", {
      repo,
      app: appId,
      method,
      name,
      config: { PORT: String(port) },
      stream: "e2e",
    });
  } catch (e) {
    const log = await lastLog(x);
    throw new Error(`install failed: ${(e as Error).message}\n${log}`);
  }
  console.log(`installed in ${Math.round((Date.now() - started) / 1000)}s`);
  const app = await x.call<Installed>("appstore.get", { name });
  await retry(`${appId} answers on ${port}`, 180, () => verify(port, app.config));

  const moved = await freePort();
  console.log(`moving to port ${moved}`);
  await x.call("appstore.configure", {
    name,
    config: { ...app.config, PORT: String(moved) },
    stream: "e2e",
  });
  await retry(`${appId} answers on ${moved}`, 180, () => verify(moved, app.config));

  console.log("uninstalling");
  await x.call("appstore.uninstall", { name, delete_data: true, stream: "e2e" });
  const after = await x.call<{ apps: Installed[] }>("appstore.installed.list");
  if (after.apps.some((a) => a.name === name)) throw new Error("still installed");
  await retry(`port ${moved} closed`, 30, async () => {
    if (await portOpen(moved)) throw new Error("still open");
  });
  x.close();
  console.log(`PASS ${appId} ${method}`);
}

async function lastLog(x: XDeck): Promise<string> {
  try {
    const ops = await x.call<{ operations: { id: number }[] }>("appstore.operations", { name });
    const id = ops.operations[0]?.id;
    if (id === undefined) return "";
    return (await x.call<{ log: string }>("appstore.operation.log", { name, id })).log;
  } catch {
    return "";
  }
}

main().then(
  () => process.exit(0),
  (e: unknown) => {
    console.error(`FAIL ${appId} ${method}: ${(e as Error).message}`);
    process.exit(1);
  },
);
