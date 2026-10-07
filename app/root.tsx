import { ThemeProvider } from "next-themes";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";
import { BrandMark } from "~/components/brand";
import { SiteHeader } from "~/components/site-header";
import { Spinner } from "~/components/ui/spinner";
import { TooltipProvider } from "~/components/ui/tooltip";
import { CatalogContext, fetchIndex, type CatalogState } from "~/lib/catalog";
import { initClientLanguage } from "~/lib/i18n";

// Runs before hydration on the client; a no-op during the build-time render.
initClientLanguage();

export const meta: Route.MetaFunction = () => [
  { title: "XDeck App Store" },
  { name: "description", content: "Apps you can deploy with XDeck." },
];

export const links: Route.LinksFunction = () => [{ rel: "icon", href: "/favicon.ico" }];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export function HydrateFallback() {
  return (
    <div className="flex min-h-svh items-center justify-center text-muted-foreground">
      <Spinner />
    </div>
  );
}

function useIndex(): CatalogState {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<CatalogState>({ status: "loading" });
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  useEffect(() => {
    let live = true;
    setState({ status: "loading" });
    fetchIndex().then(
      (index) => live && setState({ status: "ready", index }),
      (e: unknown) => live && setState({ status: "error", error: String(e), retry }),
    );
    return () => {
      live = false;
    };
  }, [attempt, retry]);
  return state;
}

export default function App() {
  const catalog = useIndex();
  return (
    <CatalogContext value={catalog}>
      <TooltipProvider>
        <Shell>
          <Outlet />
        </Shell>
      </TooltipProvider>
    </CatalogContext>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const { t } = useTranslation();
  let message = t("errors.generic");
  let details: string | undefined;
  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? t("errors.pageNotFound") : `${error.status}`;
    details = error.statusText || undefined;
  } else if (error instanceof Error) {
    details = error.message;
  }
  return (
    <main className="mx-auto flex min-h-svh max-w-xl flex-col justify-center gap-3 p-6">
      <BrandMark className="size-8 text-muted-foreground" />
      <h1 className="text-xl font-semibold">{message}</h1>
      {details && <p className="text-muted-foreground">{details}</p>}
    </main>
  );
}
