import { describe, expect, it, vi } from "vitest";
import {
  appPath,
  categoriesOf,
  fetchIndex,
  fileUrl,
  iconUrl,
  matchesApp,
  reviewFiles,
} from "./catalog";
import { parseManifest, type IndexEntry } from "./manifest";

const base = parseManifest({
  id: "redis",
  name: "Redis",
  version: "8",
  summary: { en: "In-memory store", zh: "内存数据库" },
  icon: "icon.svg",
  categories: ["database", "cache"],
  docker: { compose: "docker/compose.yaml" },
  process: {
    unix: {
      install: "process/install.sh",
      start: "process/start.sh",
      configure: "process/configure.sh",
    },
    windows: { install: "process/install.ps1", start: "process/start.ps1" },
  },
});
const app: IndexEntry = { ...base, path: "apps/redis", files: {} };

describe("catalog helpers", () => {
  it("builds file and page URLs", () => {
    expect(fileUrl(app, "docker/compose.yaml")).toBe("/apps/redis/docker/compose.yaml");
    expect(fileUrl(app, "a b/c#.sh")).toBe("/apps/redis/a%20b/c%23.sh");
    expect(iconUrl(app)).toBe("/apps/redis/icon.svg");
    expect(iconUrl({ ...app, icon: null })).toBeNull();
    expect(appPath(app)).toBe("/app/redis");
  });

  it("collects categories in order", () => {
    expect(categoriesOf([app, { ...app, categories: ["web", "cache"] }])).toEqual([
      "database",
      "cache",
      "web",
    ]);
  });

  it("matches names, summaries, categories and methods", () => {
    expect(matchesApp(app, "", "en")).toBe(true);
    expect(matchesApp(app, "RED", "en")).toBe(true);
    expect(matchesApp(app, "内存", "zh")).toBe(true);
    expect(matchesApp(app, "内存", "en")).toBe(false);
    expect(matchesApp(app, "cache", "en")).toBe(true);
    expect(matchesApp(app, "docker", "en")).toBe(true);
    expect(matchesApp(app, "nginx", "en")).toBe(false);
  });

  it("lists files to review without duplicates", () => {
    expect(reviewFiles(app).map((f) => f.label)).toEqual([
      "compose.yaml",
      "install.sh",
      "configure.sh",
      "start.sh",
      "install.ps1",
      "start.ps1",
    ]);
    const twins = parseManifest({
      id: "x",
      name: "X",
      version: "1",
      process: {
        unix: { install: "unix/run.sh", start: "unix/start.sh" },
        windows: { install: "win/run.sh", start: "win/start.ps1" },
      },
    });
    expect(reviewFiles(twins).map((f) => f.label)).toEqual([
      "unix/run.sh",
      "start.sh",
      "win/run.sh",
      "start.ps1",
    ]);
  });

  it("fetches the index and reports HTTP errors", async () => {
    const ok = vi.fn().mockResolvedValue(new Response(JSON.stringify({ format: 1, apps: [] })));
    await expect(fetchIndex(ok)).resolves.toMatchObject({ format: 1, apps: [] });
    expect(ok).toHaveBeenCalledWith("/index.json", { cache: "no-cache" });
    const missing = vi.fn().mockResolvedValue(new Response("", { status: 404 }));
    await expect(fetchIndex(missing)).rejects.toThrow("HTTP 404");
  });
});
