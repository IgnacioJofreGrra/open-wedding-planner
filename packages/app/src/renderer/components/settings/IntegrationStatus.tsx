import { useState, useEffect, useCallback } from "react";
import { wsClient } from "../../lib/ws-client";
import { useRequest, useMutation } from "../../hooks/useRequest";
import { WhatsAppSetup } from "./WhatsAppSetup";
import { GoogleServicesSetup } from "./GoogleServicesSetup";
import { useGatewayStore } from "../../stores/gateway-store";
import type { GatewayEvent } from "@wedding-planner/shared";
import { useI18n } from "../../i18n/use-i18n";

interface ChannelStatuses {
  whatsapp: "disconnected" | "connecting" | "connected" | "failed";
}

export function IntegrationStatus() {
  const { t } = useI18n();
  const gatewayState = useGatewayStore((s) => s.state);
  const [statuses, setStatuses] = useState<ChannelStatuses>(() => ({
    whatsapp: (gatewayState?.channels?.whatsapp as ChannelStatuses["whatsapp"]) ?? "disconnected",
  }));
  const [whatsappQr, setWhatsappQr] = useState<string | null>(null);

  const { data: aiConfigData } = useRequest<{ whatsappAutoSend?: boolean }>("ai-config.get");
  const { mutate: updateAiConfig } = useMutation("ai-config.update");

  const autoSend = aiConfigData?.whatsappAutoSend ?? false;

  function handleAutoSendChange(value: boolean) {
    updateAiConfig({ whatsappAutoSend: value });
  }

  const handleEvent = useCallback((event: GatewayEvent) => {
    if (event.name === "channel-status") {
      const { channel, status } = event.data as {
        channel: string;
        status: string;
      };
      const safeStatus: ChannelStatuses["whatsapp"] =
        status === "connected" ||
        status === "connecting" ||
        status === "disconnected" ||
        status === "failed"
          ? status
          : "disconnected";
      setStatuses((prev) => ({
        ...prev,
        [channel]: safeStatus,
      }));
      if (channel === "whatsapp" && status === "connected") {
        setWhatsappQr(null);
      }
    }

    if (
      event.name === "agent-activity" &&
      event.data.sessionKey === "whatsapp-qr"
    ) {
      setWhatsappQr(event.data.detail ?? null);
    }
  }, []);

  useEffect(() => {
    // Query live WhatsApp status on mount so we don't show stale state
    wsClient.request<{ connected: boolean }>("whatsapp.status").then((res) => {
      setStatuses((prev) => ({
        ...prev,
        whatsapp: res.connected ? "connected" : prev.whatsapp,
      }));
    }).catch(() => {});
    return wsClient.onEvent(handleEvent);
  }, [handleEvent]);

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">{t("settings.tabs.integrations")}</h2>
      <div className="space-y-4">
        <WhatsAppSetup
          status={statuses.whatsapp}
          qrCode={whatsappQr}
          autoSend={autoSend}
          onAutoSendChange={handleAutoSendChange}
        />
        <GoogleServicesSetup />
      </div>
    </div>
  );
}

export function StatusIndicator({
  status,
  label,
}: {
  status: "disconnected" | "connecting" | "connected" | "failed";
  label?: string;
}) {
  const { t } = useI18n();
  const colors = {
    disconnected: "bg-on-surface-faint",
    connecting: "bg-warning animate-pulse",
    connected: "bg-success",
    failed: "bg-error",
  };

  const labels = {
    disconnected: t("settings.status.disconnected"),
    connecting: t("settings.status.connecting"),
    connected: t("settings.status.connected"),
    failed: t("settings.status.failed"),
  };

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-active px-2.5 py-1 text-xs text-on-surface-secondary">
      <span className={`h-1.5 w-1.5 rounded-full ${colors[status]}`} />
      {label ?? labels[status]}
    </span>
  );
}
