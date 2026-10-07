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
    });
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
      windows: { install: "p/install.ps1", start: "p/start.ps1" },
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
