import { useEffect, useState } from "react";
import {
  Globe,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { wsClient } from "../../lib/ws-client";
import { useMutation } from "../../hooks/useRequest";
import { useI18n } from "../../i18n/use-i18n";

type TunnelState =
  | { state: "stopped" }
  | { state: "starting" }
  | { state: "running"; url: string }
  | { state: "error"; message: string };

export function TunnelStatus() {
  const { t } = useI18n();
  const [status, setStatus] = useState<TunnelState>({ state: "stopped" });
  const [copied, setCopied] = useState(false);
  const { mutate: startTunnel, loading: starting } =
    useMutation("tunnel.start");
  const { mutate: stopTunnel, loading: stopping } = useMutation("tunnel.stop");

  // Load initial status and subscribe to live updates
  useEffect(() => {
    wsClient
      .request<TunnelState>("tunnel.status")
      .then(setStatus)
      .catch(() => {});

    return wsClient.onEvent((event) => {
      if ((event.name as string) === "tunnel.status") {
        setStatus(event.data as unknown as TunnelState);
      }
    });
  }, []);

  async function handleToggle() {
    if (status.state === "stopped" || status.state === "error") {
      const result = (await startTunnel({})) as TunnelState;
      setStatus(result);
    } else if (status.state === "running") {
      const result = (await stopTunnel({})) as TunnelState;
      setStatus(result);
    }
  }

  function handleCopy() {
    if (status.state !== "running") return;
    navigator.clipboard.writeText(status.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const isActive = status.state === "running" || status.state === "starting";
  const isBusy = starting || stopping || status.state === "starting";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Globe className="w-4 h-4 text-on-surface-secondary" />
        <h2 className="text-sm font-semibold text-on-surface">{t("settings.tunnel.title")}</h2>
      </div>

      <p className="text-xs text-on-surface-tertiary">
        {t("settings.tunnel.description")}
      </p>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 flex-1 bg-surface-elevated border border-border rounded-lg px-3 py-2 min-w-0">
          <StatusDot state={status.state} />
          <span className="text-sm text-on-surface font-mono truncate">
            {status.state === "running" && status.url}
            {status.state === "starting" && t("settings.tunnel.starting")}
            {status.state === "stopped" && t("settings.tunnel.inactive")}
            {status.state === "error" && (
              <span className="text-error">{status.message}</span>
            )}
          </span>
        </div>

        {status.state === "running" && (
          <button
            onClick={handleCopy}
            title={t("settings.tunnel.copy")}
            className="p-2 rounded-lg bg-surface-elevated border border-border hover:bg-surface-active transition-colors shrink-0"
          >
            {copied ? (
              <Check className="w-4 h-4 text-success" />
            ) : (
              <Copy className="w-4 h-4 text-on-surface-secondary" />
            )}
          </button>
        )}

        {status.state === "running" && (
          <button
            onClick={() => {
              if (window.electronAPI) {
                window.electronAPI.openExternal(status.url);
              } else {
                window.open(status.url, "_blank");
              }
            }}
            title={t("settings.tunnel.open")}
            className="p-2 rounded-lg bg-surface-elevated border border-border hover:bg-surface-active transition-colors shrink-0"
          >
            <ExternalLink className="w-4 h-4 text-on-surface-secondary" />
          </button>
        )}

        <button
          onClick={handleToggle}
          disabled={isBusy}
          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors shrink-0 disabled:opacity-50 ${
            isActive
              ? "bg-error-bg border border-error/30 text-error hover:bg-error-bg/80"
              : "bg-surface-active border border-border-hover text-on-surface hover:bg-surface-active"
          }`}
        >
          {isBusy ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isActive ? (
            t("settings.tunnel.stop")
          ) : (
            t("settings.tunnel.start")
          )}
        </button>
      </div>

      {status.state === "error" && (
        <div className="flex items-start gap-2 text-xs text-error/80 bg-error-bg border border-error/20 rounded-lg px-3 py-2">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{t("settings.tunnel.packagedHint")}</span>
        </div>
      )}
    </div>
  );
}

function StatusDot({ state }: { state: TunnelState["state"] }) {
  if (state === "running")
    return <span className="w-2 h-2 rounded-full bg-success shrink-0" />;
  if (state === "starting")
    return (
      <span className="w-2 h-2 rounded-full bg-warning animate-pulse shrink-0" />
    );
  if (state === "error")
    return <span className="w-2 h-2 rounded-full bg-error shrink-0" />;
  return <span className="w-2 h-2 rounded-full bg-surface-active shrink-0" />;
}
