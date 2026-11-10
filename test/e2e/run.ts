// End-to-end check of an app against a running XDeck daemon: install with
// default settings, verify the service (and, for database servers, that
// XDeck manages it), update it to the repository's version, change its port,
// verify again, reinstall over the kept data and uninstall with its data.
//
//   XDECK_URL=http://127.0.0.1:9210 XDECK_TOKEN=xdk_... \
//     tsx test/e2e/run.ts <app> <docker|process> [repo]
//
// E2E_CONFIG='{"KEY":"value"}' overrides settings besides the port.
//
// Client checks run official images with host networking, so Docker is
// needed for every app except nginx.

import { execFileSync } from "node:child_process";
import { createServer, Socket } from "node:net";
import { XDeck } from "./xdeck";

type Config = Record<string, string>;

interface Task {
  id: string;
  state: "running" | "succeeded" | "failed";
  error: string | null;
}

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
const extra = JSON.parse(process.env.E2E_CONFIG ?? "{}") as Config;

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
    case "mariadb": {
      const sql = "select 40+2";
      const out = client(
        "mariadb:11.8",
        ["mariadb", "-h127.0.0.1", `-P${p}`, "-uroot", "-N", "-e", sql],
        { MYSQL_PWD: c.MARIADB_ROOT_PASSWORD },
      );
      if (out.trim() !== "42") throw new Error(out);
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

interface DbInstance {
  port: number;
  server_version: string | null;
  error: string | null;
  engine: string;
}

/**
 * Database servers: XDeck reaches the server on `port` and can create and
 * drop a database with its own user there.
 */
async function manage(x: XDeck, port: number) {
  const i = await x.call<DbInstance>("databases.get", { name });
  if (i.port !== port) throw new Error(`XDeck connects to port ${i.port}`);
  if (i.error || !i.server_version) throw new Error(i.error ?? "no server version");
  if (i.engine === "redis") {
    await x.call("databases.redis.keys", { name, db: 0 });
    return;
  }
  const db = `e2e_${Date.now().toString(36)}`;
  await x.call("databases.create", {
    name,
    database: { name: db, user: { name: db, password: "e2e-Pass-1234" } },
  });
  const { databases } = await x.call<{ databases: { name: string }[] }>("databases.list", { name });
  if (!databases.some((d) => d.name === db)) throw new Error(`${db} is not listed`);
  if (i.engine !== "mongodb") {
    // A dump of it, restored into it again.
    const backup = await x.call<Task>("databases.backup", { name, database: db });
    const done = await taskEnd(x, backup.id);
    if (done.state !== "succeeded") throw new Error(`backup: ${done.error}`);
    const { backups } = await x.call<{ backups: { path: string }[] }>("databases.backups", {
      name,
    });
    const restore = await x.call<Task>("databases.restore", {
      name,
      database: db,
      path: backups[0].path,
    });
    const restored = await taskEnd(x, restore.id);
    if (restored.state !== "succeeded") throw new Error(`restore: ${restored.error}`);
    await x.call("databases.backup.delete", { name, path: backups[0].path });
  }
  await x.call("databases.drop", { name, database: db, drop_users: true });
}

/** Tasks that ended, by id (the end may arrive before the reply that started them). */
const ended = new Map<string, Task>();
const waiting = new Map<string, (t: Task) => void>();

/** Print task output and note task ends. Subscribe before starting tasks. */
async function followTasks(x: XDeck) {
  x.on((n) => {
    if (n.method === "event.tasks.output") {
      for (const l of (n.params.lines as { text: string }[]) ?? []) console.log(`  | ${l.text}`);
    } else if (n.method === "event.tasks.changed") {
      const task = n.params.task as Task;
      if (task.state === "running") return;
      ended.set(task.id, task);
      waiting.get(task.id)?.(task);
    }
  });
  await x.call("events.subscribe", { topics: ["tasks", "task:*"] });
}

/** Wait until a task ended. */
async function taskEnd(_x: XDeck, id: string): Promise<Task> {
  const done = ended.get(id) ?? (await new Promise<Task>((r) => waiting.set(id, r)));
  waiting.delete(id);
  return done;
}

/** Start an App Store operation and wait until its task ended. */
async function run(x: XDeck, what: string, method: string, params: Record<string, unknown>) {
  const task = await x.call<Task>(method, params);
  const done = ended.get(task.id) ?? (await new Promise<Task>((r) => waiting.set(task.id, r)));
  waiting.delete(task.id);
  if (done.state === "failed") throw new Error(`${what} failed: ${done.error}`);
}

async function main() {
  const x = await XDeck.connect(url, token);
  await followTasks(x);
  await x.call("appstore.repos.sync", { id: repo });
  const existing = await x.call<{ apps: Installed[] }>("appstore.installed.list");
  if (existing.apps.some((a) => a.name === name)) {
    console.log(`removing a previous ${name}`);
    await run(x, "removal", "appstore.uninstall", { name, delete_data: true, force: true });
  }

  const port = await freePort();
  console.log(`installing ${appId} (${method}) as ${name} on port ${port}`);
  const started = Date.now();
  await run(x, "install", "appstore.install", {
    repo,
    app: appId,
    method,
    name,
    config: { ...extra, PORT: String(port) },
  });
  console.log(`installed in ${Math.round((Date.now() - started) / 1000)}s`);
  const app = await x.call<Installed>("appstore.get", { name });
  await retry(`${appId} answers on ${port}`, 180, () => verify(port, app.config));
  const database = await x.call<DbInstance>("databases.get", { name }).catch(() => null);
  if (database) await retry(`XDeck manages ${name}`, 60, () => manage(x, port));

  // The repository offers the installed version: the update runs the update
  // script (or install again) over the running installation.
  console.log("updating to the repository's version");
  await run(x, "update", "appstore.update", { name });
  await retry(`${appId} answers on ${port} after the update`, 180, () => verify(port, app.config));

  const moved = await freePort();
  console.log(`moving to port ${moved}`);
  await run(x, "configure", "appstore.configure", {
    name,
    config: { ...app.config, PORT: String(moved) },
  });
  await retry(`${appId} answers on ${moved}`, 180, () => verify(moved, app.config));
  if (database) await retry(`XDeck manages ${name} on ${moved}`, 60, () => manage(x, moved));

  // Uninstalling without deleting data, then installing again with the same
  // settings, must bring the existing data back.
  console.log("uninstalling, keeping data");
  await run(x, "uninstall", "appstore.uninstall", { name, delete_data: false });
  await retry(`port ${moved} closed`, 30, async () => {
    if (await portOpen(moved)) throw new Error("still open");
  });
  console.log("installing again over the kept data");
  const config = { ...app.config, PORT: String(moved) };
  await run(x, "reinstall", "appstore.install", { repo, app: appId, method, name, config });
  await retry(`${appId} answers on ${moved} with the kept data`, 180, () => verify(moved, config));

  console.log("uninstalling");
  await run(x, "uninstall", "appstore.uninstall", { name, delete_data: true });
  const after = await x.call<{ apps: Installed[] }>("appstore.installed.list");
  if (after.apps.some((a) => a.name === name)) throw new Error("still installed");
  await retry(`port ${moved} closed`, 30, async () => {
    if (await portOpen(moved)) throw new Error("still open");
  });
  x.close();
  console.log(`PASS ${appId} ${method}`);
}

main().then(
  () => process.exit(0),
  (e: unknown) => {
    console.error(`FAIL ${appId} ${method}: ${(e as Error).message}`);
    process.exit(1);
  },
);
