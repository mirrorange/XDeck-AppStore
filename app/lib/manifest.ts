// The App Store repository format (version 1), mirrored from the XDeck
// daemon: manifest types in their normalized form plus the checks the
// daemon applies, so `pnpm build` rejects what XDeck would skip.

export const FORMAT = 1;
const MAX_ID = 63;
const MAX_SETTINGS = 64;

export type LocalizedText = Record<string, string>;
export type DeployMethod = "docker" | "process";
export type Platform = "linux" | "macos" | "windows";
export type SettingType = "string" | "password" | "number" | "port" | "boolean" | "select";

export const PLATFORMS: readonly Platform[] = ["linux", "macos", "windows"];
const SETTING_TYPES: readonly SettingType[] = [
  "string",
  "password",
  "number",
  "port",
  "boolean",
  "select",
];

export interface SettingOption {
  value: string;
  label: LocalizedText;
}

export interface Setting {
  key: string;
  type: SettingType;
  label: LocalizedText;
  description: LocalizedText;
  default: string | null;
  required: boolean;
  generate: boolean;
  install_only: boolean;
  options: SettingOption[];
  min: number | null;
  max: number | null;
  methods: DeployMethod[];
}

export interface FileDef {
  source: string;
  target: string;
}

export interface Scripts {
  install: string;
  start: string;
  configure: string | null;
  uninstall: string | null;
  lib: string[];
}

export interface HealthCheck {
  type: "tcp" | "http";
  host: string | null;
  port: string | null;
  url: string | null;
  grace_ms: number | null;
}

export interface Manifest {
  id: string;
  name: string;
  version: string;
  summary: LocalizedText;
  description: LocalizedText;
  icon: string | null;
  categories: string[];
  homepage: string | null;
  license: string | null;
  settings: Setting[];
  docker: { compose: string; files: FileDef[] } | null;
  process: {
    platforms: Platform[];
    unix: Scripts | null;
    windows: Scripts | null;
    files: FileDef[];
    health_check: HealthCheck | null;
  } | null;
}

export interface RepoMeta {
  format: number;
  name: string | null;
  description: LocalizedText;
}

/** An app of `index.json`: where its files are, their hashes and the manifest. */
export type IndexEntry = Manifest & { path: string; files: Record<string, string> };

export interface Index extends RepoMeta {
  apps: IndexEntry[];
}

export class ManifestError extends Error {}

function fail(message: string): never {
  throw new ManifestError(message);
}

type Raw = Record<string, unknown>;

function isObject(v: unknown): v is Raw {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function scalar(v: unknown, what: string): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return fail(`${what}: expected a scalar`);
}

function optionalScalar(v: unknown, what: string): string | null {
  return v === undefined || v === null ? null : scalar(v, what);
}

function optionalString(v: unknown, what: string): string | null {
  if (v === undefined || v === null) return null;
  return typeof v === "string" ? v : fail(`${what}: expected a string`);
}

function localized(v: unknown, what: string): LocalizedText {
  if (v === undefined || v === null) return {};
  if (typeof v === "string") return { en: v };
  if (isObject(v)) {
    return Object.fromEntries(
      Object.entries(v).map(([k, s]) => [k, typeof s === "string" ? s : fail(`${what}.${k}`)]),
    );
  }
  return fail(`${what}: expected text or a map of languages`);
}

function bool(v: unknown, what: string): boolean {
  if (v === undefined || v === null) return false;
  return typeof v === "boolean" ? v : fail(`${what}: expected true or false`);
}

function num(v: unknown, what: string): number | null {
  if (v === undefined || v === null) return null;
  return typeof v === "number" ? v : fail(`${what}: expected a number`);
}

function list(v: unknown, what: string): unknown[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : fail(`${what}: expected a list`);
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[], what: string): T {
  return allowed.includes(v as T) ? (v as T) : fail(`${what}: one of ${allowed.join(", ")}`);
}

export function isValidId(id: string): boolean {
  return id.length > 0 && id.length <= MAX_ID && /^[a-z0-9][a-z0-9-]*$/.test(id);
}

export function isValidKey(key: string): boolean {
  return key.length <= 64 && /^[A-Z_][A-Z0-9_]*$/.test(key) && !key.startsWith("XDECK_");
}

/** Relative, `/`-separated, without `.` or `..` components. */
export function checkRelativePath(path: string): void {
  const bad =
    path === "" ||
    path.startsWith("/") ||
    path.includes("\\") ||
    path.includes(":") ||
    path.split("/").some((c) => c === "" || c === "." || c === "..");
  if (bad) fail(`invalid path ${JSON.stringify(path)}`);
}

