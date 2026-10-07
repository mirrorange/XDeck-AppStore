// Checks every app of this repository: valid manifests, complete
// translations, Compose files that only use declared settings, scripts that
// parse, and library copies in sync with shared/.

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { methodsOf, referencedFiles, type LocalizedText } from "~/lib/manifest";
import { loadRepo } from "../scripts/repo";
import { outdated, sharedCopies } from "../scripts/sync-shared";

const root = join(import.meta.dirname, "..");
const repo = loadRepo(root);
const LANGS = ["en", "zh"];

const pwsh = ["pwsh", "powershell"].find((c) => spawnSync(c, ["-v"]).status === 0);

function translated(text: LocalizedText, what: string) {
  for (const lang of LANGS) expect(text[lang]?.trim(), `${what} (${lang})`).toBeTruthy();
}

describe("repository", () => {
  it("has an app.yaml in every app directory", () => {
    const dirs = readdirSync(join(root, "apps")).filter((d) =>
      statSync(join(root, "apps", d)).isDirectory(),
    );
    expect(dirs.length).toBeGreaterThan(0);
    for (const d of dirs) expect(existsSync(join(root, "apps", d, "app.yaml")), d).toBe(true);
    expect(repo.apps.map((a) => a.manifest.id)).toEqual(dirs.sort());
  });

  it("describes itself in every language", () => {
    translated(repo.meta.description, "repository description");
  });

  it("keeps library copies in sync with shared/", () => {
    const copies = sharedCopies(root);
    expect(copies.length).toBeGreaterThan(0);
    expect(outdated(copies).map((c) => c.to)).toEqual([]);
  });
});

describe.each(repo.apps.map((a) => [a.manifest.id, a] as const))("%s", (id, { dir, manifest }) => {
  it("is described in every language", () => {
    translated(manifest.summary, "summary");
    translated(manifest.description, "description");
    expect(manifest.icon).toBeTruthy();
    for (const s of manifest.settings) {
      translated(s.label, `${s.key} label`);
      for (const o of s.options) translated(o.label, `${s.key} option ${o.value}`);
    }
  });

  it("keeps data inside the app directory", () => {
    if (!manifest.docker) return;
    const compose = parse(readFileSync(join(dir, manifest.docker.compose), "utf8"));
    for (const [name, service] of Object.entries<Record<string, unknown>>(compose.services)) {
      for (const v of (service.volumes as string[] | undefined) ?? []) {
        expect(v, `${name} volume`).toMatch(/^\.\//);
      }
    }
  });

  it("uses only declared settings in Compose", () => {
    if (!manifest.docker) return;
    const text = readFileSync(join(dir, manifest.docker.compose), "utf8");
    const keys = new Set(manifest.settings.map((s) => s.key));
    // `$${...}` escapes interpolation; everything else must be a setting.
    const used = [...text.matchAll(/(?<!\$)\$\{([A-Z_][A-Z0-9_]*)/g)].map((m) => m[1]);
    for (const key of used) expect(keys.has(key), `${key} is not a setting`).toBe(true);
  });

  it("passes docker compose config", { skip: !hasCompose() }, () => {
    if (!manifest.docker) return;
    const env = Object.fromEntries(manifest.settings.map((s) => [s.key, s.default ?? "x"]));
    execFileSync("docker", ["compose", "-f", join(dir, manifest.docker.compose), "config", "-q"], {
      env: { ...process.env, ...env },
      stdio: "pipe",
    });
  });

  it("has shell scripts that parse", () => {
    for (const rel of referencedFiles(manifest).filter((f) => f.endsWith(".sh"))) {
      const r = spawnSync("bash", ["-n", join(dir, rel)], { encoding: "utf8" });
      expect(r.status, `${rel}: ${r.stderr}`).toBe(0);
    }
  });

  it.skipIf(!pwsh)("has PowerShell scripts that parse", () => {
    for (const rel of referencedFiles(manifest).filter((f) => f.endsWith(".ps1"))) {
      const cmd =
        "$e=$null; [System.Management.Automation.Language.Parser]::ParseFile($args[0],[ref]$null,[ref]$e) | Out-Null; if ($e) { $e | % { $_.ToString() }; exit 1 }";
      const r = spawnSync(pwsh!, ["-NoProfile", "-Command", cmd, join(dir, rel)], {
        encoding: "utf8",
      });
      expect(r.status, `${rel}: ${r.stdout}${r.stderr}`).toBe(0);
    }
  });

  it("offers a method", () => {
    expect(methodsOf(manifest).length).toBeGreaterThan(0);
  });
});

function hasCompose(): boolean {
  return spawnSync("docker", ["compose", "version"]).status === 0;
}
