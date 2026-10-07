import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en";
import zh from "./zh";

export const languages = [
  { code: "en", label: "English" },
  { code: "zh", label: "简体中文" },
] as const;

export type Language = (typeof languages)[number]["code"];

const STORAGE_KEY = "xdeck-appstore.language";

export const resources = {
  en: { translation: en },
  zh: { translation: zh },
} as const;

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    resources: { translation: typeof en };
  }
}

/** Pick the stored language, else the browser preference, else English. */
export function detectLanguage(stored: string | null, preferred: readonly string[]): Language {
  if (stored === "en" || stored === "zh") return stored;
  for (const tag of preferred) {
    const base = tag.toLowerCase().split("-")[0];
    if (base === "zh") return "zh";
    if (base === "en") return "en";
  }
  return "en";
}

void i18n.use(initReactI18next).init({
  resources,
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  returnNull: false,
});

/** Apply the detected language on the client (never during the build-time render). */
export function initClientLanguage() {
  if (typeof window === "undefined") return;
  const lang = detectLanguage(localStorage.getItem(STORAGE_KEY), navigator.languages ?? []);
  void setLanguage(lang, false);
}

export async function setLanguage(lang: Language, persist = true) {
  if (persist) localStorage.setItem(STORAGE_KEY, lang);
  document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  await i18n.changeLanguage(lang);
}

export default i18n;