export function iconType(path: string): string | null {
  const ext = path.split(".").pop()?.toLowerCase();
  return ext === "svg"
    ? "image/svg+xml"
    : ext === "png"
      ? "image/png"
      : ext === "webp"
        ? "image/webp"
        : null;
}

/** Mirrors the daemon's value checks (used for defaults). */
export function checkValue(s: Setting, value: string): string | null {
  if (value.length > 4096) return "too long";
  if (/[\r\n\0]/.test(value)) return "must be a single line";
  switch (s.type) {
    case "number": {
      const n = Number(value);
      if (value.trim() === "" || !Number.isFinite(n)) return "not a number";
      if ((s.min !== null && n < s.min) || (s.max !== null && n > s.max)) return "out of range";
      return null;
    }
    case "port":
      return /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 65535
        ? null
        : "not a port (1-65535)";
    case "boolean":
      return value === "true" || value === "false" ? null : "must be true or false";
    case "select":
      return s.options.some((o) => o.value === value) ? null : "not one of the options";
    default:
      return null;
  }
}

function setting(raw: unknown, i: number): Setting {
  if (!isObject(raw)) fail(`settings[${i}]: expected a map`);
  const key = scalar(raw.key, `settings[${i}].key`);
  const what = `setting ${key}`;
  const options = list(raw.options, `${what}.options`).map((o) =>
    isObject(o)
      ? { value: scalar(o.value, `${what}.options`), label: localized(o.label, `${what}.options`) }
      : { value: scalar(o, `${what}.options`), label: {} },
  );
  return {
    key,
    type: raw.type === undefined ? "string" : oneOf(raw.type, SETTING_TYPES, `${what}.type`),
    label: localized(raw.label, `${what}.label`),
    description: localized(raw.description, `${what}.description`),
    default: optionalScalar(raw.default, `${what}.default`),
    required: bool(raw.required, `${what}.required`),
    generate: bool(raw.generate, `${what}.generate`),
    install_only: bool(raw.install_only, `${what}.install_only`),
    options,
    min: num(raw.min, `${what}.min`),
    max: num(raw.max, `${what}.max`),
    methods: list(raw.methods, `${what}.methods`).map((m) =>
      oneOf(m, ["docker", "process"] as const, `${what}.methods`),
    ),
  };
}

function files(v: unknown, what: string): FileDef[] {
  return list(v, what).map((f) => {
    if (!isObject(f)) fail(`${what}: expected { source, target }`);
    return {
      source: scalar(f.source, `${what}.source`),
      target: scalar(f.target, `${what}.target`),
    };
  });
}

function scripts(v: unknown, what: string): Scripts | null {
  if (v === undefined || v === null) return null;
  if (!isObject(v)) fail(`${what}: expected a map`);
  return {
    install: scalar(v.install, `${what}.install`),
    start: scalar(v.start, `${what}.start`),
    configure: optionalString(v.configure, `${what}.configure`),
    uninstall: optionalString(v.uninstall, `${what}.uninstall`),
    lib: list(v.lib, `${what}.lib`).map((p) => scalar(p, `${what}.lib`)),
  };
}

/** Supported platforms: those with scripts, narrowed by `platforms`. */
export function supportedPlatforms(p: NonNullable<Manifest["process"]>): Platform[] {
  return PLATFORMS.filter(
    (x) =>
      (x === "windows" ? p.windows : p.unix) !== null &&
      (p.platforms.length === 0 || p.platforms.includes(x)),
  );
}

export function methodsOf(m: Manifest): DeployMethod[] {
  return [...(m.docker ? ["docker" as const] : []), ...(m.process ? ["process" as const] : [])];
}

/** Every file the manifest references, relative to its directory. */
export function referencedFiles(m: Manifest): string[] {
  const out = new Set<string>();
  if (m.icon) out.add(m.icon);
  if (m.docker) {
    out.add(m.docker.compose);
    for (const f of m.docker.files) out.add(f.source);
  }
  if (m.process) {
    for (const s of [m.process.unix, m.process.windows]) {
      if (!s) continue;
      for (const p of [s.install, s.start, s.configure, s.uninstall, ...s.lib]) if (p) out.add(p);
    }
    for (const f of m.process.files) out.add(f.source);
  }
  return [...out].sort();
}

