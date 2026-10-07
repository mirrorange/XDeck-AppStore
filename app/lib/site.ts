import type { TFunction } from "i18next";

export const OFFICIAL_URL = "https://appstore.xdeck.top";

/** URL to add this site as a Web repository in XDeck. */
export function repositoryUrl(): string {
  return typeof window === "undefined" ? OFFICIAL_URL : window.location.origin;
}

export function categoryLabel(t: TFunction, category: string): string {
  return t(`categories.${category}` as never, {
    defaultValue: category.charAt(0).toUpperCase() + category.slice(1),
  });
}
