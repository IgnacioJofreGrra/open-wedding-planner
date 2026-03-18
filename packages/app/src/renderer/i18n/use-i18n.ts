import {
  useUiLanguageStore,
  type TranslationKey,
  type UILanguage,
} from "../stores/ui-language-store";

export function useI18n(): {
  language: UILanguage;
  setLanguage: (language: UILanguage) => void;
  t: (key: TranslationKey) => string;
} {
  const language = useUiLanguageStore((s) => s.language);
  const setLanguage = useUiLanguageStore((s) => s.setLanguage);
  const t = useUiLanguageStore((s) => s.t);

  return { language, setLanguage, t };
}