/** Normalize and check a manifest parsed from `app.yaml`. */
export function parseManifest(raw: unknown): Manifest {
  if (!isObject(raw)) fail("expected a map");
  const docker = raw.docker;
  const process = raw.process;
  const m: Manifest = {
    id: scalar(raw.id, "id"),
    name: scalar(raw.name, "name"),
    version: scalar(raw.version, "version"),
    summary: localized(raw.summary, "summary"),
    description: localized(raw.description, "description"),
    icon: optionalString(raw.icon, "icon"),
    categories: list(raw.categories, "categories").map((c) => scalar(c, "categories")),
    homepage: optionalString(raw.homepage, "homepage"),
    license: optionalString(raw.license, "license"),
    settings: list(raw.settings, "settings").map(setting),
    docker:
      docker === undefined || docker === null
        ? null
        : isObject(docker)
          ? {
              compose: scalar(docker.compose, "docker.compose"),
              files: files(docker.files, "docker.files"),
            }
          : fail("docker: expected a map"),
    process:
      process === undefined || process === null
        ? null
        : isObject(process)
          ? {
              platforms: list(process.platforms, "process.platforms").map((p) =>
                oneOf(p, PLATFORMS, "process.platforms"),
              ),
              unix: scripts(process.unix, "process.unix"),
              windows: scripts(process.windows, "process.windows"),
              files: files(process.files, "process.files"),
              health_check: health(process.health_check),
            }
          : fail("process: expected a map"),
  };
  validate(m);
  return m;
}

function health(v: unknown): HealthCheck | null {
  if (v === undefined || v === null) return null;
  if (!isObject(v)) fail("process.health_check: expected a map");
  return {
    type: oneOf(v.type, ["tcp", "http"] as const, "process.health_check.type"),
    host: optionalString(v.host, "process.health_check.host"),
    port: optionalScalar(v.port, "process.health_check.port"),
    url: optionalString(v.url, "process.health_check.url"),
    grace_ms: num(v.grace_ms, "process.health_check.grace_ms"),
  };
}

function checkTargets(list: FileDef[]) {
  const seen = new Set<string>();
  for (const f of list) {
    checkRelativePath(f.target);
    if (f.target.startsWith(".xdeck")) fail(`${f.target} is reserved`);
    if (seen.has(f.target)) fail(`duplicate target ${f.target}`);
    seen.add(f.target);
  }
}

export function validate(m: Manifest): void {
  if (!isValidId(m.id)) fail(`invalid app id ${JSON.stringify(m.id)}`);
  if (!m.name.trim() || !m.version.trim()) fail("name and version are required");
  if (!m.docker && !m.process) fail("no deployment method (docker or process)");
  for (const c of m.categories) if (!isValidId(c)) fail(`invalid category ${JSON.stringify(c)}`);
  if (m.homepage && !/^https?:\/\//.test(m.homepage)) fail("homepage must be an http(s) URL");
  if (m.settings.length > MAX_SETTINGS) fail(`at most ${MAX_SETTINGS} settings`);
  const keys = new Set<string>();
  for (const s of m.settings) {
    if (!isValidKey(s.key)) fail(`invalid setting key ${JSON.stringify(s.key)}`);
    if (keys.has(s.key)) fail(`duplicate setting ${s.key}`);
    keys.add(s.key);
    if (s.type === "select" && s.options.length === 0) fail(`setting ${s.key} needs options`);
    if (s.generate && s.type !== "password" && s.type !== "string") {
      fail(`setting ${s.key}: only text settings can be generated`);
    }
    if (s.default !== null) {
      const error = checkValue(s, s.default);
      if (error) fail(`default of ${s.key}: ${error}`);
    }
  }
  for (const p of referencedFiles(m)) checkRelativePath(p);
  if (m.icon && !iconType(m.icon)) fail(`icon ${m.icon} must be .svg, .png or .webp`);
  if (m.docker) checkTargets(m.docker.files);
  if (m.process) {
    checkTargets(m.process.files);
    for (const p of m.process.platforms) {
      if ((p === "windows" ? m.process.windows : m.process.unix) === null)
        fail(`no scripts for ${p}`);
    }
    if (supportedPlatforms(m.process).length === 0) fail("process deployment without scripts");
    const h = m.process.health_check;
    if (h?.type === "tcp" && !h.port) fail("tcp health checks need a port");
    if (h?.type === "http" && !h.url) fail("http health checks need a url");
  }
}

export function parseMeta(raw: unknown): RepoMeta {
  if (raw === undefined || raw === null) return { format: FORMAT, name: null, description: {} };
  if (!isObject(raw)) fail("repository.yaml: expected a map");
  const format = raw.format === undefined ? FORMAT : Number(raw.format);
  if (!Number.isInteger(format) || format < 1 || format > FORMAT) {
    fail(`repository format ${String(raw.format)} is not supported`);
  }
  return {
    format,
    name: optionalString(raw.name, "name"),
    description: localized(raw.description, "description"),
  };
}

/** Text in `lang` (`zh-CN` matches `zh`), else English, else any. */
export function pick(text: LocalizedText | undefined, lang: string): string {
  if (!text) return "";
  const base = lang.toLowerCase().split("-")[0];
  return text[lang] ?? text[base] ?? text.en ?? Object.values(text)[0] ?? "";
}
