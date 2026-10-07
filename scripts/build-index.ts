// Publish the repository as a static Web repository under public/:
// public/index.json plus every file an app references, at the same path.
//
//   tsx scripts/build-index.ts [repo root] [output dir]

import { copyFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { referencedFiles } from "../app/lib/manifest";
import { buildIndex, loadRepo, type Repo } from "./repo";

export function publish(repo: Repo, out: string): void {
  const index = buildIndex(repo);
  rmSync(join(out, "apps"), { recursive: true, force: true });
  for (const app of repo.apps) {
    const entry = index.apps.find((a) => a.id === app.manifest.id)!;
    for (const rel of referencedFiles(app.manifest)) {
      const to = join(out, entry.path, rel);
      mkdirSync(dirname(to), { recursive: true });
      copyFileSync(join(app.dir, rel), to);
    }
  }
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "index.json"), JSON.stringify(index, null, 2) + "\n");
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename);
if (isMain) {
  const root = resolve(process.argv[2] ?? ".");
  const out = resolve(process.argv[3] ?? join(root, "public"));
  try {
    const repo = loadRepo(root);
    publish(repo, out);
    console.log(`index.json: ${repo.apps.map((a) => a.manifest.id).join(", ")}`);
  } catch (e) {
    console.error(`error: ${(e as Error).message}`);
    process.exit(1);
  }
}
