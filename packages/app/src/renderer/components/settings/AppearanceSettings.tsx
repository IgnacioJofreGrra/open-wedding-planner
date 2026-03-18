import { Monitor, Moon, Sun } from "lucide-react";
import { useThemeStore } from "../../stores/theme-store";
import { useI18n } from "../../i18n/use-i18n";

const options = [
  {
    value: "system" as const,
    labelKey: "appearance.theme.system" as const,
    icon: Monitor,
  },
  {
    value: "light" as const,
    labelKey: "appearance.theme.light" as const,
    icon: Sun,
  },
  {
    value: "dark" as const,
    labelKey: "appearance.theme.dark" as const,
    icon: Moon,
  },
];

export function AppearanceSettings() {
  const { preference, setPreference } = useThemeStore();
  const { language, setLanguage, t } = useI18n();

  return (
    <div>
      <h2 className="text-lg font-semibold text-on-surface">{t("appearance.title")}</h2>
      <p className="mt-1 text-sm text-on-surface-tertiary">
        {t("appearance.description")}
      </p>
      <div className="mt-3 inline-flex rounded-lg border border-border bg-surface-elevated p-1 gap-1">
        {options.map(({ value, labelKey, icon: Icon }) => (
          <button
            key={value}
            onClick={() => setPreference(value)}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              preference === value
                ? "bg-surface-active text-on-surface"
                : "text-on-surface-tertiary hover:text-on-surface-secondary"
            }`}
          >
            <Icon className="h-4 w-4" />
            {t(labelKey)}
          </button>
        ))}
      </div>

      <div className="mt-5">
        <label className="block text-sm font-medium text-on-surface">
          {t("appearance.language.label")}
        </label>
        <p className="mt-1 text-sm text-on-surface-tertiary">
          {t("appearance.language.description")}
        </p>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as "es" | "en")}
          className="mt-2 w-full max-w-xs rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm text-on-surface"
            style={{ colorScheme: "dark" }}
        >
          <option value="es">{t("appearance.language.option.es")}</option>
          <option value="en">{t("appearance.language.option.en")}</option>
        </select>
      </div>
    </div>
  );
}
