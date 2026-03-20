import { useState, useEffect } from "react";
import { useRequest, useMutation } from "../../hooks/useRequest";
import { StatusIndicator } from "./IntegrationStatus";
import { Mail, Upload, ClipboardPaste } from "lucide-react";
import { useI18n } from "../../i18n/use-i18n";
import type { TranslationKey } from "../../stores/ui-language-store";

interface GoogleStatus {
  connected: boolean;
  email: string | null;
  services: string[];
  autoSend: boolean;
  hasCredentials: boolean;
}

interface WeddingConfig {
  coupleEmail?: string;
}

interface GoogleConnectResult {
  authUrl?: string;
}

const AVAILABLE_SERVICES: Array<{ id: string; labelKey: TranslationKey; descriptionKey: TranslationKey }> = [
  { id: "gmail", labelKey: "settings.google.service.gmail", descriptionKey: "settings.google.service.gmailDescription" },
  { id: "calendar", labelKey: "settings.google.service.calendar", descriptionKey: "settings.google.service.calendarDescription" },
  { id: "contacts", labelKey: "settings.google.service.contacts", descriptionKey: "settings.google.service.contactsDescription" },
  { id: "drive", labelKey: "settings.google.service.drive", descriptionKey: "settings.google.service.driveDescription" },
];

function openExternal(url: string) {
  if (window.electronAPI) {
    window.electronAPI.openExternal(url);
  } else {
    window.open(url, "_blank");
  }
}

