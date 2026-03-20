import { QRCodeSVG } from "qrcode.react";
import { useMutation } from "../../hooks/useRequest";
import { StatusIndicator } from "./IntegrationStatus";
import { MessageCircle } from "lucide-react";
import { useI18n } from "../../i18n/use-i18n";

interface WhatsAppSetupProps {
  status: "disconnected" | "connecting" | "connected" | "failed";
  qrCode: string | null;
  autoSend: boolean;
  onAutoSendChange: (value: boolean) => void;
}

export function WhatsAppSetup({ status, qrCode, autoSend, onAutoSendChange }: WhatsAppSetupProps) {
  const { t } = useI18n();
  const { mutate: connect, loading: connecting } = useMutation(
    "whatsapp.connect",
  );
  const { mutate: disconnect } = useMutation("whatsapp.disconnect");

  async function handleConnect() {
    await connect({});
  }

  async function handleDisconnect() {
    await disconnect({});
  }

  return (
    <div className="rounded-lg border border-border bg-surface-elevated px-4 py-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MessageCircle className="h-5 w-5 text-success" />
          <div>
            <p className="text-sm font-medium text-on-surface">WhatsApp</p>
            <p className="text-xs text-on-surface-secondary">
              {t("settings.whatsapp.description")}
            </p>
          </div>
        </div>
        <StatusIndicator status={status} />
      </div>

      {(status === "disconnected" || status === "failed") && (
        <button
          onClick={handleConnect}
          disabled={connecting}
          className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {connecting ? t("settings.whatsapp.starting") : t("settings.whatsapp.connect")}
        </button>
      )}

      {qrCode && status === "connecting" && (
        <div className="flex flex-col items-center gap-3 py-4">
          <p className="text-sm text-on-surface-secondary">
            {t("settings.whatsapp.scanQr")}
          </p>
          <div className="rounded-xl bg-white p-4">
            <QRCodeSVG value={qrCode} size={256} />
          </div>
          <p className="text-xs text-on-surface-tertiary">
            {t("settings.whatsapp.qrHelp")}
          </p>
        </div>
      )}

      {status === "connecting" && !qrCode && (
        <p className="text-sm text-warning animate-pulse">
          {t("settings.whatsapp.waitingQr")}
        </p>
      )}

      {status === "connected" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-border bg-surface-elevated px-4 py-3">
            <div>
              <p className="text-sm font-medium text-on-surface">{t("settings.whatsapp.autoSend")}</p>
              <p className="text-xs text-on-surface-secondary">
                {t("settings.whatsapp.autoSendDescription")}
              </p>
            </div>
            <button
              onClick={() => onAutoSendChange(!autoSend)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                autoSend ? "bg-green-600" : "bg-on-surface-faint"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  autoSend ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          <button
            onClick={handleDisconnect}
            className="w-full rounded-lg border border-error/30 px-4 py-2 text-sm text-error hover:bg-error-bg transition-colors"
          >
            {t("settings.whatsapp.disconnect")}
          </button>
        </div>
      )}
    </div>
  );
}
