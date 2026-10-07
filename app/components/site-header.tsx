import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { BrandMark } from "~/components/brand";
import { LanguageToggle } from "~/components/language-toggle";
import { ThemeToggle } from "~/components/theme-toggle";

export function SiteHeader() {
  const { t } = useTranslation();
  return (
    <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:px-6">
        <Link
          to="/"
          className="flex items-center gap-2 rounded-md font-semibold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <BrandMark />
          <span>{t("site.title")}</span>
        </Link>
        <div className="ml-auto flex items-center gap-1">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
