import { SearchIcon, StoreIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";
import { AppIcon } from "~/components/app-icon";
import { MethodBadge } from "~/components/badges";
import { CopyField } from "~/components/copy-field";
import { Button } from "~/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "~/components/ui/input-group";
import { Skeleton } from "~/components/ui/skeleton";
import { appPath, categoriesOf, iconUrl, matchesApp, useCatalog } from "~/lib/catalog";
import { methodsOf, pick, type IndexEntry } from "~/lib/manifest";
import { categoryLabel, repositoryUrl } from "~/lib/site";

export default function Home() {
  const { t, i18n } = useTranslation();
  const catalog = useCatalog();
  const [search, setSearch] = useSearchParams();
  const [query, setQuery] = useState("");
  const category = search.get("category");
  const apps = catalog.status === "ready" ? catalog.index.apps : [];
  const categories = useMemo(() => categoriesOf(apps), [apps]);
  const visible = apps
    .filter((a) => !category || a.categories.includes(category))
    .filter((a) => matchesApp(a, query, i18n.language))
    .sort((a, b) => a.name.localeCompare(b.name));

  const setCategory = (c: string | null) =>
    setSearch(
      (p) => {
        if (c === null) p.delete("category");
        else p.set("category", c);
        return p;
      },
      { replace: true },
    );

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="flex max-w-xl flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("site.title")}</h1>
          <p className="text-muted-foreground">{t("site.tagline")}</p>
        </div>
        <div className="flex w-full flex-col gap-1.5 md:w-80">
          <span className="text-xs font-medium text-muted-foreground">{t("repo.add")}</span>
          <CopyField value={repositoryUrl()} label={t("repo.url")} />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <InputGroup className="w-full sm:max-w-64">
            <InputGroupInput
              placeholder={t("common.search")}
              aria-label={t("catalog.search")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
          </InputGroup>
          {categories.length > 1 && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("catalog.category")}>
              {[null, ...categories].map((c) => (
                <Button
                  key={c ?? "all"}
                  size="xs"
                  variant={category === c ? "secondary" : "ghost"}
                  aria-pressed={category === c}
                  onClick={() => setCategory(c)}
                >
                  {c ? categoryLabel(t, c) : t("common.all")}
                </Button>
              ))}
            </div>
          )}
          {catalog.status === "ready" && (
            <span className="ml-auto text-xs text-muted-foreground tabular-nums">
              {t("catalog.count", { count: visible.length })}
            </span>
          )}
        </div>

        {catalog.status === "loading" ? (
          <Grid>
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </Grid>
        ) : catalog.status === "error" ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <StoreIcon />
              </EmptyMedia>
              <EmptyTitle>{t("catalog.error")}</EmptyTitle>
              <EmptyDescription>{catalog.error}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="outline" onClick={catalog.retry}>
                {t("common.retry")}
              </Button>
            </EmptyContent>
          </Empty>
        ) : apps.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <StoreIcon />
              </EmptyMedia>
              <EmptyTitle>{t("catalog.empty")}</EmptyTitle>
            </EmptyHeader>
          </Empty>
        ) : visible.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">{t("catalog.noMatch")}</p>
        ) : (
          <Grid>
            {visible.map((app) => (
              <AppCard key={app.id} app={app} />
            ))}
          </Grid>
        )}
      </section>
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

function AppCard({ app }: { app: IndexEntry }) {
  const { i18n } = useTranslation();
  return (
    <Link
      to={appPath(app)}
      className="group rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Card
        size="sm"
        className="h-full transition-colors group-hover:bg-muted/40"
        data-app={app.id}
      >
        <CardHeader className="flex items-start gap-3">
          <AppIcon src={iconUrl(app)} name={app.name} className="size-11" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <CardTitle className="flex items-baseline gap-2">
              <span className="truncate">{app.name}</span>
              <span className="text-xs font-normal text-muted-foreground">{app.version}</span>
            </CardTitle>
            <CardDescription className="line-clamp-2 min-h-10">
              {pick(app.summary, i18n.language)}
            </CardDescription>
            <div className="mt-1 flex flex-wrap items-center gap-1">
              {methodsOf(app).map((m) => (
                <MethodBadge key={m} method={m} />
              ))}
            </div>
          </div>
        </CardHeader>
      </Card>
    </Link>
  );
}
