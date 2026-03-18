import { useState } from "react";
import { Trash2 } from "lucide-react";
import { wsClient } from "../../lib/ws-client";
import { ConfirmDeleteDialog } from "../common/ConfirmDeleteDialog";
import { useI18n } from "../../i18n/use-i18n";

interface ClearGroup {
  key: string;
  label: string;
  description: string;
  method: string;
}

export function DataManagement() {
  const { t } = useI18n();
  const [clearing, setClearing] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const CLEAR_GROUPS: ClearGroup[] = [
    {
      key: "vendors",
      label: t("settings.data.vendors.label"),
      description: t("settings.data.vendors.description"),
      method: "data.clear-vendors",
    },
    {
      key: "research",
      label: t("settings.data.research.label"),
      description: t("settings.data.research.description"),
      method: "data.clear-research",
    },
    {
      key: "communications",
      label: t("settings.data.communications.label"),
      description: t("settings.data.communications.description"),
      method: "data.clear-communications",
    },
    {
      key: "tasks",
      label: t("settings.data.tasks.label"),
      description: t("settings.data.tasks.description"),
      method: "data.clear-tasks",
    },
  ];

  async function handleClear() {
    if (!clearing) return;
    const group = CLEAR_GROUPS.find((g) => g.key === clearing);
    if (!group) return;

    setLoading(true);
    try {
      await wsClient.request(group.method);
      setSuccess(group.key);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Failed to clear data:", err);
    } finally {
      setLoading(false);
      setClearing(null);
    }
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-1">{t("settings.data.title")}</h2>
      <p className="text-sm text-on-surface-secondary mb-4">
        {t("settings.data.description")}
      </p>

      <div className="space-y-3">
        {CLEAR_GROUPS.map((group) => (
          <div
            key={group.key}
            className="rounded-lg border border-border bg-surface-elevated px-4 py-3 flex items-center justify-between"
          >
            <div>
              <p className="text-sm font-medium text-on-surface">{group.label}</p>
              <p className="text-xs text-on-surface-secondary">{group.description}</p>
            </div>
            {success === group.key ? (
              <span className="text-xs text-success">{t("settings.data.cleared")}</span>
            ) : (
              <button
                onClick={() => setClearing(group.key)}
                className="flex items-center gap-1.5 rounded-lg bg-error-bg px-3 py-1.5 text-sm font-medium text-error hover:bg-error-bg/80 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t("settings.data.clear")}
              </button>
            )}
          </div>
        ))}
      </div>

      <ConfirmDeleteDialog
        open={clearing !== null}
        title={t("settings.data.dialog.title").replace("{{group}}", CLEAR_GROUPS.find((g) => g.key === clearing)?.label ?? "")}
        message={t("settings.data.dialog.message").replace("{{group}}", (CLEAR_GROUPS.find((g) => g.key === clearing)?.label ?? "").toLowerCase())}
        onConfirm={handleClear}
        onCancel={() => setClearing(null)}
        loading={loading}
      />
    </div>
  );
}
