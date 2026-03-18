import { create } from "zustand";
import { en } from "../i18n/en";
import { es } from "../i18n/es";

export type UILanguage = "es" | "en";
export type TranslationKey = keyof typeof en;

type Dictionary = Record<TranslationKey, string>;

const dictionaries: Record<UILanguage, Dictionary> = {
  en,
  es,
};

const STORAGE_KEY = "ui-language";
const DEFAULT_LANGUAGE: UILanguage = "es";

interface UiLanguageStore {
  language: UILanguage;
  setLanguage: (language: UILanguage) => void;
  t: (key: TranslationKey) => string;
}

function applyDocumentLanguage(language: UILanguage) {
  document.documentElement.setAttribute("lang", language);
}

function getInitialLanguage(): UILanguage {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "es" || saved === "en") {
    return saved;
  }
  return DEFAULT_LANGUAGE;
}

const initialLanguage = getInitialLanguage();
applyDocumentLanguage(initialLanguage);

export const useUiLanguageStore = create<UiLanguageStore>((set, get) => ({
  language: initialLanguage,
  setLanguage: (language) => {
    localStorage.setItem(STORAGE_KEY, language);
    applyDocumentLanguage(language);
    set({ language });
  },
  t: (key) => {
    const { language } = get();
    return dictionaries[language][key] ?? dictionaries.en[key] ?? key;
  },
}));

window.addEventListener("storage", (e) => {
  if (e.key !== STORAGE_KEY || !e.newValue) return;
  if (e.newValue !== "es" && e.newValue !== "en") return;

  const language = e.newValue as UILanguage;
  applyDocumentLanguage(language);
  useUiLanguageStore.setState({ language });
});
