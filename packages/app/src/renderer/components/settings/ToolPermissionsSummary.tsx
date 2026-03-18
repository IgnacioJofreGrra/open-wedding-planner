import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, ChevronRight } from "lucide-react";
import { wsClient } from "../../lib/ws-client";
import { useI18n } from "../../i18n/use-i18n";

interface ToolInfo {
  name: string;
  description: string;
  category: string;
}

interface ToolPermission {
  id: number;
  toolName: string;
  decision: string;
  updatedAt: string;
}

export function ToolPermissionsSummary() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [toolCount, setToolCount] = useState(0);
  const [customized, setCustomized] = useState(0);

  useEffect(() => {
    wsClient.request<ToolInfo[]>("tools.list").then((t) => setToolCount(t.length));
    wsClient
      .request<ToolPermission[]>("tools.permissions.list")
      .then((p) => setCustomized(p.filter((x) => x.decision !== "prompt").length));
  }, []);

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Shield className="h-5 w-5 text-on-surface-secondary" />
        <h2 className="text-lg font-semibold">{t("settings.tools.title")}</h2>
      </div>
      <p className="text-sm text-on-surface-secondary mb-3">
        {t("settings.tools.description")}
      </p>
      <button
        onClick={() => navigate("/settings/tools")}
        className="flex w-full items-center justify-between rounded-lg border border-border bg-surface-subtle p-3 text-sm text-on-surface transition-colors hover:bg-surface-hover"
      >
        <span>
          {toolCount} {t("settings.tools.registered")}{customized > 0 && `, ${customized} ${t("settings.tools.customized")}`}
        </span>
        <span className="flex items-center gap-1 text-on-surface-secondary">
          {t("settings.tools.manage")}
          <ChevronRight className="h-4 w-4" />
        </span>
      </button>
    </div>
  );
}
