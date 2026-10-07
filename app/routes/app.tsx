import { ArrowLeftIcon, ExternalLinkIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";
import { AppIcon } from "~/components/app-icon";
import { MethodBadge, PlatformBadge } from "~/components/badges";
import { CopyField } from "~/components/copy-field";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Empty, EmptyContent, EmptyHeader, EmptyTitle } from "~/components/ui/empty";
import { Skeleton } from "~/components/ui/skeleton";
import { Spinner } from "~/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { fileUrl, iconUrl, reviewFiles, useCatalog } from "~/lib/catalog";
import { methodsOf, pick, supportedPlatforms, type IndexEntry, type Setting } from "~/lib/manifest";
import { categoryLabel, repositoryUrl } from "~/lib/site";

export default function AppPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const catalog = useCatalog();

  if (catalog.status === "loading") {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-16 w-80 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }
  const app = catalog.status === "ready" ? catalog.index.apps.find((a) => a.id === id) : undefined;
  if (!app) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>
            {catalog.status === "error" ? t("catalog.error") : t("app.notFound")}
          </EmptyTitle>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" render={<Link to="/" />} nativeButton={false}>
            {t("common.back")}
          </Button>
        </EmptyContent>
      </Empty>
    );
  }
  return <AppDetail app={app} />;
}

function AppDetail({ app }: { app: IndexEntry }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const description = pick(app.description, lang);
  useEffect(() => {
    document.title = `${app.name} · ${t("site.title")}`;
  }, [app.name, t]);

  return (
    <div className="flex flex-col gap-6">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 self-start text-muted-foreground"
        render={<Link to="/" />}
        nativeButton={false}
      >
        <ArrowLeftIcon data-icon="inline-start" />
        {t("common.back")}
      </Button>

      <header className="flex flex-wrap items-start gap-4">
        <AppIcon src={iconUrl(app)} name={app.name} className="size-16 rounded-xl" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h1 className="flex items-baseline gap-2 text-2xl font-semibold tracking-tight">
            {app.name}
            <span className="text-sm font-normal text-muted-foreground">{app.version}</span>
          </h1>
          <p className="text-muted-foreground">{pick(app.summary, lang)}</p>
          <div className="flex flex-wrap gap-1">
            {methodsOf(app).map((m) => (
              <MethodBadge key={m} method={m} />
            ))}
          </div>
        </div>
        {app.homepage && (
          <Button
            variant="outline"
            render={<a href={app.homepage} target="_blank" rel="noreferrer" />}
            nativeButton={false}
          >
            {t("app.homepage")}
            <ExternalLinkIcon data-icon="inline-end" />
          </Button>
        )}
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex min-w-0 flex-col gap-6">
          {description && (
            <p className="leading-relaxed whitespace-pre-line text-foreground/90">{description}</p>
          )}
          <SettingsCard app={app} />
          <FilesCard app={app} />
        </div>
        <aside className="flex flex-col gap-4">
          <Card size="sm">
            <CardContent>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-sm">
                <Fact label={t("app.version")}>{app.version}</Fact>
                {app.license && <Fact label={t("app.license")}>{app.license}</Fact>}
                <Fact label={t("app.methods")}>
                  <div className="flex flex-wrap gap-1">
                    {methodsOf(app).map((m) => (
                      <MethodBadge key={m} method={m} />
                    ))}
                  </div>
                </Fact>
                {app.process && (
                  <Fact label={t("app.platforms")}>
                    <div className="flex flex-wrap gap-1">
                      {supportedPlatforms(app.process).map((p) => (
                        <PlatformBadge key={p} platform={p} />
                      ))}
                    </div>
                  </Fact>
                )}
                {app.categories.length > 0 && (
                  <Fact label={t("catalog.category")}>
                    <div className="flex flex-wrap gap-1">
                      {app.categories.map((c) => (
                        <Link key={c} to={`/?category=${encodeURIComponent(c)}`}>
                          <Badge variant="outline">{categoryLabel(t, c)}</Badge>
                        </Link>
                      ))}
                    </div>
                  </Fact>
                )}
              </dl>
            </CardContent>
          </Card>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">{t("repo.add")}</span>
            <CopyField value={repositoryUrl()} label={t("repo.url")} />
            <span className="text-xs text-muted-foreground">{t("repo.hint")}</span>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </>
  );
}

