import { useState, useEffect } from "react";
import { wsClient } from "../../lib/ws-client";
import { Shield } from "lucide-react";
import { useI18n } from "../../i18n/use-i18n";

interface ToolPermission {
  id: number;
  toolName: string;
  decision: string;
  updatedAt: string;
}

interface ToolInfo {
  name: string;
  description: string;
  category: string;
}

export function ToolPermissions() {
  const { t } = useI18n();
  const [permissions, setPermissions] = useState<ToolPermission[]>([]);
  const [tools, setTools] = useState<ToolInfo[]>([]);

  useEffect(() => {
    wsClient.request<ToolPermission[]>("tools.permissions.list").then(setPermissions);
    wsClient.request<ToolInfo[]>("tools.list").then(setTools);
  }, []);

  async function handleChange(toolName: string, decision: string) {
    await wsClient.request("tools.permissions.update", { toolName, decision });
    const updated = await wsClient.request<ToolPermission[]>("tools.permissions.list");
    setPermissions(updated);
  }

  const permissionMap = new Map(permissions.map((p) => [p.toolName, p.decision]));

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Shield className="h-5 w-5 text-on-surface-secondary" />
        <h2 className="text-lg font-semibold">{t("settings.tools.title")}</h2>
      </div>
      <p className="text-sm text-on-surface-secondary mb-4">
        {t("settings.tools.description")} {t("settings.tools.askEachTimeHelp")}
      </p>
      <div className="space-y-2">
        {tools.map((tool) => {
          const current = permissionMap.get(tool.name) ?? "prompt";
          return (
            <div
              key={tool.name}
              className="flex items-center justify-between p-3 rounded-lg border border-border bg-surface-subtle"
            >
              <div>
                <p className="text-sm font-medium text-on-surface">{tool.name}</p>
                <p className="text-xs text-on-surface-tertiary">{tool.description}</p>
              </div>
              <select
                value={current}
                onChange={(e) => handleChange(tool.name, e.target.value)}
                className="text-xs rounded-md border border-border bg-surface-elevated px-2 py-1 text-on-surface-secondary"
                  style={{ colorScheme: "dark" }}
              >
                <option value="prompt">{t("settings.tools.askEachTime")}</option>
                <option value="allow">{t("settings.tools.alwaysAllow")}</option>
                <option value="deny">{t("settings.tools.alwaysDeny")}</option>
              </select>
            </div>
          );
        })}
        {tools.length === 0 && (
          <p className="text-sm text-on-surface-tertiary">{t("settings.tools.none")}</p>
        )}
      </div>
    </div>
  );
}
