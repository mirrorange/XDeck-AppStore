import { describe, expect, it } from "vitest";
import {
  checkValue,
  ManifestError,
  methodsOf,
  parseManifest,
  parseMeta,
  pick,
  referencedFiles,
  supportedPlatforms,
} from "./manifest";

const minimal = { id: "web", name: "Web", version: "1", docker: { compose: "compose.yaml" } };

describe("parseManifest", () => {
  it("normalizes optional fields", () => {
    const m = parseManifest({ ...minimal, summary: "A server", version: 2 });
    expect(m).toMatchObject({
      version: "2",
      summary: { en: "A server" },
      description: {},
      icon: null,
      categories: [],
      settings: [],
      docker: { compose: "compose.yaml", files: [] },
      process: null,
      nginx: null,
      database: null,
      tunnel: null,
      storage: null,
    });
  });

  it("reads the database integration", () => {
    const settings = [
      { key: "PORT", type: "port", default: 5432 },
      { key: "PASSWORD", type: "password", generate: true },
    ];
    const m = parseManifest({
      ...minimal,
      settings,
      database: { engine: "postgresql", port: "${PORT}", password: "${PASSWORD}" },
    });
    expect(m.database).toEqual({
      engine: "postgresql",
      host: null,
      port: "${PORT}",
      user: null,
      password: "${PASSWORD}",
      database: null,
      service: null,
      tools: null,
    });
    expect(() =>
      parseManifest({ ...minimal, database: { engine: "mysql", port: 1, tools: "../bin" } }),
    ).toThrow();
    expect(
      parseManifest({ ...minimal, database: { engine: "redis", port: 6379 } }).database?.port,
    ).toBe("6379");
    expect(() =>
      parseManifest({ ...minimal, settings, database: { engine: "redis", port: "${NOPE}" } }),
    ).toThrow("unknown setting NOPE");
    expect(() => parseManifest({ ...minimal, database: { engine: "oracle", port: 1 } })).toThrow(
      "database.engine",
    );
    expect(() =>
      parseManifest({ ...minimal, settings, database: { engine: "redis", port: "$${PORT}" } }),
    ).not.toThrow();
  });

  it("reads the Nginx integration", () => {
    const m = parseManifest({
      ...minimal,
      nginx: {},
      process: { unix: { install: "i.sh", start: "s.sh", control: "c.sh" } },
    });
    expect(m.nginx).toEqual({ service: "nginx" });
    expect(referencedFiles(m)).toContain("c.sh");
    expect(parseManifest({ ...minimal, nginx: { service: "web" } }).nginx).toEqual({
      service: "web",
    });
  });

  it("reads the tunnel integration", () => {
    const settings = [
      { key: "TUNNEL_TOKEN", type: "password" },
      { key: "PORT", type: "port" },
    ];
    const m = parseManifest({
      ...minimal,
      settings,
      tunnel: { kind: "cloudflared", token: "${TUNNEL_TOKEN}", metrics: "${PORT}" },
    });
    expect(m.tunnel).toMatchObject({ kind: "cloudflared", token: "${TUNNEL_TOKEN}", config: null });
    expect(m.tunnel?.metrics).toBe("${PORT}");
    const frpc = parseManifest({ ...minimal, tunnel: { kind: "frpc", config: "conf/frpc.toml" } });
    expect(frpc.tunnel?.config).toBe("conf/frpc.toml");
    const frps = { kind: "frps", port: "${PORT}", token: "${TUNNEL_TOKEN}", http_port: 8080 };
    expect(parseManifest({ ...minimal, settings, tunnel: frps }).tunnel?.http_port).toBe("8080");
    expect(() =>
      parseManifest({ ...minimal, tunnel: { kind: "cloudflared", token: "x" } }),
    ).toThrow("token");
    expect(() => parseManifest({ ...minimal, tunnel: { kind: "frpc" } })).toThrow(
      "configuration file",
    );
    expect(() =>
      parseManifest({ ...minimal, tunnel: { kind: "frpc", config: "../x.toml" } }),
    ).toThrow("invalid path");
    expect(() => parseManifest({ ...minimal, tunnel: { kind: "frps", port: "${NOPE}" } })).toThrow(
      "unknown setting NOPE",
    );
    expect(() => parseManifest({ ...minimal, tunnel: { kind: "ngrok" } })).toThrow("tunnel.kind");
  });

  it("reads the storage integration", () => {
    const settings = [
      { key: "RC_PORT", type: "port" },
      { key: "RC_PASSWORD", type: "password" },
      { key: "MOUNT_ROOT", type: "string" },
    ];
    const rclone = {
      kind: "rclone",
      rc: "${RC_PORT}",
      user: "xdeck",
      password: "${RC_PASSWORD}",
      config: "conf/rclone.conf",
      mount_root: "${MOUNT_ROOT}",
    };
    expect(parseManifest({ ...minimal, settings, storage: rclone }).storage).toEqual({
      ...rclone,
      port: null,
    });
    expect(
      parseManifest({ ...minimal, storage: { kind: "rclone", rc: 5572 } }).storage?.config,
    ).toBeNull();
    const ol = { kind: "openlist", port: 5244, user: "admin", password: "${RC_PASSWORD}" };
    const openlist = parseManifest({ ...minimal, settings, storage: ol });
    expect(openlist.storage).toMatchObject({ kind: "openlist", port: "5244", config: null });
    expect(() => parseManifest({ ...minimal, storage: { kind: "rclone" } })).toThrow(
      "remote control port",
    );
    expect(() =>
      parseManifest({ ...minimal, storage: { kind: "rclone", rc: 5572, config: "/etc/rclone" } }),
    ).toThrow("invalid path");
    expect(() =>
      parseManifest({ ...minimal, settings, storage: { ...ol, port: "${NOPE}" } }),
    ).toThrow("unknown setting NOPE");
    expect(() =>
      parseManifest({ ...minimal, settings, storage: { ...ol, port: undefined } }),
    ).toThrow("the port");
    expect(() =>
      parseManifest({ ...minimal, settings, storage: { ...ol, password: "secret" } }),
    ).toThrow("${KEY}");
    expect(() => parseManifest({ ...minimal, storage: { kind: "s3" } })).toThrow("storage.kind");
  });

  it("normalizes settings", () => {
    const m = parseManifest({
      ...minimal,
      settings: [
        { key: "PORT", type: "port", default: 80 },
        {
          key: "MODE",
          type: "select",
          options: ["a", { value: "b", label: { zh: "乙" } }],
          default: "b",
        },
      ],
    });
    expect(m.settings[0]).toMatchObject({
      key: "PORT",
      type: "port",
      default: "80",
      required: false,
    });
    expect(m.settings[1].options).toEqual([
      { value: "a", label: {} },
      { value: "b", label: { zh: "乙" } },
    ]);
  });

  it.each([
    [{ ...minimal, id: "Web" }, "invalid app id"],
    [{ ...minimal, docker: undefined }, "no deployment method"],
    [{ ...minimal, homepage: "ftp://x" }, "homepage"],
    [{ ...minimal, icon: "icon.gif" }, "icon"],
    [{ ...minimal, docker: { compose: "../compose.yaml" } }, "invalid path"],
    [{ ...minimal, settings: [{ key: "XDECK_HOME" }] }, "invalid setting key"],
    [{ ...minimal, settings: [{ key: "A" }, { key: "A" }] }, "duplicate setting"],
    [{ ...minimal, settings: [{ key: "A", type: "select" }] }, "needs options"],
    [{ ...minimal, settings: [{ key: "A", type: "port", default: 0 }] }, "default of A"],
    [{ ...minimal, settings: [{ key: "A", type: "number", generate: true }] }, "only text"],
    [
      { ...minimal, docker: { compose: "c.yaml", files: [{ source: "a", target: ".xdeck/x" }] } },
      "reserved",
    ],
    [
      { ...minimal, process: { platforms: ["windows"], unix: { install: "i.sh", start: "s.sh" } } },
      "no scripts for windows",
    ],
    [
      {
        ...minimal,
        process: { unix: { install: "i.sh", start: "s.sh" }, health_check: { type: "tcp" } },
      },
      "need a port",
    ],
    [
      { ...minimal, nginx: {}, process: { unix: { install: "i.sh", start: "s.sh" } } },
      "control script",
    ],
    [{ ...minimal, nginx: { service: "a b" } }, "invalid nginx service"],
  ])("rejects %#", (raw, message) => {
    expect(() => parseManifest(raw)).toThrow(ManifestError);
    expect(() => parseManifest(raw)).toThrow(message);
  });
});

