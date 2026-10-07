// Read and check a repository checkout: `repository.yaml` and
// `apps/<id>/app.yaml`. Shared by the index builder and the tests.

import { createHash } from "node:crypto";
import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { parse } from "yaml";
import {
  FORMAT,
  parseManifest,
  parseMeta,
  referencedFiles,
  type Index,
  type IndexEntry,
  type Manifest,
  type RepoMeta,
} from "../app/lib/manifest";

export const MAX_ICON = 1 << 20;
export const MAX_FILE = 32 << 20;

export interface App {
  dir: string;
  manifest: Manifest;
}

export interface Repo {
  root: string;
  meta: RepoMeta;
  apps: App[];
}

export function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Load every app; throws on the first problem (the daemon would skip it). */
export function loadRepo(root: string, { checkFiles = true } = {}): Repo {
  const metaFile = join(root, "repository.yaml");
  const meta = parseMeta(existsSync(metaFile) ? parse(readFileSync(metaFile, "utf8")) : undefined);
  const appsDir = join(root, "apps");
  const ids = readdirSync(appsDir)
    // Like the daemon: only directories with an app.yaml are apps.
    .filter(
      (d) => statSync(join(appsDir, d)).isDirectory() && existsSync(join(appsDir, d, "app.yaml")),
    )
    .sort();
  const apps = ids.map((id) => loadApp(root, join(appsDir, id), id, checkFiles));
  return { root, meta, apps };
}

function loadApp(root: string, dir: string, id: string, checkFiles: boolean): App {
  const file = join(dir, "app.yaml");
  const where = relative(root, file);
  let manifest: Manifest;
  try {
    manifest = parseManifest(parse(readFileSync(file, "utf8")));
  } catch (e) {
    throw new Error(`${where}: ${(e as Error).message}`);
  }
  if (manifest.id !== id) throw new Error(`${where}: id is ${manifest.id}, expected ${id}`);
  if (!checkFiles) return { dir, manifest };
  const realRoot = realpathSync(root);
  for (const rel of referencedFiles(manifest)) {
    const path = join(dir, rel);
    if (!existsSync(path)) throw new Error(`${id}: ${rel} is missing`);
    const real = realpathSync(path);
    if (!real.startsWith(realRoot + sep))
      throw new Error(`${id}: ${rel} is outside the repository`);
    const stat = lstatSync(real);
    if (!stat.isFile()) throw new Error(`${id}: ${rel} is not a file`);
    if (stat.size > MAX_FILE) throw new Error(`${id}: ${rel} is larger than 32 MiB`);
    if (rel === manifest.icon && stat.size > MAX_ICON) {
      throw new Error(`${id}: icon larger than 1 MiB`);
    }
  }
  return { dir, manifest };
}

/** The `index.json` of a Web repository: manifests, paths and file hashes. */
export function buildIndex(repo: Repo): Index {
  const apps: IndexEntry[] = repo.apps.map(({ dir, manifest }) => ({
    ...manifest,
    path: relative(repo.root, dir).split(sep).join("/"),
    files: Object.fromEntries(
      referencedFiles(manifest).map((rel) => [rel, sha256(readFileSync(join(dir, rel)))]),
    ),
  }));
  return { ...repo.meta, format: FORMAT, apps };
}
