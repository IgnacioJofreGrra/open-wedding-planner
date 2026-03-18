import { useState, useEffect } from "react";
import { wsClient } from "../../lib/ws-client";
import { useI18n } from "../../i18n/use-i18n";

interface HeartbeatConfig {
  enabled: number;
  prompt: string | null;
  intervalMinutes: number;
  lastRunAt: string | null;
}

const INTERVAL_OPTIONS = [15, 30, 60, 120] as const;

export function HeartbeatSettings() {
  const { t } = useI18n();
  const [config, setConfig] = useState<HeartbeatConfig | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [intervalMinutes, setIntervalMinutes] = useState(30);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    wsClient
      .request<HeartbeatConfig>("heartbeat-config.get")
      .then((cfg) => {
        setConfig(cfg);
        setEnabled(!!cfg.enabled);
        setPrompt(cfg.prompt ?? "");
        setIntervalMinutes(cfg.intervalMinutes);
      })
      .catch(() => {});
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await wsClient.request<HeartbeatConfig>(
        "heartbeat-config.update",
        { enabled, prompt: prompt || null, intervalMinutes },
      );
      setConfig(updated);
    } finally {
      setSaving(false);
    }
  }

  if (!config) return null;

  const dirty =
    enabled !== !!config.enabled ||
    (prompt || null) !== config.prompt ||
    intervalMinutes !== config.intervalMinutes;

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">{t("settings.heartbeat.title")}</h2>
      <div className="space-y-4">
        {/* Enable toggle */}
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 rounded accent-accent"
          />
          <div>
            <p className="text-sm font-medium text-on-surface">
              {t("settings.heartbeat.enable")}
            </p>
            <p className="text-xs text-on-surface-secondary">
              {t("settings.heartbeat.description")}
            </p>
          </div>
        </label>

        {/* Prompt */}
        <div className="space-y-2">
          <label className="block text-sm text-on-surface-secondary">{t("settings.heartbeat.prompt")}</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t("settings.heartbeat.promptPlaceholder")}
            rows={4}
            className="w-full rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm text-on-surface placeholder-placeholder focus:border-accent focus:outline-none resize-y"
          />
        </div>

        {/* Interval */}
        <div className="space-y-2">
          <label className="block text-sm text-on-surface-secondary">{t("settings.heartbeat.frequency")}</label>
          <select
            value={intervalMinutes}
            onChange={(e) => setIntervalMinutes(Number(e.target.value))}
            className="w-full rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm text-on-surface focus:border-accent focus:outline-none"
              style={{ colorScheme: "dark" }}
          >
            {INTERVAL_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value === 15 && t("settings.heartbeat.every15")}
                {value === 30 && t("settings.heartbeat.every30")}
                {value === 60 && t("settings.heartbeat.every60")}
                {value === 120 && t("settings.heartbeat.every120")}
              </option>
            ))}
          </select>
        </div>

        {/* Last run info */}
        {config.lastRunAt && (
          <p className="text-xs text-on-surface-tertiary">
            {t("settings.heartbeat.lastRun")}: {new Date(config.lastRunAt).toLocaleString()}
          </p>
        )}

        {/* Save button */}
        {dirty && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >
            {saving ? t("settings.search.saving") : t("settings.search.save")}
          </button>
        )}
      </div>
    </div>
  );
}
