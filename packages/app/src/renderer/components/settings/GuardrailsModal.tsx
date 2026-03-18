import { useState } from "react";
import { X } from "lucide-react";
import { useI18n } from "../../i18n/use-i18n";

interface DetectorConfig {
  enabled: boolean;
  [key: string]: unknown;
}

interface GuardrailsConfig {
  enabled: boolean;
  historySize: number;
  repeat: { enabled: boolean; warnThreshold: number; criticalThreshold: number };
  polling: { enabled: boolean; pollTools: string[]; warnThreshold: number; criticalThreshold: number };
  pingPong: { enabled: boolean; minCycles: number; stableOutcomeCycles: number };
  circuitBreaker: { enabled: boolean; maxStaleWindow: number };
}

function NumberField({
  label,
  value,
  onChange,
  min = 0,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  hint?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs text-on-surface-secondary">{label}</label>
      <input
        type="number"
        value={value}
        min={min}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-md border border-border bg-surface-elevated px-3 py-1.5 text-sm text-on-surface focus:border-accent focus:outline-none"
      />
      {hint && <p className="text-xs text-on-surface-faint">{hint}</p>}
    </div>
  );
}

function DetectorToggle({
  label,
  enabled,
  onChange,
}: {
  label: string;
  enabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={enabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 rounded accent-accent"
      />
      <span className="text-sm font-medium text-on-surface">{label}</span>
    </label>
  );
}

function DetectorSection({
  title,
  description,
  enabled,
  onToggle,
  children,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface-subtle p-4 space-y-3">
      <DetectorToggle label={title} enabled={enabled} onChange={onToggle} />
      <p className="text-xs text-on-surface-tertiary">{description}</p>
      {enabled && <div className="grid grid-cols-2 gap-3">{children}</div>}
    </div>
  );
}

export function GuardrailsModal({
  config,
  onSave,
  onClose,
}: {
  config: GuardrailsConfig;
  onSave: (config: GuardrailsConfig) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<GuardrailsConfig>(structuredClone(config));
  const [saving, setSaving] = useState(false);

  function update<K extends keyof GuardrailsConfig>(key: K, value: GuardrailsConfig[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function updateDetector<K extends keyof GuardrailsConfig>(
    key: K,
    field: string,
    value: unknown,
  ) {
    setDraft((prev) => ({
      ...prev,
      [key]: { ...(prev[key] as DetectorConfig), [field]: value },
    }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      onSave(draft);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-surface-overlay backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[85vh] rounded-xl border border-border bg-surface-dropdown shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-0">
          <h3 className="text-lg font-semibold text-on-surface">{t("settings.guardrails.modal.title")}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 hover:bg-surface-active transition-colors"
          >
            <X className="h-4 w-4 text-on-surface-secondary" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto p-5 space-y-4 flex-1">
          <NumberField
            label={t("settings.guardrails.modal.historySize")}
            value={draft.historySize}
            onChange={(v) => update("historySize", v)}
            min={5}
            hint={t("settings.guardrails.modal.historySizeHint")}
          />

          <DetectorSection
            title={t("settings.guardrails.modal.repeatDetector")}
            description={t("settings.guardrails.modal.repeatDesc")}
            enabled={draft.repeat.enabled}
            onToggle={(v) => updateDetector("repeat", "enabled", v)}
          >
            <NumberField
              label={t("settings.guardrails.modal.warnThreshold")}
              value={draft.repeat.warnThreshold}
              onChange={(v) => updateDetector("repeat", "warnThreshold", v)}
              min={1}
            />
            <NumberField
              label={t("settings.guardrails.modal.criticalThreshold")}
              value={draft.repeat.criticalThreshold}
              onChange={(v) => updateDetector("repeat", "criticalThreshold", v)}
              min={0}
              hint={t("settings.guardrails.modal.neverBlock")}
            />
          </DetectorSection>

          <DetectorSection
            title={t("settings.guardrails.modal.pollingDetector")}
            description={t("settings.guardrails.modal.pollingDesc")}
            enabled={draft.polling.enabled}
            onToggle={(v) => updateDetector("polling", "enabled", v)}
          >
            <div className="col-span-2 space-y-1">
              <label className="block text-xs text-on-surface-secondary">{t("settings.guardrails.modal.pollTools")}</label>
              <input
                type="text"
                value={draft.polling.pollTools.join(", ")}
                onChange={(e) =>
                  updateDetector(
                    "polling",
                    "pollTools",
                    e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                  )
                }
                className="w-full rounded-md border border-border bg-surface-elevated px-3 py-1.5 text-sm text-on-surface focus:border-accent focus:outline-none"
                placeholder={t("settings.guardrails.modal.pollToolsPlaceholder")}
              />
              <p className="text-xs text-on-surface-faint">{t("settings.guardrails.modal.pollToolsHint")}</p>
            </div>
            <NumberField
              label={t("settings.guardrails.modal.warnThreshold")}
              value={draft.polling.warnThreshold}
              onChange={(v) => updateDetector("polling", "warnThreshold", v)}
              min={2}
            />
            <NumberField
              label={t("settings.guardrails.modal.criticalThreshold")}
              value={draft.polling.criticalThreshold}
              onChange={(v) => updateDetector("polling", "criticalThreshold", v)}
              min={2}
            />
          </DetectorSection>

          <DetectorSection
            title={t("settings.guardrails.modal.pingPongDetector")}
            description={t("settings.guardrails.modal.pingPongDesc")}
            enabled={draft.pingPong.enabled}
            onToggle={(v) => updateDetector("pingPong", "enabled", v)}
          >
            <NumberField
              label={t("settings.guardrails.modal.minCycles")}
              value={draft.pingPong.minCycles}
              onChange={(v) => updateDetector("pingPong", "minCycles", v)}
              min={2}
            />
            <NumberField
              label={t("settings.guardrails.modal.stableCycles")}
              value={draft.pingPong.stableOutcomeCycles}
              onChange={(v) => updateDetector("pingPong", "stableOutcomeCycles", v)}
              min={2}
            />
          </DetectorSection>

          <DetectorSection
            title={t("settings.guardrails.modal.circuitBreaker")}
            description={t("settings.guardrails.modal.circuitBreakerDesc")}
            enabled={draft.circuitBreaker.enabled}
            onToggle={(v) => updateDetector("circuitBreaker", "enabled", v)}
          >
            <NumberField
              label={t("settings.guardrails.modal.staleWindow")}
              value={draft.circuitBreaker.maxStaleWindow}
              onChange={(v) => updateDetector("circuitBreaker", "maxStaleWindow", v)}
              min={5}
            />
          </DetectorSection>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 pt-0">
          <button
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm text-on-surface-secondary hover:text-on-surface transition-colors"
          >
            {t("settings.guardrails.modal.cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50 transition-colors"
          >
            {saving ? t("settings.search.saving") : t("settings.search.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
