// The catalog the site shows: the repository's own `index.json`, the same
// file XDeck reads when this site is added as a Web repository.

import { createContext, useContext } from "react";
import { methodsOf, pick, type Index, type IndexEntry, type Manifest } from "./manifest";

export const INDEX_URL = "/index.json";

export async function fetchIndex(fetcher: typeof fetch = fetch): Promise<Index> {
  const res = await fetcher(INDEX_URL, { cache: "no-cache" });
  if (!res.ok) throw new Error(`${INDEX_URL}: HTTP ${res.status}`);
  return (await res.json()) as Index;
}

export type CatalogState =
  | { status: "loading" }
  | { status: "error"; error: string; retry: () => void }
  | { status: "ready"; index: Index };

export const CatalogContext = createContext<CatalogState>({ status: "loading" });

export function useCatalog(): CatalogState {
  return useContext(CatalogContext);
}

/** URL of a file of an app, as published next to `index.json`. */
export function fileUrl(app: IndexEntry, rel: string): string {
  return `/${app.path}/${rel.split("/").map(encodeURIComponent).join("/")}`;
}

export function iconUrl(app: IndexEntry): string | null {
  return app.icon ? fileUrl(app, app.icon) : null;
}

export function appPath(app: Pick<Manifest, "id">): string {
  return `/app/${encodeURIComponent(app.id)}`;
}

/** Categories in order of first appearance. */
export function categoriesOf(apps: readonly Manifest[]): string[] {
  return [...new Set(apps.flatMap((a) => a.categories))];
}

export function matchesApp(app: Manifest, query: string, lang: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [app.id, app.name, pick(app.summary, lang), ...app.categories, ...methodsOf(app)].some(
    (s) => s.toLowerCase().includes(q),
  );
}

/** Files worth reviewing before installing, in a stable order. */
export function reviewFiles(app: Manifest): { label: string; path: string }[] {
  const out: { label: string; path: string }[] = [];
  const add = (path: string | null | undefined) => {
    if (path && !out.some((f) => f.path === path))
      out.push({ label: path.split("/").pop()!, path });
  };
  if (app.docker) add(app.docker.compose);
  for (const s of [app.process?.unix, app.process?.windows]) {
    if (!s) continue;
    for (const p of [s.install, s.configure, s.start, s.uninstall]) add(p);
  }
  // Same base name from different directories: show the full path.
  return out.map((f) =>
    out.filter((o) => o.label === f.label).length > 1 ? { ...f, label: f.path } : f,
  );
}
