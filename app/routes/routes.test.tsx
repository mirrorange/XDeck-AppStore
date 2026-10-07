import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "~/lib/i18n";
import { CatalogContext, type CatalogState } from "~/lib/catalog";
import { parseManifest, type Index } from "~/lib/manifest";
import AppPage from "./app";
import Home from "./home";

const entry = (raw: Record<string, unknown>) => ({
  ...parseManifest(raw),
  path: `apps/${String(raw.id)}`,
  files: {},
});

const index: Index = {
  format: 1,
  name: "XDeck",
  description: { en: "Official XDeck App Store", zh: "XDeck 官方应用商店" },
  apps: [
    entry({
      id: "redis",
      name: "Redis",
      version: "8.2",
      summary: { en: "In-memory store", zh: "内存数据库" },
      categories: ["database", "cache"],
      docker: { compose: "docker/compose.yaml" },
      process: { platforms: ["linux"], unix: { install: "p/install.sh", start: "p/start.sh" } },
      settings: [
        { key: "PORT", type: "port", default: 6379, label: { en: "Port", zh: "端口" } },
        {
          key: "PASS",
          type: "password",
          generate: true,
          install_only: true,
          label: { en: "Password" },
        },
      ],
    }),
    entry({
      id: "nginx",
      name: "Nginx",
      version: "1.30",
      summary: { en: "Web server" },
      categories: ["web"],
      docker: { compose: "docker/compose.yaml" },
    }),
  ],
};

function renderAt(path: string, state: CatalogState = { status: "ready", index }) {
  const Stub = createRoutesStub([
    { path: "/", Component: Home },
    { path: "/app/:id", Component: AppPage },
  ]);
  return render(
    <CatalogContext value={state}>
      <Stub initialEntries={[path]} />
    </CatalogContext>,
  );
}

beforeAll(async () => {
  await i18n.changeLanguage("en");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("services: {}\n")));
});

describe("catalog page", () => {
  it("lists apps with their methods", async () => {
    renderAt("/");
    expect(await screen.findByText("Redis")).toBeInTheDocument();
    expect(screen.getByText("Nginx")).toBeInTheDocument();
    expect(screen.getByText("2 apps")).toBeInTheDocument();
    expect(screen.getByText("Official XDeck App Store")).toBeInTheDocument();
    expect(screen.getByLabelText("Repository URL")).toHaveValue(window.location.origin);
  });

  it("filters by search and category", async () => {
    renderAt("/");
    fireEvent.change(await screen.findByLabelText("Search apps"), {
      target: { value: "web serv" },
    });
    expect(screen.queryByText("Redis")).toBeNull();
    expect(screen.getByText("Nginx")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search apps"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Caching" }));
    expect(screen.getByText("Redis")).toBeInTheDocument();
    expect(screen.queryByText("Nginx")).toBeNull();
  });

  it("offers a retry when the catalog cannot load", async () => {
    const retry = vi.fn();
    renderAt("/", { status: "error", error: "HTTP 500", retry });
    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalled();
  });

  it("follows the language", async () => {
    await i18n.changeLanguage("zh");
    renderAt("/");
    expect(await screen.findByText("内存数据库")).toBeInTheDocument();
    expect(screen.getByText("2 个应用")).toBeInTheDocument();
    await i18n.changeLanguage("en");
  });
});

describe("app page", () => {
  it("shows settings, platforms and files", async () => {
    renderAt("/app/redis");
    expect(await screen.findByRole("heading", { name: /Redis/ })).toBeInTheDocument();
    expect(screen.getByText("Linux")).toBeInTheDocument();
    const port = document.querySelector('[data-setting="PORT"]')!;
    expect(port).toHaveTextContent("Port");
    expect(port).toHaveTextContent("6379");
    const pass = document.querySelector('[data-setting="PASS"]')!;
    expect(pass).toHaveTextContent("Generated");
    expect(pass).toHaveTextContent("Set at install");
    await waitFor(() => expect(screen.getByText("services: {}")).toBeInTheDocument());
    expect(fetch).toHaveBeenCalledWith("/apps/redis/docker/compose.yaml");
  });

  it("reports unknown apps", async () => {
    renderAt("/app/nope");
    expect(await screen.findByText("App not found")).toBeInTheDocument();
  });
});
