import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { publish } from "./build-index";
import { loadRepo, sha256 } from "./repo";

let root: string;

function write(rel: string, content: string) {
  const path = join(root, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

const app = (extra = "") => `id: web
name: Web
version: "1.0"
icon: icon.svg
docker:
  compose: docker/compose.yaml
  files:
    - { source: docker/index.html, target: html/index.html }
${extra}`;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "appstore-"));
  write("repository.yaml", "name: Test\ndescription: { en: Apps, zh: 应用 }\n");
  write("apps/web/app.yaml", app());
  write("apps/web/icon.svg", "<svg/>");
  write("apps/web/docker/compose.yaml", "services: {}\n");
  write("apps/web/docker/index.html", "<h1>hi</h1>");
  write("apps/notes/README.md", "not an app");
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("publish", () => {
  it("writes index.json and the referenced files", () => {
    const out = join(root, "public");
    publish(loadRepo(root), out);
    const index = JSON.parse(readFileSync(join(out, "index.json"), "utf8"));
    expect(index).toMatchObject({
      format: 1,
      name: "Test",
      description: { en: "Apps", zh: "应用" },
    });
    expect(index.apps).toHaveLength(1);
    const [entry] = index.apps;
    expect(entry).toMatchObject({ id: "web", path: "apps/web", version: "1.0", process: null });
    expect(Object.keys(entry.files)).toEqual([
      "docker/compose.yaml",
      "docker/index.html",
      "icon.svg",
    ]);
    for (const [rel, hash] of Object.entries(entry.files)) {
      const published = readFileSync(join(out, "apps/web", rel));
      expect(sha256(published)).toBe(hash);
    }
  });

  it("removes files of apps that are gone", () => {
    const out = join(root, "public");
    mkdirSync(join(out, "apps/old"), { recursive: true });
    writeFileSync(join(out, "apps/old/x"), "");
    publish(loadRepo(root), out);
    expect(() => readFileSync(join(out, "apps/old/x"))).toThrow();
  });
});

describe("loadRepo", () => {
  it("rejects a missing file", () => {
    rmSync(join(root, "apps/web/docker/index.html"));
    expect(() => loadRepo(root)).toThrow("docker/index.html is missing");
  });

  it("rejects an id that differs from its directory", () => {
    write("apps/web/app.yaml", app().replace("id: web", "id: site"));
    expect(() => loadRepo(root)).toThrow("expected web");
  });

  it("rejects files outside the repository", () => {
    const outside = mkdtempSync(join(tmpdir(), "outside-"));
    writeFileSync(join(outside, "secret"), "x");
    rmSync(join(root, "apps/web/docker/index.html"));
    symlinkSync(join(outside, "secret"), join(root, "apps/web/docker/index.html"));
    expect(() => loadRepo(root)).toThrow("outside the repository");
    rmSync(outside, { recursive: true });
  });

  it("rejects large icons", () => {
    write("apps/web/icon.svg", "x".repeat((1 << 20) + 1));
    expect(() => loadRepo(root)).toThrow("icon larger than 1 MiB");
  });

  it("reports invalid manifests with their path", () => {
    write("apps/web/app.yaml", app("settings: [{ key: lower }]"));
    expect(() => loadRepo(root)).toThrow("apps/web/app.yaml: invalid setting key");
  });
});