describe("helpers", () => {
  const m = parseManifest({
    ...minimal,
    icon: "icon.svg",
    process: {
      unix: { install: "p/install.sh", start: "p/start.sh", lib: ["p/lib.sh"] },
      windows: { install: "p/install.ps1", start: "p/start.ps1", update: "p/update.ps1" },
      files: [{ source: "p/conf", target: "conf" }],
    },
  });

  it("lists referenced files", () => {
    expect(referencedFiles(m)).toEqual([
      "compose.yaml",
      "icon.svg",
      "p/conf",
      "p/install.ps1",
      "p/install.sh",
      "p/lib.sh",
      "p/start.ps1",
      "p/start.sh",
      "p/update.ps1",
    ]);
  });

  it("derives methods and platforms", () => {
    expect(methodsOf(m)).toEqual(["docker", "process"]);
    expect(supportedPlatforms(m.process!)).toEqual(["linux", "macos", "windows"]);
    expect(supportedPlatforms({ ...m.process!, platforms: ["linux"] })).toEqual(["linux"]);
  });

  it("checks values like the daemon", () => {
    const port = parseManifest({ ...minimal, settings: [{ key: "P", type: "port" }] }).settings[0];
    expect(checkValue(port, "8080")).toBeNull();
    expect(checkValue(port, "70000")).not.toBeNull();
    expect(checkValue(port, "a\nb")).toBe("must be a single line");
  });

  it("picks localized text", () => {
    expect(pick({ en: "Hi", zh: "你好" }, "zh-CN")).toBe("你好");
    expect(pick({ en: "Hi" }, "zh")).toBe("Hi");
    expect(pick({ fr: "Salut" }, "zh")).toBe("Salut");
    expect(pick(undefined, "en")).toBe("");
  });

  it("parses repository metadata", () => {
    expect(parseMeta(undefined)).toEqual({ format: 1, name: null, description: {} });
    expect(parseMeta({ name: "Mine", description: "Apps" })).toEqual({
      format: 1,
      name: "Mine",
      description: { en: "Apps" },
    });
    expect(() => parseMeta({ format: 2 })).toThrow("not supported");
  });
});
