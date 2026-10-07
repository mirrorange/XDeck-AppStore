// Copy shared/lib.sh and shared/lib.ps1 into every app that lists them as a
// script library. App directories must be self-contained (the daemon only
// reads files inside an app's directory), so each app carries a copy.
//
//   tsx scripts/sync-shared.ts [--check]

import { copyFileSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { loadRepo } from "./repo";

export interface Copy {
  from: string;
  to: string;
}

/** Library copies an app is expected to carry: any `lib` named like a shared file. */
export function sharedCopies(root: string): Copy[] {
  const shared = ["lib.sh", "lib.ps1"];
  const out: Copy[] = [];
  for (const app of loadRepo(root, { checkFiles: false }).apps) {
    const process = app.manifest.process;
    for (const scripts of [process?.unix, process?.windows]) {
      for (const lib of scripts?.lib ?? []) {
        const name = basename(lib);
        if (shared.includes(name))
          out.push({ from: join(root, "shared", name), to: join(app.dir, lib) });
      }
    }
  }
  return out;
}

export function outdated(copies: Copy[]): Copy[] {
  return copies.filter((c) => {
    try {
      return !readFileSync(c.from).equals(readFileSync(c.to));
    } catch {
      return true;
    }
  });
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename);
if (isMain) {
  const root = resolve(".");
  const stale = outdated(sharedCopies(root));
  if (process.argv.includes("--check")) {
    for (const c of stale) console.error(`out of date: ${c.to}`);
    process.exit(stale.length ? 1 : 0);
  }
  for (const c of stale) {
    copyFileSync(c.from, c.to);
    console.log(`updated ${c.to}`);
  }
}