export function GoogleServicesSetup() {
  const { t } = useI18n();
  const { data: status, refetch } = useRequest<GoogleStatus>("google.status");
  const { data: weddingConfig } = useRequest<WeddingConfig>("wedding-config.get");
  const { mutate: setCredentials, loading: settingCreds } = useMutation("google.set-credentials");
  const { mutate: connect, loading: connecting } = useMutation<{ email: string; services: string[] }, GoogleConnectResult>("google.connect");
  const { mutate: disconnect } = useMutation("google.disconnect");
  const { mutate: updateAutoSend } = useMutation("google.update-auto-send");

  const [email, setEmail] = useState("");
  const [selectedServices, setSelectedServices] = useState<string[]>(["gmail"]);
  const [step, setStep] = useState<"credentials" | "services" | "ready">("credentials");
  const [pasteMode, setPasteMode] = useState(false);
  const [pastedJson, setPastedJson] = useState("");
  const [credError, setCredError] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);

  // Auto-fill email from wedding config
  useEffect(() => {
    if (weddingConfig?.coupleEmail && !email) {
      setEmail(weddingConfig.coupleEmail);
    }
  }, [weddingConfig]);

  useEffect(() => {
    if (status?.hasCredentials && !status.connected) {
      setStep("services");
    } else if (status?.hasCredentials && status.connected) {
      setStep("ready");
    }
  }, [status]);

  async function handleCredentialsFile() {
    setCredError(null);
    try {
      const result = await window.electronAPI?.showOpenDialog({
        filters: [{ name: "JSON", extensions: ["json"] }],
        properties: ["openFile"],
      });
      if (!result || result.canceled || !result.filePaths[0]) return;

      await setCredentials({ credentialsPath: result.filePaths[0] });
      refetch();
    } catch (err) {
      setCredError(err instanceof Error ? err.message : t("settings.google.failedSaveCredentials"));
    }
  }

  async function handlePasteCredentials() {
    if (!pastedJson.trim()) return;
    setCredError(null);

    try {
      JSON.parse(pastedJson.trim());
    } catch {
      setCredError(t("settings.google.invalidJson"));
      return;
    }

    try {
      await setCredentials({ credentialsJson: pastedJson.trim() });
      refetch();
    } catch (err) {
      setCredError(err instanceof Error ? err.message : t("settings.google.failedSaveCredentials"));
    }
  }

  async function handleConnect() {
    if (!email) return;
    setConnectError(null);
    try {
      const result = await connect({ email, services: selectedServices });
      if (result?.authUrl) {
        openExternal(result.authUrl);
        const interval = setInterval(async () => {
          refetch();
        }, 2000);
        setTimeout(() => clearInterval(interval), 5 * 60 * 1000);
      }
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : t("settings.google.failedConnect"));
    }
  }

  function toggleService(id: string) {
    setSelectedServices((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  }

  const isConnected = status?.connected ?? false;

  return (
    <div className="rounded-lg border border-border bg-surface-elevated px-4 py-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Mail className="h-5 w-5 text-accent" />
          <div>
            <p className="text-sm font-medium text-on-surface">{t("settings.google.title")}</p>
            <p className="text-xs text-on-surface-secondary">
              {isConnected
                ? t("settings.google.connectedAs").replace("{{email}}", status?.email ?? "")
                : t("settings.google.subtitle")}
            </p>
          </div>
        </div>
        <StatusIndicator status={isConnected ? "connected" : "disconnected"} />
      </div>

      {/* Step 1: Upload or paste credentials */}
      {step === "credentials" && (
        <div className="space-y-3">
          <p className="text-xs text-on-surface-secondary">
            {t("settings.google.credentialsHelp")}{" "}
            <button
              onClick={() => openExternal("https://console.cloud.google.com/apis/credentials")}
              className="text-accent hover:underline"
            >
              {t("settings.google.cloudConsole")}
            </button>
            .
          </p>
          {credError && (
            <p className="text-xs text-error rounded-lg bg-error-bg border border-error/20 px-3 py-2">
              {credError}
            </p>
          )}
          {pasteMode ? (
            <div className="space-y-2">
              <textarea
                value={pastedJson}
                onChange={(e) => setPastedJson(e.target.value)}
                placeholder={t("settings.google.pastePlaceholder")}
                rows={6}
                className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-xs font-mono text-on-surface placeholder:text-placeholder focus:border-accent focus:outline-none resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={handlePasteCredentials}
                  disabled={settingCreds || !pastedJson.trim()}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50 transition-colors"
                >
                  {settingCreds ? t("settings.search.saving") : t("settings.google.saveCredentials")}
                </button>
                <button
                  onClick={() => setPasteMode(false)}
                  className="rounded-lg border border-border px-3 py-2 text-sm text-on-surface-secondary hover:bg-surface-hover transition-colors"
                >
                  {t("timeline.cancel")}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleCredentialsFile}
                disabled={settingCreds}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50 transition-colors"
              >
                <Upload className="h-4 w-4" />
                {settingCreds ? t("settings.search.saving") : t("settings.google.uploadFile")}
              </button>
              <button
                onClick={() => setPasteMode(true)}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-on-surface-secondary hover:bg-surface-hover transition-colors"
              >
                <ClipboardPaste className="h-4 w-4" />
                {t("settings.google.pasteJson")}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Pick services + connect */}
      {step === "services" && (
        <div className="space-y-3">
          <input
            type="email"
            placeholder="your@gmail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-on-surface placeholder:text-placeholder focus:border-accent focus:outline-none"
          />
          <div className="space-y-2">
            <p className="text-xs text-on-surface-secondary">{t("settings.google.selectServices")}</p>
            {AVAILABLE_SERVICES.map((svc) => (
              <label
                key={svc.id}
                className="flex items-center gap-2 rounded-lg border border-border bg-surface-elevated px-3 py-2 cursor-pointer hover:bg-surface-active transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedServices.includes(svc.id)}
                  onChange={() => toggleService(svc.id)}
                  className="rounded"
                />
                <div>
                  <p className="text-sm text-on-surface">{t(svc.labelKey)}</p>
                  <p className="text-xs text-on-surface-secondary">{t(svc.descriptionKey)}</p>
                </div>
              </label>
            ))}
          </div>
          {connectError && (
            <p className="text-xs text-error rounded-lg bg-error-bg border border-error/20 px-3 py-2 break-all">
              {connectError}
            </p>
          )}
          <button
            onClick={handleConnect}
            disabled={connecting || !email || selectedServices.length === 0}
            className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50 transition-colors"
          >
            {connecting ? t("settings.google.openingBrowser") : t("settings.google.connectAccount")}
          </button>
        </div>
      )}

      {/* Connected state */}
      {isConnected && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {status?.services.map((svc) => (
              <span
                key={svc}
                className="rounded-full bg-accent-subtle px-2 py-0.5 text-xs text-accent"
              >
                {svc}
              </span>
            ))}
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border bg-surface-elevated px-4 py-3">
            <div>
              <p className="text-sm font-medium text-on-surface">{t("settings.google.autoSend")}</p>
              <p className="text-xs text-on-surface-secondary">
                {t("settings.google.autoSendDescription")}
              </p>
            </div>
            <button
              onClick={() => updateAutoSend({ autoSend: !status?.autoSend })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                status?.autoSend ? "bg-blue-600" : "bg-on-surface-faint"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  status?.autoSend ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          <button
            onClick={async () => {
              await disconnect({});
              refetch();
            }}
            className="w-full rounded-lg border border-error/30 px-4 py-2 text-sm text-error hover:bg-error-bg transition-colors"
          >
            {t("settings.google.disconnect")}
          </button>
        </div>
      )}
    </div>
  );
}