function SettingsCard({ app }: { app: IndexEntry }) {
  const { t } = useTranslation();
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{t("app.settings")}</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        {app.settings.length === 0 ? (
          <p className="px-4 text-sm text-muted-foreground">{t("app.noSettings")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="px-4 pb-2 font-medium">{t("app.setting")}</th>
                  <th className="px-4 pb-2 font-medium">{t("app.default")}</th>
                  <th className="px-4 pb-2" />
                </tr>
              </thead>
              <tbody>
                {app.settings.map((s) => (
                  <SettingRow key={s.key} setting={s} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function defaultText(s: Setting, t: ReturnType<typeof useTranslation>["t"], lang: string): string {
  if (s.generate) return t("app.generated");
  if (s.default === null || s.default === "") return "—";
  if (s.type === "boolean") return s.default === "true" ? t("app.yes") : t("app.no");
  if (s.type === "select") {
    const option = s.options.find((o) => o.value === s.default);
    return pick(option?.label, lang) || s.default;
  }
  return s.type === "password" ? "••••••" : s.default;
}

function SettingRow({ setting: s }: { setting: Setting }) {
  const { t, i18n } = useTranslation();
  const description = pick(s.description, i18n.language);
  return (
    <tr className="border-b align-top last:border-0" data-setting={s.key}>
      <td className="px-4 py-2.5">
        <div className="font-medium">{pick(s.label, i18n.language) || s.key}</div>
        <code className="font-mono text-xs text-muted-foreground">{s.key}</code>
        {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      </td>
      <td className="px-4 py-2.5 font-mono text-xs whitespace-nowrap">
        {defaultText(s, t, i18n.language)}
      </td>
      <td className="px-4 py-2.5">
        <div className="flex flex-wrap justify-end gap-1">
          {s.required && <Badge variant="outline">{t("app.required")}</Badge>}
          {s.install_only && <Badge variant="outline">{t("app.installOnly")}</Badge>}
          {s.methods.length === 1 && (
            <Badge variant="secondary">
              {t("app.onlyFor", { method: t(`methods.${s.methods[0]}`) })}
            </Badge>
          )}
        </div>
      </td>
    </tr>
  );
}

function FilesCard({ app }: { app: IndexEntry }) {
  const { t } = useTranslation();
  const files = reviewFiles(app);
  const [selected, setSelected] = useState(files[0]?.path);
  const [text, setText] = useState<{ path: string; body: string } | null>(null);

  useEffect(() => {
    if (!selected) return;
    let live = true;
    fetch(fileUrl(app, selected))
      .then((r) => (r.ok ? r.text() : `HTTP ${r.status}`))
      .catch((e: unknown) => String(e))
      .then((body) => live && setText({ path: selected, body }));
    return () => {
      live = false;
    };
  }, [app, selected]);

  if (files.length === 0) return null;
  return (
    <Card size="sm">
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>{t("app.files")}</CardTitle>
        <ToggleGroup
          variant="outline"
          size="sm"
          value={selected ? [selected] : []}
          onValueChange={(v) => v[0] && setSelected(v[0])}
          className="flex-wrap"
        >
          {files.map((f) => (
            <ToggleGroupItem key={f.path} value={f.path} className="font-mono text-xs">
              {f.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </CardHeader>
      <CardContent>
        {text?.path === selected ? (
          <pre className="max-h-[28rem] overflow-auto rounded-lg bg-muted p-3 font-mono text-xs leading-relaxed">
            {text.body}
          </pre>
        ) : (
          <div className="flex h-24 items-center justify-center text-muted-foreground">
            <Spinner />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
